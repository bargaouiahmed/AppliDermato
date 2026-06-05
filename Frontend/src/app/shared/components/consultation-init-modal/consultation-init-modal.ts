import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, finalize, switchMap } from 'rxjs';
import { ConsultationCreationGuardService } from '../../../core/services/consultation-creation-guard.service';
import { DoctorMotifService } from '../../../core/services/doctor-motif.service';
import { I18nService } from '../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../core/services/interrogatoire.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

type MotifOption = {
  label: string;
  isCustom: boolean;
};

@Component({
  selector: 'app-consultation-init-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './consultation-init-modal.html',
  styleUrl: './consultation-init-modal.css',
})
export class ConsultationInitModal implements OnChanges {
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly doctorMotifService = inject(DoctorMotifService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly consultationCreationGuard = inject(ConsultationCreationGuardService);

  @Input() isOpen = false;
  @Input() patientId = '';
  @Input() initialDate = '';
  @Input() initialMotifs: string[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<string>();

  protected readonly today = new Date().toISOString().slice(0, 10);
  protected consultationDateSelected = this.today;
  protected motifSearchTerm = '';
  protected selectedMotifs: string[] = [];
  protected motifOptions: MotifOption[] = [];
  protected isSubmitting = false;
  protected isMotifMenuOpen = false;

  @ViewChild('motifPicker') private motifPickerRef?: ElementRef<HTMLElement>;

  private closeMenuTimeoutId: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (!this.isMotifMenuOpen) {
      return;
    }

    const picker = this.motifPickerRef?.nativeElement;
    const target = event.target as Node | null;

    if (!picker || !target || !picker.contains(target)) {
      this.isMotifMenuOpen = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.resetState();
    }
  }

  protected close(): void {
    if (this.isSubmitting) {
      return;
    }
    this.closed.emit();
  }

  protected get filteredMotifs(): string[] {
    const normalizedQuery = this.normalizeMotif(this.motifSearchTerm);
    const selectedSet = new Set(this.selectedMotifs.map((motif) => this.normalizeMotif(motif)));

    if (!normalizedQuery) {
      return this.motifOptions
        .filter((motif) => !selectedSet.has(this.normalizeMotif(motif.label)))
        .map((motif) => motif.label)
        .slice(0, 40);
    }

    return this.motifOptions
      .filter((motif) => {
        const normalized = this.normalizeMotif(motif.label);
        return normalized.includes(normalizedQuery) && !selectedSet.has(normalized);
      })
      .map((motif) => motif.label)
      .slice(0, 40);
  }

  protected isCustomMotif(motifLabel: string): boolean {
    const normalized = this.normalizeMotif(motifLabel);
    return this.motifOptions.some(
      (motif) => this.normalizeMotif(motif.label) === normalized && motif.isCustom,
    );
  }

  protected get showAddTagOption(): boolean {
    const value = this.motifSearchTerm.trim();
    if (value.length < 3 || value.length > 100) {
      return false;
    }

    const normalizedValue = this.normalizeMotif(value);
    return !this.motifOptions.some((motif) => this.normalizeMotif(motif.label) === normalizedValue);
  }

  protected onMotifInputFocus(): void {
    if (this.closeMenuTimeoutId) {
      clearTimeout(this.closeMenuTimeoutId);
      this.closeMenuTimeoutId = null;
    }

    this.isMotifMenuOpen = true;
  }

  protected onMotifInputClick(): void {
    if (this.closeMenuTimeoutId) {
      clearTimeout(this.closeMenuTimeoutId);
      this.closeMenuTimeoutId = null;
    }

    this.isMotifMenuOpen = true;
  }

  protected toggleMotifMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.closeMenuTimeoutId) {
      clearTimeout(this.closeMenuTimeoutId);
      this.closeMenuTimeoutId = null;
    }

    this.isMotifMenuOpen = !this.isMotifMenuOpen;
  }

  protected onMotifInputBlur(): void {
    this.closeMenuTimeoutId = setTimeout(() => {
      this.isMotifMenuOpen = false;
    }, 120);
  }

  protected onMotifInputChange(value: string): void {
    this.motifSearchTerm = value;
    this.isMotifMenuOpen = true;
  }

  protected onMotifInputEnter(event: Event): void {
    event.preventDefault();

    if (this.showAddTagOption) {
      this.addTagFromSearchTerm();
      return;
    }

    const firstMotif = this.filteredMotifs[0];
    if (firstMotif) {
      this.selectMotifOption(firstMotif);
    }
  }

  protected onMotifInputEscape(event: Event): void {
    event.preventDefault();
    this.isMotifMenuOpen = false;
  }

  protected selectMotifOption(value: string): void {
    this.pushSelectedMotif(value);
    this.motifSearchTerm = '';
    this.isMotifMenuOpen = false;
  }

  protected addTagFromSearchTerm(): void {
    const value = this.motifSearchTerm.trim();
    if (!value) {
      return;
    }

    if (value.length < 3 || value.length > 100) {
      this.toast.error(this.i18n.t('patients.consultationModal.validation.invalidLength'));
      return;
    }

    const normalizedValue = this.normalizeMotif(value);
    const addResult = this.doctorMotifService.addCustomMotif(value);

    if (!addResult.ok && addResult.reason === 'invalid') {
      this.toast.error(this.i18n.t('patients.consultationModal.validation.invalidLength'));
      return;
    }

    if (addResult.ok || addResult.reason === 'exists') {
      this.loadMotifs();
      const addedLabel =
        this.motifOptions.find((motif) => this.normalizeMotif(motif.label) === normalizedValue)?.label ??
        value;
      this.pushSelectedMotif(addedLabel);
      this.motifSearchTerm = '';
      this.isMotifMenuOpen = false;
    }
  }

  protected deleteCustomMotif(event: Event, motifLabel: string): void {
    event.preventDefault();
    event.stopPropagation();

    this.doctorMotifService.removeCustomMotif(motifLabel);
    this.selectedMotifs = this.selectedMotifs.filter(
      (motif) => this.normalizeMotif(motif) !== this.normalizeMotif(motifLabel),
    );

    this.loadMotifs();
    this.isMotifMenuOpen = true;
  }

  protected removeMotif(motif: string): void {
    this.selectedMotifs = this.selectedMotifs.filter(
      (item) => item.localeCompare(motif, 'fr', { sensitivity: 'base' }) !== 0,
    );
  }

  protected saveConsultation(): void {
    if (!this.patientId) {
      return;
    }

    if (this.selectedMotifs.length < 1) {
      this.toast.error(this.i18n.t('patients.consultationModal.validation.motifRequired'));
      return;
    }

    this.isSubmitting = true;
    const consultationDate = this.toLocalIsoDateTime(
      this.buildConsultationStartDateTime(this.consultationDateSelected),
    );
    const consultationDayIso = consultationDate.slice(0, 10);

    this.consultationCreationGuard
      .hasSameDayConsultation(this.patientId, consultationDayIso)
      .pipe(
        switchMap((hasSameDayConsultation) => {
          if (hasSameDayConsultation) {
            window.alert(this.i18n.t('consultation.creation.sameDayExists'));
            return EMPTY;
          }

          return this.interrogatoireService.initializeConsultation({
            patientId: this.patientId,
            consultationDate,
            motifs: this.selectedMotifs,
          });
        }),
        finalize(() => {
          this.isSubmitting = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.toast.success(this.i18n.t('patients.consultationModal.createSuccess'));
          this.created.emit(response.consultationId);
          this.closed.emit();
        },
        error: (error) => {
          const message = this.extractApiErrorMessage(error);
          this.toast.error(message || this.i18n.t('patients.consultationModal.createError'));
        },
      });
  }

  protected get isMotifSelected(): boolean {
    return this.selectedMotifs.length > 0;
  }

  private resetState(): void {
    this.consultationDateSelected = this.initialDate || this.today;
    this.motifSearchTerm = '';
    this.selectedMotifs = this.initialMotifs?.length ? [...this.initialMotifs] : [];
    this.isSubmitting = false;
    this.isMotifMenuOpen = false;
    this.loadMotifs();
  }

  private loadMotifs(): void {
    const predefined = this.doctorMotifService
      .getPredefinedMotifs()
      .map((label) => ({ label, isCustom: false as const }));

    const custom = this.doctorMotifService
      .getCustomMotifs()
      .filter(
        (label) =>
          !predefined.some(
            (item) => this.normalizeMotif(item.label) === this.normalizeMotif(label),
          ),
      )
      .map((label) => ({ label, isCustom: true as const }));

    this.motifOptions = [...predefined, ...custom].sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
    );
  }

  private pushSelectedMotif(value: string): void {
    const motif = value.trim();
    if (!motif) {
      return;
    }

    if (motif.length < 3 || motif.length > 100) {
      this.toast.error(this.i18n.t('patients.consultationModal.validation.invalidLength'));
      return;
    }

    if (
      this.selectedMotifs.some((item) => item.localeCompare(motif, 'fr', { sensitivity: 'base' }) === 0)
    ) {
      return;
    }

    this.selectedMotifs = [...this.selectedMotifs, motif];
  }

  private normalizeMotif(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private buildConsultationStartDateTime(dateIso: string): Date {
    const now = new Date();
    const selectedDate = dateIso ? new Date(`${dateIso}T00:00:00`) : new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    return selectedDate;
  }

  private toLocalIsoDateTime(date: Date): string {
    return date.toISOString();
  }

  private extractApiErrorMessage(error: unknown): string {
    const unknownError = error as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (typeof unknownError?.error === 'string' && unknownError.error.trim() !== '') {
      return unknownError.error;
    }

    const errorMessage = unknownError?.error && typeof unknownError.error === 'object'
      ? unknownError.error.message
      : null;

    if (typeof errorMessage === 'string' && errorMessage.trim() !== '') {
      return errorMessage;
    }

    if (typeof unknownError?.message === 'string' && unknownError.message.trim() !== '') {
      return unknownError.message;
    }

    return '';
  }
}
