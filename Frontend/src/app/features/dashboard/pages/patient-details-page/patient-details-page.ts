import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Patient,
  PatientConsultation,
  UpdatePatientRequest,
} from '../../../../core/models/patient.models';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { PatientService } from '../../../../core/services/patient.service';
import { ToastService } from '../../../../core/services/toast.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ProfessionSelectComponent } from '../../../../shared/components/profession-select/profession-select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConsultationInitModal } from '../../../../shared/components/consultation-init-modal/consultation-init-modal';
import {
  ConsultationDetailModal,
  ConsultationDetailModalData,
} from '../../../../shared/components/consultation-detail-modal/consultation-detail-modal';
import {
  ConsultationCarepDetailModal,
  ConsultationCarepDetailModalData,
} from '../../../../shared/components/consultation-carep-detail-modal/consultation-carep-detail-modal';

@Component({
  selector: 'app-patient-details-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ProfessionSelectComponent,
    ConsultationInitModal,
    ConsultationDetailModal,
    ConsultationCarepDetailModal,
  ],
  templateUrl: './patient-details-page.html',
  styleUrl: './patient-details-page.css',
})
export class PatientDetailsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly patientService = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected patient: Patient | null = null;
  protected consultations: PatientConsultation[] = [];
  protected isPatientLoading = false;
  protected isConsultationsLoading = false;
  protected patientId = '';
  protected consultationsPageNumber = 1;
  protected consultationsPageSize = 10;
  protected consultationsTotalCount = 0;
  protected consultationModalOpen = false;
  protected detailModalOpen = false;
  protected detailModalData: ConsultationDetailModalData | null = null;
  protected carepModalOpen = false;
  protected carepModalData: ConsultationCarepDetailModalData | null = null;
  protected deletingConsultationId: string | null = null;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected isEditMode = false;
  protected isSavingPatient = false;
  protected editErrorMessage = '';

  protected readonly form = this.fb.nonNullable.group({
    firstname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    lastname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    dateOfBirth: ['', Validators.required],
    phoneNumber: ['', [Validators.maxLength(30)]],
    country: ['Tunisie', [Validators.maxLength(120)]],
    profession: ['', [Validators.maxLength(120)]],
    workPlace: ['', [Validators.maxLength(180)]],
    sex: ['', Validators.required],
    familialStatus: ['', [Validators.maxLength(120)]],
    city: ['', [Validators.maxLength(120)]],
    address: ['', [Validators.maxLength(240)]],
    postalCode: ['', [Validators.maxLength(20)]],
    email: ['', [Validators.email, Validators.maxLength(160)]],
    apci: ['', [Validators.maxLength(240)]],
    insuranceType: ['', [Validators.maxLength(120)]],
    insuranceEstablishment: ['', [Validators.maxLength(180)]],
  });

  protected get consultationsTotalPages(): number {
    return Math.max(1, Math.ceil(this.consultationsTotalCount / this.consultationsPageSize));
  }

  protected get consultationVisiblePages(): number[] {
    if (!this.consultationsTotalCount) {
      return [];
    }

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.consultationsPageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > this.consultationsTotalPages) {
      endPage = this.consultationsTotalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  protected get hasConsultations(): boolean {
    return this.consultations.length > 0;
  }

  protected getPatientAge(dateOfBirth: string): number | null {
    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age;
  }

  protected getApciItems(value: string): string[] {
    if (!value || !value.trim()) {
      return [];
    }

    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((paramMap) => paramMap.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (!id) {
          this.router.navigate(['/patients']);
          return;
        }

        this.patientId = id;
        this.isEditMode = false;
        this.editErrorMessage = '';
        this.consultationsPageNumber = 1;
        this.loadPatient();
        this.loadConsultations();
      });
  }

  protected goToConsultationPage(page: number): void {
    if (
      page < 1 ||
      page > this.consultationsTotalPages ||
      page === this.consultationsPageNumber
    ) {
      return;
    }

    this.consultationsPageNumber = page;
    this.loadConsultations();
  }

  protected openConsultationModal(): void {
    if (!this.patientId || this.isEditMode) {
      return;
    }

    this.consultationModalOpen = true;
  }

  protected openEditMode(): void {
    if (!this.patient) {
      return;
    }

    this.editErrorMessage = '';
    this.patchFormFromPatient(this.patient);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.isEditMode = true;
  }

  protected cancelEditMode(): void {
    if (this.isSavingPatient) {
      return;
    }

    this.editErrorMessage = '';
    if (this.patient) {
      this.patchFormFromPatient(this.patient);
    }
    this.isEditMode = false;
  }

  protected savePatient(): void {
    if (!this.patientId || this.isSavingPatient) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.editErrorMessage = this.i18n.t('patients.details.edit.validation.requiredFields');
      return;
    }

    const dateOfBirth = this.form.controls.dateOfBirth.value;
    if (this.isBirthDateInFuture(dateOfBirth)) {
      this.editErrorMessage = this.i18n.t('patients.details.edit.validation.birthDate');
      return;
    }

    this.editErrorMessage = '';
    const value = this.form.getRawValue();
    const payload: UpdatePatientRequest = {
      firstname: value.firstname.trim(),
      lastname: value.lastname.trim(),
      dateOfBirth: value.dateOfBirth,
      phoneNumber: value.phoneNumber.trim(),
      country: value.country.trim(),
      profession: value.profession.trim(),
      workPlace: value.workPlace.trim(),
      sex: value.sex.trim(),
      familialStatus: value.familialStatus.trim(),
      city: value.city.trim(),
      address: value.address.trim(),
      postalCode: value.postalCode.trim(),
      email: value.email.trim(),
      apci: value.apci.trim(),
      insuranceType: value.insuranceType.trim(),
      insuranceEstablishment: value.insuranceEstablishment.trim(),
    };

    this.isSavingPatient = true;
    this.patientService
      .updatePatient(this.patientId, payload)
      .pipe(
        finalize(() => {
          this.isSavingPatient = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('patients.details.edit.success'));
          this.isEditMode = false;
          this.loadPatient();
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.details.edit.error'));
        },
      });
  }

  protected closeConsultationModal(): void {
    this.consultationModalOpen = false;
  }

  protected openDetailModal(consultation: PatientConsultation): void {
    if (!consultation || !this.patient) {
      return;
    }

    this.detailModalData = {
      consultationId: consultation.id,
      patient: this.patient,
      consultationDate: consultation.consultationDate,
      motifs: [...consultation.motifs],
      diagnostics: [...consultation.diagnostics],
      conduiteActions: [...consultation.conduiteActions],
    };
    this.detailModalOpen = true;
  }

  protected openCarepDetailModal(consultation: PatientConsultation, actionLabel: string): void {
    if (!consultation || !actionLabel) {
      return;
    }

    const key = actionLabel.toLowerCase();
    const isCarep =
      key.includes('ordonnance') ||
      key.includes('certificat') ||
      key.includes('lettre') ||
      key.includes('cnam') ||
      key.includes('chirurgie') ||
      key.includes('laser') ||
      key.includes('imagerie') ||
      key.includes('bilan sanguin') ||
      key.includes('bilan_sanguin');

    if (isCarep) {
      this.carepModalData = {
        consultationId: consultation.id,
        actionKey: actionLabel,
        actionLabel,
      };
      this.carepModalOpen = true;
    } else {
      this.openDetailModal(consultation);
    }
  }

  protected printAction(consultation: PatientConsultation, actionLabel: string): void {
    if (!consultation || !actionLabel) {
      return;
    }

    const key = actionLabel.toLowerCase().trim();
    let documentType = '';

    if (key.includes('ordonnance')) {
      documentType = 'ordonnance';
    } else if (key.includes('certificat')) {
      documentType = 'certificat';
    } else if (key.includes('lettre')) {
      documentType = 'lettre_confrere';
    } else if (key.includes('cnam')) {
      documentType = 'cnam';
    } else if (key.includes('chirurgie') || key.includes('laser') || key.includes('imagerie') || key.includes('bilan sanguin') || key.includes('bilan_sanguin')) {
      documentType = 'paraclinique';
    }

    if (!documentType) {
      return;
    }

    const queryParams: Record<string, string> = {};
    if (documentType === 'paraclinique') {
      if (key.includes('chirurgie')) queryParams['sections'] = 'chirurgie';
      else if (key.includes('laser')) queryParams['sections'] = 'laser';
      else if (key.includes('imagerie')) queryParams['sections'] = 'imagerie';
      else if (key.includes('bilan sanguin') || key.includes('bilan_sanguin')) queryParams['sections'] = 'bilan_sanguin';
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultation.id, 'print', documentType], {
        queryParams,
      }),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected closeDetailModal(): void {
    this.detailModalOpen = false;
    this.detailModalData = null;
  }

  protected closeCarepDetailModal(): void {
    this.carepModalOpen = false;
    this.carepModalData = null;
  }

  protected onConsultationCreated(consultationId: string): void {
    if (!consultationId) {
      return;
    }

    const target = this.router.serializeUrl(this.router.createUrlTree(['/consultations', consultationId]));
    window.open(target, '_blank', 'noopener,noreferrer');
    this.consultationModalOpen = false;
    this.loadConsultations();
  }

  protected openConsultation(consultationId: string): void {
    if (!consultationId) {
      return;
    }

    const target = this.router.serializeUrl(this.router.createUrlTree(['/consultations', consultationId]));
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  protected openConsultationDocuments(consultationId: string): void {
    if (!consultationId) {
      return;
    }

    const target = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultationId], {
        queryParams: { tab: 'documents' },
      }),
    );
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  protected deleteConsultation(consultationId: string): void {
    if (!consultationId || this.deletingConsultationId === consultationId) {
      return;
    }

    const confirmed = window.confirm(this.i18n.t('patients.details.history.confirmDelete'));
    if (!confirmed) {
      return;
    }

    this.deletingConsultationId = consultationId;
    this.interrogatoireService
      .deleteConsultation(consultationId)
      .pipe(
        finalize(() => {
          this.deletingConsultationId = null;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('patients.details.history.deleteSuccess'));
          this.loadConsultations();
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.details.history.deleteError'));
        },
      });
  }

  private loadPatient(): void {
    this.isPatientLoading = true;
    this.patientService
      .getPatientById(this.patientId)
      .pipe(
        finalize(() => {
          this.isPatientLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (patient) => {
          this.patient = patient;
          this.patchFormFromPatient(patient);
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.details.loadPatientError'));
          this.router.navigate(['/patients']);
          this.cdr.detectChanges();
        },
      });
  }

  private loadConsultations(): void {
    this.isConsultationsLoading = true;
    this.patientService
      .getPatientConsultations(
        this.patientId,
        this.consultationsPageNumber,
        this.consultationsPageSize,
      )
      .pipe(
        finalize(() => {
          this.isConsultationsLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.consultations = response.consultations;
          this.consultationsTotalCount = response.totalCount;
          this.cdr.detectChanges();
          if (this.consultationsPageNumber > this.consultationsTotalPages) {
            this.consultationsPageNumber = this.consultationsTotalPages;
            this.loadConsultations();
          }
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.details.loadConsultationsError'));
          this.consultations = [];
          this.consultationsTotalCount = 0;
          this.cdr.detectChanges();
        },
      });
  }

  private patchFormFromPatient(patient: Patient): void {
    this.form.patchValue({
      firstname: patient.firstname || '',
      lastname: patient.lastname || '',
      dateOfBirth: this.toDateInputValue(patient.dateOfBirth),
      phoneNumber: patient.phoneNumber || '',
      country: patient.country || 'Tunisie',
      profession: patient.profession || '',
      workPlace: patient.workPlace || '',
      sex: patient.sex || '',
      familialStatus: patient.familialStatus || '',
      city: patient.city || '',
      address: patient.address || '',
      postalCode: patient.postalCode || '',
      email: patient.email || '',
      apci: patient.apci || '',
      insuranceType: patient.insuranceType || '',
      insuranceEstablishment: patient.insuranceEstablishment || '',
    });
  }

  private toDateInputValue(value: string): string {
    if (!value) {
      return '';
    }

    const directMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) {
      return directMatch[1];
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private isBirthDateInFuture(value: string): boolean {
    if (!value) {
      return false;
    }

    const selected = new Date(`${value}T00:00:00`);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return selected.getTime() > now.getTime();
  }
}
