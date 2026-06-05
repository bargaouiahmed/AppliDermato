import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, finalize, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Patient, GetPatientsQuery, PatientConsultation } from '../../../../core/models/patient.models';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { PatientService } from '../../../../core/services/patient.service';
import { ToastService } from '../../../../core/services/toast.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthService } from '../../../../core/services/auth.service';
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

type SortOptionKey =
  | 'createdat:desc'
  | 'createdat:asc'
  | 'lastname:asc'
  | 'lastname:desc'
  | 'firstname:asc'
  | 'firstname:desc';

@Component({
  selector: 'app-patients-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ConsultationInitModal,
    ConsultationDetailModal,
    ConsultationCarepDetailModal,
  ],
  templateUrl: './patients-page.html',
  styleUrl: './patients-page.css',
})
export class PatientsPage implements OnInit {
  private readonly router = inject(Router);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly patientService = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly pageSizeOptions = [10, 20, 30, 50];
  protected readonly sortLabelKeys: Record<SortOptionKey, string> = {
    'createdat:desc': 'patients.list.sort.newest',
    'createdat:asc': 'patients.list.sort.oldest',
    'lastname:asc': 'patients.list.sort.lastnameAsc',
    'lastname:desc': 'patients.list.sort.lastnameDesc',
    'firstname:asc': 'patients.list.sort.firstnameAsc',
    'firstname:desc': 'patients.list.sort.firstnameDesc',
  };

  protected readonly sortOptions: SortOptionKey[] = [
    'createdat:desc',
    'createdat:asc',
    'lastname:asc',
    'lastname:desc',
    'firstname:asc',
    'firstname:desc',
  ];

  protected patients: Patient[] = [];
  protected searchDossierNumber = '';
  protected searchLastname = '';
  protected searchFirstname = '';
  protected searchDateOfBirth = '';
  protected searchAge = '';
  protected selectedSort: SortOptionKey = 'createdat:desc';
  protected pageNumber = 1;
  protected pageSize = 10;
  protected totalCount = 0;
  protected isLoading = false;
  protected isExporting = false;
  protected consultationModalOpen = false;
  protected detailModalOpen = false;
  protected detailModalData: ConsultationDetailModalData | null = null;
  protected carepModalOpen = false;
  protected carepModalData: ConsultationCarepDetailModalData | null = null;
  protected deletingConsultationId: string | null = null;
  protected deletingPatientId: string | null = null;
  protected selectedPatientForConsultation: Patient | null = null;

  protected expandedPatientId: string | null = null;
  protected expandedConsultations: PatientConsultation[] = [];
  protected isExpandedLoading = false;
  protected expandedPageNumber = 1;
  protected expandedPageSize = 5;
  protected expandedTotalCount = 0;

  private sortBy: NonNullable<GetPatientsQuery['sortBy']> = 'createdat';
  private sortDirection: NonNullable<GetPatientsQuery['sortDirection']> = 'desc';
  private readonly searchChange$ = new Subject<void>();

  protected get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  protected get hasPatients(): boolean {
    return this.patients.length > 0;
  }

  protected get isDoctor(): boolean {
    return this.auth.hasAnyRole(['doctor']);
  }

  protected get fromItem(): number {
    if (!this.totalCount) {
      return 0;
    }
    return (this.pageNumber - 1) * this.pageSize + 1;
  }

  protected get toItem(): number {
    return Math.min(this.pageNumber * this.pageSize, this.totalCount);
  }

  protected get visiblePages(): number[] {
    if (!this.totalCount) {
      return [];
    }

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.pageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > this.totalPages) {
      endPage = this.totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  ngOnInit(): void {
    this.searchChange$
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.pageNumber = 1;
        this.loadPatients();
      });

    this.loadPatients();
  }

  protected onFilterChange(field: string, value: string): void {
    (this as any)[field] = value;

    if (field === 'searchDateOfBirth' && value.includes('/') && !value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return;
    }

    this.searchChange$.next();
  }

  protected clearFilters(): void {
    this.searchDossierNumber = '';
    this.searchLastname = '';
    this.searchFirstname = '';
    this.searchDateOfBirth = '';
    this.searchAge = '';
    this.pageNumber = 1;
    this.loadPatients();
  }

  protected onSortChange(value: SortOptionKey | string): void {
    this.selectedSort = value as SortOptionKey;
    const [sortBy, sortDirection] = value.split(':');
    if (!sortBy || (sortDirection !== 'asc' && sortDirection !== 'desc')) {
      return;
    }
    this.sortBy = sortBy as NonNullable<GetPatientsQuery['sortBy']>;
    this.sortDirection = sortDirection as NonNullable<GetPatientsQuery['sortDirection']>;
    this.pageNumber = 1;
    this.loadPatients();
  }

  protected onPageSizeChange(value: string | number): void {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return;
    }

    this.pageSize = parsed;
    this.pageNumber = 1;
    this.loadPatients();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.pageNumber) {
      return;
    }

    this.pageNumber = page;
    this.loadPatients();
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

  protected toggleExpand(event: Event, patientId: string): void {
    event.stopPropagation();
    if (this.expandedPatientId === patientId) {
      this.expandedPatientId = null;
      this.expandedConsultations = [];
    } else {
      this.expandedPatientId = patientId;
      this.expandedPageNumber = 1;
      this.loadExpandedConsultations(patientId);
    }
  }

  protected goToExpandedPage(page: number): void {
    if (!this.expandedPatientId || page < 1 || page > this.expandedTotalPages || page === this.expandedPageNumber) {
      return;
    }
    this.expandedPageNumber = page;
    this.loadExpandedConsultations(this.expandedPatientId);
  }

  protected get expandedTotalPages(): number {
    return Math.max(1, Math.ceil(this.expandedTotalCount / this.expandedPageSize));
  }

  protected get expandedVisiblePages(): number[] {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.expandedPageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > this.expandedTotalPages) {
      endPage = this.expandedTotalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  private loadExpandedConsultations(patientId: string): void {
    this.isExpandedLoading = true;
    this.patientService
      .getPatientConsultations(patientId, this.expandedPageNumber, this.expandedPageSize)
      .pipe(
        finalize(() => {
          this.isExpandedLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          this.expandedConsultations = res.consultations;
          this.expandedTotalCount = res.totalCount;
          this.cdr.detectChanges();
        },
        error: () => {
          this.expandedConsultations = [];
          this.expandedTotalCount = 0;
          this.toast.error(this.i18n.t('patients.details.loadConsultationsError'));
        },
      });
  }

  protected openDetailModal(patient: Patient, consultation: PatientConsultation): void {
    if (!patient || !consultation) {
      return;
    }

    this.detailModalData = {
      consultationId: consultation.id,
      patient,
      consultationDate: consultation.consultationDate,
      motifs: [...consultation.motifs],
      diagnostics: [...consultation.diagnostics],
      conduiteActions: [...consultation.conduiteActions],
    };
    this.detailModalOpen = true;
  }

  protected openCarepDetailModal(
    patient: Patient,
    consultation: PatientConsultation,
    actionLabel: string,
  ): void {
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
      return;
    }

    this.openDetailModal(patient, consultation);
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
    } else if (
      key.includes('chirurgie') ||
      key.includes('imagerie') ||
      key.includes('bilan sanguin') ||
      key.includes('bilan_sanguin')
    ) {
      documentType = 'paraclinique';
    }

    if (!documentType) {
      return;
    }

    const queryParams: Record<string, string> = {};
    if (documentType === 'paraclinique') {
      if (key.includes('chirurgie')) queryParams['sections'] = 'chirurgie';
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

  protected openConsultation(consultationId: string): void {
    if (!consultationId) {
      return;
    }
    const target = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultationId]),
    );
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

  protected canDeleteExpandedConsultation(consultation: PatientConsultation): boolean {
    if (this.isDoctor) {
      return true;
    }

    return consultation.isDone && !consultation.isTimerPaused;
  }

  protected deleteConsultation(consultation: PatientConsultation): void {
    if (!consultation?.id || this.deletingConsultationId === consultation.id || !this.canDeleteExpandedConsultation(consultation)) {
      return;
    }

    const confirmed = window.confirm(this.i18n.t('patients.details.history.confirmDelete'));
    if (!confirmed) {
      return;
    }

    this.deletingConsultationId = consultation.id;
    this.interrogatoireService
      .deleteConsultation(consultation.id)
      .pipe(
        finalize(() => {
          this.deletingConsultationId = null;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('patients.details.history.deleteSuccess'));
          if (this.expandedPatientId) {
            this.loadExpandedConsultations(this.expandedPatientId);
          }
          this.loadPatients();
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.details.history.deleteError'));
        },
      });
  }

  protected deletePatient(event: Event, patientId: string): void {
    event.stopPropagation();
    if (!patientId || this.deletingPatientId === patientId) {
      return;
    }

    const confirmed = window.confirm(this.i18n.t('patients.list.actions.confirmDelete'));
    if (!confirmed) {
      return;
    }

    this.deletingPatientId = patientId;
    this.patientService
      .deletePatient(patientId)
      .pipe(
        finalize(() => {
          this.deletingPatientId = null;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          if (this.expandedPatientId === patientId) {
            this.expandedPatientId = null;
            this.expandedConsultations = [];
            this.expandedTotalCount = 0;
          }
          this.toast.success(this.i18n.t('patients.list.actions.deleteSuccess'));
          this.loadPatients();
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.list.actions.deleteError'));
        },
      });
  }

  protected openPatientDetails(patientId: string): void {
    if (!patientId) {
      return;
    }
    this.router.navigate(['/patients', patientId]);
  }

  protected openConsultationModal(event: Event, patient: Patient): void {
    event.stopPropagation();
    if (!patient?.id) {
      return;
    }

    this.selectedPatientForConsultation = patient;
    this.consultationModalOpen = true;
  }

  protected closeConsultationModal(): void {
    this.consultationModalOpen = false;
    this.selectedPatientForConsultation = null;
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
    this.closeConsultationModal();
    this.toast.success(this.i18n.t('patients.list.newConsultation.success'));
  }

  protected exportPatientsCsv(): void {
    if (this.isExporting) {
      return;
    }

    const dobValue = this.searchDateOfBirth.trim();
    const isFullDate = /^\d{2}\/\d{2}\/\d{4}$/.test(dobValue);
    const isYearOnly = /^\d{4}$/.test(dobValue);
    const finalDob = (isFullDate || isYearOnly) ? dobValue : undefined;
    const dossierNum = this.parseIntegerFilter(this.searchDossierNumber, 1);
    const age = this.parseIntegerFilter(this.searchAge, 0);

    this.isExporting = true;
    this.patientService
      .exportPatientsCsv(
        undefined,
        finalDob,
        undefined,
        undefined,
        undefined,
        dossierNum,
        this.searchFirstname || undefined,
        this.searchLastname || undefined,
        age,
      )
      .pipe(
        finalize(() => {
          this.isExporting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (blob) => {
          const fileName = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
          const fileUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = fileUrl;
          anchor.download = fileName;
          anchor.click();
          URL.revokeObjectURL(fileUrl);

          this.toast.success(this.i18n.t('patients.list.export.success'));
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.list.export.error'));
        },
      });
  }

  private loadPatients(): void {
    this.isLoading = true;

    const dobValue = this.searchDateOfBirth.trim();
    const isFullDate = /^\d{2}\/\d{2}\/\d{4}$/.test(dobValue);
    const isYearOnly = /^\d{4}$/.test(dobValue);
    const finalDob = (isFullDate || isYearOnly) ? dobValue : undefined;
    const dossierNum = this.parseIntegerFilter(this.searchDossierNumber, 1);
    const age = this.parseIntegerFilter(this.searchAge, 0);

    const request$ = this.patientService.getAllPatients({
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      dateOfBirth: finalDob,
      firstname: this.searchFirstname || undefined,
      lastname: this.searchLastname || undefined,
      dossierNumber: dossierNum,
      age,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
    });

    request$
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.patients = response.patients;
          this.totalCount = response.totalCount;
          this.cdr.detectChanges();

          if (this.pageNumber > this.totalPages) {
            this.pageNumber = this.totalPages;
            this.loadPatients();
          }
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.list.loadError'));
          this.patients = [];
          this.totalCount = 0;
          this.cdr.detectChanges();
        },
      });
  }

  private parseIntegerFilter(value: string, minValue: number): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < minValue) {
      return undefined;
    }

    return parsed;
  }
}
