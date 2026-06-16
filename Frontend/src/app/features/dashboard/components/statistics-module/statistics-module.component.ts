import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { Patient } from '../../../../core/models/patient.models';
import {
  StatisticsBucket,
  StatisticsConsultationSection,
  StatisticsOverview,
  StatisticsOverviewQuery,
  StatisticsPatient,
  StatisticsPatientConsultation,
  StatisticsPatientSection,
} from '../../../../core/models/statistics.models';
import { AuthService } from '../../../../core/services/auth.service';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { StatisticsService } from '../../../../core/services/statistics.service';
import { I18nService } from '../../../../core/services/i18n.service';
import {
  ConsultationCarepDetailModal,
  ConsultationCarepDetailModalData,
} from '../../../../shared/components/consultation-carep-detail-modal/consultation-carep-detail-modal';
import {
  ConsultationDetailModal,
  ConsultationDetailModalData,
} from '../../../../shared/components/consultation-detail-modal/consultation-detail-modal';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-statistics-module',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent, ConsultationDetailModal, ConsultationCarepDetailModal, TranslatePipe],
  templateUrl: './statistics-module.component.html',
  styleUrl: './statistics-module.component.css',
})
export class StatisticsModuleComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly statisticsService = inject(StatisticsService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private loadRequestId = 0;

  protected overview: StatisticsOverview | null = null;
  protected diagnosticCatalog: string[] = [];
  protected isLoading = false;
  protected errorMessage = '';
  protected isPatientStatsOpen = false;
  protected carouselDirection: 'next' | 'prev' = 'next';
  protected expandedPatientId = '';
  protected detailModalOpen = false;
  protected detailModalData: ConsultationDetailModalData | null = null;
  protected carepModalOpen = false;
  protected carepModalData: ConsultationCarepDetailModalData | null = null;
  protected deletingConsultationId = '';
  protected filters: StatisticsOverviewQuery = {
    period: 'this_week',
    startDate: '',
    endDate: '',
    diagnostics: [],
    sex: '',
    ageGroup: '',
    cnamStatus: '',
    pageNumber: 1,
    pageSize: 10,
  };

  protected readonly periodOptions = [
    { value: 'all_time', labelKey: 'statistics.period.allTime' },
    { value: 'this_week', labelKey: 'statistics.period.thisWeek' },
    { value: 'this_month', labelKey: 'statistics.period.thisMonth' },
    { value: 'this_year', labelKey: 'statistics.period.thisYear' },
    { value: 'custom', labelKey: 'statistics.period.custom' },
  ];

  protected readonly ageGroupOptions = [
    { value: '', labelKey: 'statistics.age.all' },
    { value: 'children', labelKey: 'statistics.age.children' },
    { value: 'teenagers', labelKey: 'statistics.age.teenagers' },
    { value: 'young_adults', labelKey: 'statistics.age.youngAdults' },
    { value: 'adults', labelKey: 'statistics.age.adults' },
    { value: 'seniors', labelKey: 'statistics.age.seniors' },
  ];

  protected readonly sexOptions = [
    { value: '', labelKey: 'statistics.options.all' },
    { value: 'Femme', labelKey: 'statistics.sex.female' },
    { value: 'Homme', labelKey: 'statistics.sex.male' },
  ];

  protected readonly cnamOptions = [
    { value: '', labelKey: 'statistics.options.all' },
    { value: 'with', labelKey: 'statistics.labels.withCnam' },
    { value: 'without', labelKey: 'statistics.labels.withoutCnam' },
  ];

  protected readonly pageSizeOptions = [5, 10, 20, 50];

  protected get consultationStats(): StatisticsConsultationSection | null {
    return this.overview?.consultationStatistics ?? null;
  }

  protected get patientStats(): StatisticsPatientSection | null {
    return this.overview?.patientStatistics ?? null;
  }

  protected get patientTotalPages(): number {
    return Math.max(1, this.patientStats?.pagination.totalPages ?? 1);
  }

  protected get patientVisiblePages(): number[] {
    const totalPages = this.patientTotalPages;
    const currentPage = this.filters.pageNumber ?? 1;
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  protected get patientRangeStart(): number {
    const stats = this.patientStats;
    if (!stats || stats.pagination.totalCount === 0) return 0;
    return ((stats.pagination.pageNumber - 1) * stats.pagination.pageSize) + 1;
  }

  protected get patientRangeEnd(): number {
    const stats = this.patientStats;
    if (!stats) return 0;
    return Math.min(stats.pagination.totalCount, stats.pagination.pageNumber * stats.pagination.pageSize);
  }

  protected get isDoctor(): boolean {
    return this.auth.hasAnyRole(['doctor']);
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  protected loadInitialData(): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    forkJoin({
      overview: this.statisticsService.getOverview(this.normalizedFilters()),
      diagnostics: this.statisticsService.getDiagnosticsCatalog().pipe(catchError(() => of([] as string[]))),
    })
      .pipe(finalize(() => this.finishLoading(requestId)))
      .subscribe({
        next: ({ overview, diagnostics }) => {
          if (requestId !== this.loadRequestId) return;
          this.overview = overview;
          this.diagnosticCatalog = diagnostics;
          this.syncPaginationFromResponse();
          this.cdr.detectChanges();
        },
        error: (error) => this.handleLoadError(error, requestId),
      });
  }

  protected loadStatistics(): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.statisticsService.getOverview(this.normalizedFilters())
      .pipe(finalize(() => this.finishLoading(requestId)))
      .subscribe({
        next: (overview) => {
          if (requestId !== this.loadRequestId) return;
          this.overview = overview;
          this.syncPaginationFromResponse();
          this.cdr.detectChanges();
        },
        error: (error) => this.handleLoadError(error, requestId),
      });
  }

  protected resetFilters(): void {
    this.filters = {
      period: 'this_week',
      startDate: '',
      endDate: '',
      diagnostics: [],
      sex: '',
      ageGroup: '',
      cnamStatus: '',
      pageNumber: 1,
      pageSize: this.filters.pageSize ?? 10,
    };
    this.expandedPatientId = '';
    this.loadStatistics();
    this.cdr.detectChanges();
  }

  protected removeDiagnostic(diagnostic: string): void {
    this.filters.diagnostics = (this.filters.diagnostics ?? []).filter((item) => item !== diagnostic);
    this.onPatientFilterChange();
  }

  protected onPatientFilterChange(): void {
    this.filters.pageNumber = 1;
    this.expandedPatientId = '';
    this.loadStatistics();
    this.cdr.detectChanges();
  }

  protected onConsultationFilterChange(): void {
    this.loadStatistics();
    this.cdr.detectChanges();
  }

  protected onPeriodChange(): void {
    if (this.filters.period !== 'custom') {
      this.filters.startDate = '';
      this.filters.endDate = '';
    } else if (!this.filters.startDate && !this.filters.endDate) {
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      this.filters.startDate = this.toIsoDate(start);
      this.filters.endDate = this.toIsoDate(today);
    }

    this.onConsultationFilterChange();
  }

  protected goToPatientPage(page: number): void {
    if (page < 1 || page > this.patientTotalPages || page === this.filters.pageNumber) return;
    this.filters.pageNumber = page;
    this.expandedPatientId = '';
    this.loadStatistics();
  }

  protected onPageSizeChange(): void {
    this.filters.pageNumber = 1;
    this.expandedPatientId = '';
    this.loadStatistics();
  }

  protected showPatientStats(): void {
    this.carouselDirection = 'next';
    this.isPatientStatsOpen = true;
    this.cdr.detectChanges();
  }

  protected showConsultationStats(): void {
    this.carouselDirection = 'prev';
    this.isPatientStatsOpen = false;
    this.cdr.detectChanges();
  }

  protected togglePatient(patient: StatisticsPatient): void {
    this.expandedPatientId = this.expandedPatientId === patient.id ? '' : patient.id;
    this.cdr.detectChanges();
  }

  protected openConsultation(consultationId: string): void {
    if (!consultationId) return;
    window.open(this.router.serializeUrl(this.router.createUrlTree(['/consultations', consultationId])), '_blank', 'noopener,noreferrer');
  }

  protected openConsultationDocuments(consultationId: string): void {
    if (!consultationId) return;
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultationId], { queryParams: { tab: 'documents' } }),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected openDetailModal(patient: StatisticsPatient, consultation: StatisticsPatientConsultation): void {
    this.detailModalData = {
      consultationId: consultation.id,
      patient: this.toPatient(patient),
      consultationDate: consultation.consultationDate,
      motifs: [...consultation.motifs],
      diagnostics: [...consultation.diagnostics],
      conduiteActions: [...consultation.conduiteActions],
    };
    this.detailModalOpen = true;
    this.cdr.detectChanges();
  }

  protected openCarepDetailModal(patient: StatisticsPatient, consultation: StatisticsPatientConsultation, actionLabel: string): void {
    if (!actionLabel) return;
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

    if (!isCarep) {
      this.openDetailModal(patient, consultation);
      return;
    }

    this.carepModalData = {
      consultationId: consultation.id,
      actionKey: actionLabel,
      actionLabel,
    };
    this.carepModalOpen = true;
    this.cdr.detectChanges();
  }

  protected printAction(consultation: StatisticsPatientConsultation, actionLabel: string): void {
    const key = actionLabel.toLowerCase().trim();
    let documentType = '';

    if (key.includes('ordonnance')) documentType = 'ordonnance';
    else if (key.includes('certificat')) documentType = 'certificat';
    else if (key.includes('lettre')) documentType = 'lettre_confrere';
    else if (key.includes('cnam')) documentType = 'cnam';
    else if (key.includes('chirurgie') || key.includes('laser') || key.includes('imagerie') || key.includes('bilan sanguin') || key.includes('bilan_sanguin')) documentType = 'paraclinique';
    if (!documentType) return;

    const queryParams: Record<string, string> = {};
    if (documentType === 'paraclinique') {
      if (key.includes('chirurgie')) queryParams['sections'] = 'chirurgie';
      else if (key.includes('laser')) queryParams['sections'] = 'laser';
      else if (key.includes('imagerie')) queryParams['sections'] = 'imagerie';
      else if (key.includes('bilan sanguin') || key.includes('bilan_sanguin')) queryParams['sections'] = 'bilan_sanguin';
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultation.id, 'print', documentType], { queryParams }),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected canDeleteConsultation(consultation: StatisticsPatientConsultation): boolean {
    if (this.isDoctor) {
      return true;
    }

    return consultation.isDone && !consultation.isTimerPaused;
  }

  protected deleteConsultation(consultation: StatisticsPatientConsultation): void {
    if (!consultation.id || !this.canDeleteConsultation(consultation) || this.deletingConsultationId === consultation.id) return;
    this.deletingConsultationId = consultation.id;
    this.interrogatoireService.deleteConsultation(consultation.id)
      .pipe(finalize(() => {
        this.deletingConsultationId = '';
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => this.loadStatistics(),
      });
  }

  protected closeDetailModal(): void {
    this.detailModalOpen = false;
    this.detailModalData = null;
    this.cdr.detectChanges();
  }

  protected closeCarepDetailModal(): void {
    this.carepModalOpen = false;
    this.carepModalData = null;
    this.cdr.detectChanges();
  }

  protected selectedTimeBuckets(): StatisticsBucket[] {
    return this.consultationStats?.timeline ?? [];
  }

  protected chartGranularityLabelKey(): string {
    switch (this.consultationStats?.chartGranularity) {
      case 'day':
        return 'statistics.granularity.day';
      case 'week':
        return 'statistics.granularity.week';
      case 'month':
        return 'statistics.granularity.month';
      case 'year':
        return 'statistics.granularity.year';
      default:
        return 'statistics.granularity.period';
    }
  }

  protected periodLabelKey(): string {
    const value = this.filters.period || 'all_time';
    return this.periodOptions.find((option) => option.value === value)?.labelKey ?? 'statistics.period.allTime';
  }

  protected maxCount(items: StatisticsBucket[]): number {
    return Math.max(1, ...items.map((item) => item.count));
  }

  protected barWidth(count: number, items: StatisticsBucket[]): number {
    return Math.max(3, Math.round((count / this.maxCount(items)) * 100));
  }

  protected barHeight(count: number, items: StatisticsBucket[]): number {
    if (count <= 0) return 0;
    return Math.max(8, Math.round((count / this.maxCount(items)) * 100));
  }

  protected percentage(count: number, total: number): string {
    if (total <= 0) return '0%';
    return `${Math.round((count / total) * 100)}%`;
  }

  protected percentageLabel(value: number | undefined): string {
    return `${Number(value ?? 0).toFixed(1).replace('.0', '')}%`;
  }

  protected distributionLabelKey(label: string): string {
    const normalized = label.trim().toLowerCase();
    switch (normalized) {
      case 'femme':
        return 'statistics.sex.female';
      case 'homme':
        return 'statistics.sex.male';
      case 'non renseigne':
        return 'statistics.options.unspecified';
      case '0-12 ans':
        return 'statistics.age.children';
      case '13-17 ans':
        return 'statistics.age.teenagers';
      case '18-39 ans':
        return 'statistics.age.youngAdults';
      case '40-64 ans':
        return 'statistics.age.adults';
      case '65+ ans':
        return 'statistics.age.seniors';
      default:
        return label;
    }
  }

  protected completionRate(): string {
    const stats = this.consultationStats;
    if (!stats || stats.totalConsultations <= 0) return '0%';
    return this.percentage(stats.completedConsultations, stats.totalConsultations);
  }

  protected patientDiagnosticRate(): string {
    const stats = this.patientStats;
    if (!stats || stats.totalPatients <= 0) return '0%';
    return this.percentage(stats.patientsWithDiagnostics, stats.totalPatients);
  }

  private normalizedFilters(): StatisticsOverviewQuery {
    return {
      period: this.filters.period || 'all_time',
      startDate: this.filters.period === 'custom' ? this.filters.startDate || undefined : undefined,
      endDate: this.filters.period === 'custom' ? this.filters.endDate || undefined : undefined,
      diagnostics: this.normalizeDiagnosticSelection(this.filters.diagnostics),
      sex: this.filters.sex?.trim() || undefined,
      ageGroup: this.filters.ageGroup?.trim() || undefined,
      cnamStatus: this.filters.cnamStatus?.trim() || undefined,
      pageNumber: this.filters.pageNumber ?? 1,
      pageSize: this.filters.pageSize ?? 10,
    };
  }

  private normalizeDiagnosticSelection(diagnostics: string[] | undefined): string[] {
    return [...new Set((diagnostics ?? []).map((item) => item.trim()).filter(Boolean))];
  }

  private syncPaginationFromResponse(): void {
    const pagination = this.patientStats?.pagination;
    if (!pagination) return;
    this.filters.pageNumber = pagination.pageNumber;
    this.filters.pageSize = pagination.pageSize;
  }

  private finishLoading(requestId: number): void {
    if (requestId !== this.loadRequestId) return;
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private handleLoadError(error: unknown, requestId: number): void {
    if (requestId !== this.loadRequestId) return;
    this.errorMessage = this.extractErrorMessage(error) || this.i18n.t('statistics.errors.load');
    this.cdr.detectChanges();
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractErrorMessage(error: unknown): string {
    const candidate = error as { error?: { message?: string; Message?: string } | string; message?: string };
    if (typeof candidate.error === 'string') return candidate.error;
    if (candidate.error && typeof candidate.error === 'object') {
      return candidate.error.message || candidate.error.Message || '';
    }
    return candidate.message || '';
  }

  private toPatient(patient: StatisticsPatient): Patient {
    return {
      id: patient.id,
      dossierNumber: patient.dossierNumber,
      consultationCount: patient.matchingConsultationCount,
      firstname: patient.firstname,
      lastname: patient.lastname,
      dateOfBirth: '',
      phoneNumber: '',
      country: '',
      profession: '',
      workPlace: '',
      sex: patient.sex,
      familialStatus: '',
      city: '',
      address: '',
      postalCode: '',
      email: '',
      apci: '',
      insuranceType: patient.insuranceType,
      insuranceEstablishment: patient.insuranceEstablishment,
    };
  }
}
