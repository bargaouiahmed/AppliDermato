import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { API } from '../../../../../../core/config/api.config';
import {
  ConsultationExplorationDocumentResponse,
  CreateExplorationDocumentRequest,
} from '../../../../../../core/models/documents.models';
import { DocumentsService } from '../../../../../../core/services/documents.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';

type DocumentsSectionKey = 'exploration' | 'cnam';
type CnamFileItem = {
  fileName: string;
  labelKey: string;
};
type ExplorationFormModel = {
  typeInput: string;
  typeLabels: string[];
  clinic: string;
  forfait: string;
  operator: string;
  precaution: string;
  additionalInformation: string;
  file: File | null;
};

@Component({
  selector: 'app-consultation-documents-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './consultation-documents-section.component.html',
  styleUrl: './consultation-documents-section.component.css',
})
export class ConsultationDocumentsSectionComponent {
  private readonly documentsService = inject(DocumentsService);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() set consultationId(value: string | null) {
    this._consultationId = value?.trim() || null;
    this.loadDocuments();
  }

  protected readonly sections: Array<{ key: DocumentsSectionKey; labelKey: string; iconClass: string }> = [
    {
      key: 'exploration',
      labelKey: 'consultation.documents.navigation.exploration',
      iconClass: 'bi bi-folder2-open',
    },
    {
      key: 'cnam',
      labelKey: 'consultation.documents.navigation.cnam',
      iconClass: 'bi bi-file-earmark-medical',
    },
  ];

  protected readonly cnamFiles: CnamFileItem[] = [
    { fileName: 'BS1.pdf', labelKey: 'consultation.documents.cnam.files.bs1' },
    { fileName: 'apci.pdf', labelKey: 'consultation.documents.cnam.files.apci' },
    { fileName: 'AP1.pdf', labelKey: 'consultation.documents.cnam.files.ap1' },
    { fileName: 'AP2.pdf', labelKey: 'consultation.documents.cnam.files.ap2' },
    { fileName: 'AP3.pdf', labelKey: 'consultation.documents.cnam.files.ap3' },
    { fileName: 'AP4.pdf', labelKey: 'consultation.documents.cnam.files.ap4' },
    { fileName: 'dde_changement_filiere.pdf', labelKey: 'consultation.documents.cnam.files.filiere' },
    { fileName: 'medecin_famille.pdf', labelKey: 'consultation.documents.cnam.files.medecinFamille' },
    {
      fileName: 'demande-maladie-couches.pdf',
      labelKey: 'consultation.documents.cnam.files.demandeMaladie',
    },
    {
      fileName: 'certificat-medical-maladie-couche.pdf',
      labelKey: 'consultation.documents.cnam.files.certificatMaladie',
    },
  ];

  protected readonly explorationTypeSuggestions = [
    'consultation.documents.exploration.defaults.imagerie',
    'consultation.documents.exploration.defaults.biologie',
    'consultation.documents.exploration.defaults.echographie',
    'consultation.documents.exploration.defaults.scanner',
    'consultation.documents.exploration.defaults.irm',
    'consultation.documents.exploration.defaults.ecg',
    'consultation.documents.exploration.defaults.endoscopie',
  ];

  protected activeSection: DocumentsSectionKey = 'exploration';
  protected explorationDocuments: ConsultationExplorationDocumentResponse[] = [];
  protected isLoading = false;
  protected isSaving = false;
  protected deletingDocumentId: string | null = null;
  protected loadError = '';
  protected isCreateModalOpen = false;
  protected previewImageUrl = '';
  protected previewImageName = '';
  protected readonly form: ExplorationFormModel = this.buildEmptyForm();

  private _consultationId: string | null = null;

  protected selectSection(section: DocumentsSectionKey): void {
    this.activeSection = section;
  }

  protected openCreateModal(): void {
    if (!this.ensureConsultationId()) {
      return;
    }

    this.resetForm();
    this.isCreateModalOpen = true;
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.resetForm();
  }

  protected addTypeFromInput(): void {
    this.addTypeLabel(this.form.typeInput);
    this.form.typeInput = '';
  }

  protected handleTypeInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }

    event.preventDefault();
    this.addTypeFromInput();
  }

  protected addSuggestedType(translationKey: string): void {
    this.addTypeLabel(this.i18n.t(translationKey));
  }

  protected removeType(index: number): void {
    this.form.typeLabels.splice(index, 1);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.form.file = null;
      return;
    }

    const validationKey = this.validateSelectedFile(file);
    if (validationKey) {
      this.toastService.error(this.i18n.t(validationKey));
      input.value = '';
      this.form.file = null;
      return;
    }

    this.form.file = file;
  }

  protected saveExplorationDocument(): void {
    const consultationId = this.getConsultationIdOrToast();
    if (!consultationId) {
      return;
    }

    if (!this.form.file) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.fileRequired'));
      return;
    }

    const request: CreateExplorationDocumentRequest = {
      typeLabels: [...this.form.typeLabels],
      clinic: this.form.clinic.trim(),
      forfait: this.form.forfait.trim(),
      operator: this.form.operator.trim(),
      precaution: this.form.precaution.trim(),
      additionalInformation: this.form.additionalInformation.trim(),
      file: this.form.file,
    };

    this.isSaving = true;
    this.documentsService
      .createExplorationDocument(consultationId, request)
      .pipe(
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (document) => {
          this.explorationDocuments = [document, ...this.explorationDocuments];
          this.closeCreateModal();
          this.toastService.success(this.i18n.t('consultation.documents.toast.createSuccess'));
        },
        error: (error) => {
          this.toastService.error(this.resolveBackendMessage(error));
        },
      });
  }

  protected deleteDocument(document: ConsultationExplorationDocumentResponse): void {
    const consultationId = this.getConsultationIdOrToast();
    if (!consultationId) {
      return;
    }

    const confirmed = window.confirm(
      this.i18n.t('consultation.documents.exploration.actions.deleteConfirm'),
    );
    if (!confirmed) {
      return;
    }

    this.deletingDocumentId = document.id;
    this.documentsService
      .deleteExplorationDocument(consultationId, document.id)
      .pipe(
        finalize(() => {
          this.deletingDocumentId = null;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.explorationDocuments = this.explorationDocuments.filter((item) => item.id !== document.id);
          this.toastService.success(this.i18n.t('consultation.documents.toast.deleteSuccess'));
        },
        error: (error) => {
          this.toastService.error(this.resolveBackendMessage(error));
        },
      });
  }

  protected openDocument(document: ConsultationExplorationDocumentResponse): void {
    this.openUrl(this.documentsService.resolveAssetUrl(document.fileUrl));
  }

  protected openCnamFile(file: CnamFileItem): void {
    this.openUrl(API.documents.cnamFile(file.fileName));
  }

  protected isDeleting(documentId: string): boolean {
    return this.deletingDocumentId === documentId;
  }

  protected hasExplorationDocuments(): boolean {
    return this.explorationDocuments.length > 0;
  }

  protected isImageDocument(document: ConsultationExplorationDocumentResponse): boolean {
    const fileName = document.originalFileName || document.fileUrl;
    return /\.(png|jpe?g|webp)$/i.test(fileName);
  }

  protected previewImage(document: ConsultationExplorationDocumentResponse): void {
    if (!this.isImageDocument(document)) {
      return;
    }

    this.previewImageUrl = this.documentsService.resolveAssetUrl(document.fileUrl);
    this.previewImageName = document.originalFileName;
  }

  protected closePreview(): void {
    this.previewImageUrl = '';
    this.previewImageName = '';
  }

  protected formatDocumentDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat(this.getIntlLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  protected getSelectedFileName(): string {
    return this.form.file?.name ?? '';
  }

  protected isSuggestedTypeSelected(translationKey: string): boolean {
    const translated = this.i18n.t(translationKey).trim().toLowerCase();
    return this.form.typeLabels.some((item) => item.trim().toLowerCase() === translated);
  }

  protected resolveImageUrl(document: ConsultationExplorationDocumentResponse): string {
    return this.documentsService.resolveAssetUrl(document.fileUrl);
  }

  private loadDocuments(): void {
    const consultationId = this._consultationId;
    this.loadError = '';
    this.explorationDocuments = [];

    if (!consultationId) {
      return;
    }

    this.isLoading = true;
    this.documentsService
      .getConsultationDocuments(consultationId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.explorationDocuments = response.explorationDocuments ?? [];
        },
        error: (error) => {
          this.loadError = this.resolveBackendMessage(error);
        },
      });
  }

  private addTypeLabel(rawValue: string): void {
    const normalized = rawValue.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return;
    }

    const exists = this.form.typeLabels.some(
      (item) => item.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) {
      return;
    }

    this.form.typeLabels = [...this.form.typeLabels, normalized];
  }

  private buildEmptyForm(): ExplorationFormModel {
    return {
      typeInput: '',
      typeLabels: [],
      clinic: '',
      forfait: '',
      operator: '',
      precaution: '',
      additionalInformation: '',
      file: null,
    };
  }

  private resetForm(): void {
    const emptyForm = this.buildEmptyForm();
    this.form.typeInput = emptyForm.typeInput;
    this.form.typeLabels = emptyForm.typeLabels;
    this.form.clinic = emptyForm.clinic;
    this.form.forfait = emptyForm.forfait;
    this.form.operator = emptyForm.operator;
    this.form.precaution = emptyForm.precaution;
    this.form.additionalInformation = emptyForm.additionalInformation;
    this.form.file = emptyForm.file;
  }

  private ensureConsultationId(): boolean {
    return !!this.getConsultationIdOrToast();
  }

  private getConsultationIdOrToast(): string | null {
    const consultationId = this._consultationId?.trim() ?? '';
    if (consultationId) {
      return consultationId;
    }

    this.toastService.error(this.i18n.t('consultation.documents.toast.consultationNotFound'));
    return null;
  }

  private openUrl(url: string): void {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.popupBlocked'));
    }
  }

  private validateSelectedFile(file: File): string | null {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
      return 'consultation.documents.toast.fileTypeInvalid';
    }

    if (file.size > 10 * 1024 * 1024) {
      return 'consultation.documents.toast.fileTooLarge';
    }

    return null;
  }

  private resolveBackendMessage(error: unknown): string {
    const backendMessage =
      typeof (error as { error?: unknown })?.error === 'string'
        ? ((error as { error: string }).error || '').trim()
        : '';

    switch (backendMessage) {
      case 'Consultation not found.':
        return this.i18n.t('consultation.documents.toast.consultationNotFound');
      case 'A file is required.':
        return this.i18n.t('consultation.documents.toast.fileRequired');
      case 'The uploaded file exceeds the 10 MB limit.':
        return this.i18n.t('consultation.documents.toast.fileTooLarge');
      case 'Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.':
        return this.i18n.t('consultation.documents.toast.fileTypeInvalid');
      case 'Exploration document not found.':
        return this.i18n.t('consultation.documents.toast.documentNotFound');
      default:
        return this.i18n.t('consultation.documents.toast.genericError');
    }
  }

  private getIntlLocale(): string {
    const lang = this.i18n.lang();
    if (lang === 'fr') {
      return 'fr-FR';
    }

    if (lang === 'ar') {
      return 'ar-TN';
    }

    return 'en-US';
  }
}
