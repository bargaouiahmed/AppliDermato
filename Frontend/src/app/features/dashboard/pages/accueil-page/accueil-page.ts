import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { DailyConsultation, Patient, PatientConsultation } from '../../../../core/models/patient.models';
import { PatientService } from '../../../../core/services/patient.service';
import { AgendaService, Leave, Rdv } from '../../../../core/services/agenda.service';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ToastService } from '../../../../core/services/toast.service';
import { WaitingRoomRealtimeService } from '../../../../core/services/waiting-room-realtime.service';
import { ConsultationCreationGuardService } from '../../../../core/services/consultation-creation-guard.service';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import {
  ConsultationDetailModal,
  ConsultationDetailModalData,
} from '../../../../shared/components/consultation-detail-modal/consultation-detail-modal';
import {
  ConsultationCarepDetailModal,
  ConsultationCarepDetailModalData,
} from '../../../../shared/components/consultation-carep-detail-modal/consultation-carep-detail-modal';
import { ConsultationInitModal } from '../../../../shared/components/consultation-init-modal/consultation-init-modal';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { StatisticsModuleComponent } from '../../components/statistics-module/statistics-module.component';

interface CalendarCell {
  isoDate: string | null;
  dayNumber: number | null;
  inCurrentMonth: boolean;
  hasConsultation: boolean;
  isBlockedDay: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-accueil-page',
  standalone: true,
  imports: [
    CommonModule,
    ConsultationDetailModal,
    ConsultationCarepDetailModal,
    ConsultationInitModal,
    StatisticsModuleComponent,
    TranslatePipe,
  ],
  templateUrl: './accueil-page.html',
  styleUrls: ['./accueil-page.css'],
})
export class AccueilPage implements OnInit, OnDestroy {
  private readonly patientService = inject(PatientService);
  private readonly agendaService = inject(AgendaService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly waitingRoomRealtime = inject(WaitingRoomRealtimeService);
  private readonly consultationCreationGuard = inject(ConsultationCreationGuardService);
  private realtimeSubscription?: Subscription;

  protected consultations: DailyConsultation[] = [];
  protected dailyRdvs: Rdv[] = [];
  protected isLoading = false;
  protected isRdvLoading = false;
  protected loadError = '';
  protected rdvLoadError = '';
  protected currentDate = new Date();
  protected selectedDateIso = this.toIsoDate(new Date());
  protected readonly todayIso = this.toIsoDate(new Date());
  protected deletingConsultationId = '';
  protected consultationDeleteCandidate: DailyConsultation | null = null;

  protected isDateModalOpen = false;
  protected pickerYear = this.currentDate.getFullYear();
  protected pickerMonth = this.currentDate.getMonth() + 1;
  protected pickerYears: number[] = [];
  protected calendarCells: CalendarCell[] = [];
  protected monthDatesSet = new Set<string>();
  protected blockedDatesSet = new Set<string>();
  protected expandedPatientId: string | null = null;
  protected expandedConsultations: PatientConsultation[] = [];
  protected isExpandedLoading = false;
  protected expandedPageNumber = 1;
  protected expandedPageSize = 5;
  protected expandedTotalCount = 0;
  protected expandedDailyConsultation: DailyConsultation | null = null;
  protected expandedPatient: Patient | null = null;
  protected detailModalOpen = false;
  protected detailModalData: ConsultationDetailModalData | null = null;
  protected carepModalOpen = false;
  protected carepModalData: ConsultationCarepDetailModalData | null = null;
  protected isConsultationInitOpen = false;
  protected consultationInitPatientId = '';
  protected consultationInitMotifs: string[] = [];
  protected consultationInitDate = '';

  protected get localizedWeekdayLabels(): string[] {
    const formatter = new Intl.DateTimeFormat(this.getIntlLocale(), { weekday: 'narrow' });
    const baseMonday = new Date(Date.UTC(2024, 0, 1));
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(baseMonday.getTime() + (index * 24 * 60 * 60 * 1000))),
    );
  }

  protected get localizedMonthOptions(): Array<{ value: number; label: string }> {
    const formatter = new Intl.DateTimeFormat(this.getIntlLocale(), { month: 'long' });
    return Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: formatter.format(new Date(Date.UTC(2024, index, 1))),
    }));
  }

  protected readonly weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  protected readonly monthOptions = [
    { value: 1, label: 'janvier' },
    { value: 2, label: 'fevrier' },
    { value: 3, label: 'mars' },
    { value: 4, label: 'avril' },
    { value: 5, label: 'mai' },
    { value: 6, label: 'juin' },
    { value: 7, label: 'juillet' },
    { value: 8, label: 'aout' },
    { value: 9, label: 'septembre' },
    { value: 10, label: 'octobre' },
    { value: 11, label: 'novembre' },
    { value: 12, label: 'decembre' },
  ];

  protected get isToday(): boolean {
    return this.selectedDateIso === this.todayIso;
  }

  protected get isDoctor(): boolean {
    return this.auth.hasAnyRole(['doctor']);
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

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.pickerYears = Array.from({ length: 8 }, (_, idx) => currentYear - 5 + idx);
    this.loadConsultationsForDate(this.selectedDateIso);
    void this.waitingRoomRealtime.connect();
    this.realtimeSubscription = this.waitingRoomRealtime.updates$.subscribe(() => {
      this.refreshSelectedDateRealtime();
    });
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
    void this.waitingRoomRealtime.disconnect();
  }

  protected previousDate(): void {
    const previous = new Date(this.currentDate);
    previous.setDate(previous.getDate() - 1);
    this.loadConsultationsForDate(this.toIsoDate(previous));
  }

  protected nextDate(): void {
    if (this.isToday) {
      return;
    }

    const next = new Date(this.currentDate);
    next.setDate(next.getDate() + 1);
    const nextIso = this.toIsoDate(next);
    this.loadConsultationsForDate(nextIso > this.todayIso ? this.todayIso : nextIso);
  }

  protected selectToday(): void {
    this.loadConsultationsForDate(this.todayIso);
  }

  protected openDatePicker(): void {
    this.pickerYear = this.currentDate.getFullYear();
    this.pickerMonth = this.currentDate.getMonth() + 1;
    this.isDateModalOpen = true;
    this.loadMonthDates(this.pickerYear, this.pickerMonth);
  }

  protected closeDatePicker(): void {
    this.isDateModalOpen = false;
  }

  protected onPickerYearChange(value: string): void {
    const year = Number(value);
    if (!Number.isFinite(year)) {
      return;
    }

    this.pickerYear = year;
    this.loadMonthDates(this.pickerYear, this.pickerMonth);
  }

  protected onPickerMonthChange(value: string): void {
    const month = Number(value);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return;
    }

    this.pickerMonth = month;
    this.loadMonthDates(this.pickerYear, this.pickerMonth);
  }

  protected selectDateFromPicker(cell: CalendarCell): void {
    if (!cell.isoDate || cell.isBlockedDay) {
      return;
    }

    this.closeDatePicker();
    this.loadConsultationsForDate(cell.isoDate);
  }

  protected openConsultation(consultation: DailyConsultation): void {
    if (!consultation?.id || !this.canOpenConsultation(consultation)) {
      return;
    }

    this.router.navigate(['/consultations', consultation.id]);
  }

  protected canStartConsultationFromRdv(rdv: Rdv): boolean {
    return !rdv.isPersonnel && Boolean(rdv.patientId);
  }

  protected getRdvTrackKey(rdv: Rdv, index: number): string {
    return rdv.id ?? `${rdv.date}-${rdv.time}-${rdv.patientId ?? 'no-patient'}-${index}`;
  }

  protected getRdvLastname(rdv: Rdv): string {
    const lastname = rdv.patient?.lastname?.trim();
    if (lastname) {
      return lastname;
    }

    const patientName = rdv.patientName?.trim();
    if (!patientName) {
      return '-';
    }

    return patientName;
  }

  protected getRdvFirstname(rdv: Rdv): string {
    const firstname = rdv.patient?.firstname?.trim();
    return firstname || '-';
  }

  protected openGoToExamenFromRdv(rdv: Rdv): void {
    const patientId = rdv.patientId;
    if (!this.canStartConsultationFromRdv(rdv) || !patientId) {
      this.toast.error(this.i18n.t('agenda.errors.patientRequired'));
      return;
    }

    const motifs = rdv.motifs ?? [];

    if (motifs.length > 0) {
      const consultationDate = this.buildConsultationDateTime(rdv.date);
      this.consultationCreationGuard
        .hasSameDayConsultation(patientId, consultationDate.slice(0, 10))
        .subscribe({
          next: (hasSameDayConsultation) => {
            if (hasSameDayConsultation) {
              window.alert(this.i18n.t('consultation.creation.sameDayExists'));
              return;
            }

            this.interrogatoireService
              .initializeConsultation({ patientId, consultationDate, motifs })
              .subscribe({
                next: (response) => {
                  this.toast.success(this.i18n.t('patients.consultationModal.createSuccess'));
                  const url = this.router.serializeUrl(this.router.createUrlTree(['/consultations', response.consultationId]));
                  window.open(url, '_blank', 'noopener,noreferrer');
                },
                error: (error) => {
                  this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
                },
              });
          },
          error: () => {
            this.toast.error(this.i18n.t('common.error'));
          },
        });
      return;
    }

    this.consultationInitPatientId = patientId;
    this.consultationInitMotifs = [];
    this.consultationInitDate = rdv.date;
    this.isConsultationInitOpen = true;
  }

  protected onRdvConsultationCreated(consultationId: string): void {
    this.isConsultationInitOpen = false;
    if (consultationId) {
      const url = this.router.serializeUrl(this.router.createUrlTree(['/consultations', consultationId]));
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  protected toggleExpand(event: Event, consultation: DailyConsultation): void {
    event.stopPropagation();
    const patientId = consultation?.patientId;
    if (!patientId) {
      return;
    }

    if (this.expandedPatientId === patientId) {
      this.expandedPatientId = null;
      this.expandedConsultations = [];
      this.expandedTotalCount = 0;
      this.expandedDailyConsultation = null;
      this.expandedPatient = null;
      return;
    }

    this.expandedPatientId = patientId;
    this.expandedDailyConsultation = consultation;
    this.expandedPatient = this.buildFallbackPatient(consultation);
    this.expandedPageNumber = 1;
    this.loadExpandedConsultations(patientId);
    this.loadExpandedPatient(consultation);
  }

  protected goToExpandedPage(page: number): void {
    if (!this.expandedPatientId || page < 1 || page > this.expandedTotalPages || page === this.expandedPageNumber) {
      return;
    }
    this.expandedPageNumber = page;
    this.loadExpandedConsultations(this.expandedPatientId);
  }

  protected requestDeleteConsultation(consultation: DailyConsultation): void {
    if (!consultation?.id || !this.canDeleteConsultation(consultation)) {
      return;
    }

    this.consultationDeleteCandidate = consultation;
  }

  protected cancelDeleteConsultation(): void {
    this.consultationDeleteCandidate = null;
  }

  protected confirmDeleteConsultation(): void {
    const consultation = this.consultationDeleteCandidate;
    if (!consultation?.id || !this.canDeleteConsultation(consultation)) {
      this.consultationDeleteCandidate = null;
      return;
    }

    this.deletingConsultationId = consultation.id;
    this.interrogatoireService.deleteConsultation(consultation.id).subscribe({
      next: () => {
        this.consultations = this.consultations.filter((item) => item.id !== consultation.id);
        this.deletingConsultationId = '';
        this.consultationDeleteCandidate = null;
        if (this.expandedPatientId === consultation.patientId) {
          this.loadExpandedConsultations(consultation.patientId);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.deletingConsultationId = '';
        this.consultationDeleteCandidate = null;
        this.cdr.detectChanges();
      },
    });
  }

  protected statusLabel(status: string): string {
    if (status === 'consultation_completed') {
      return this.i18n.t('dashboard.daily.status.completed');
    }

    switch (status) {
      case 'consultation_paused':
        return this.i18n.t('dashboard.daily.status.paused');
      case 'consultation_en_cours':
        return this.i18n.t('dashboard.daily.status.inProgress');
      case 'consultation_completed':
        return this.i18n.t('dashboard.daily.status.completed');
      case 'consultation_not_started':
      case 'created':
      default:
        return this.i18n.t('dashboard.daily.status.pending');
    }
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'consultation_paused':
        return 'badge-paused';
      case 'consultation_en_cours':
        return 'badge-en-cours';
      case 'consultation_completed':
        return 'badge-completed';
      case 'consultation_not_started':
      case 'created':
      default:
        return 'badge-created';
    }
  }

  protected canOpenConsultation(consultation: DailyConsultation): boolean {
    return Boolean(consultation?.id);
  }

  protected getLocalizedOpenConsultationTitle(consultation: DailyConsultation): string {
    switch (consultation.status) {
      case 'consultation_completed':
        return this.i18n.t('accueil.daily.actions.editConsultation');
      case 'consultation_paused':
      case 'consultation_en_cours':
        return this.i18n.t('accueil.daily.actions.resumeConsultation');
      case 'consultation_not_started':
      case 'created':
      default:
        return this.i18n.t('accueil.daily.actions.startConsultation');
    }
  }

  protected getOpenConsultationTitle(consultation: DailyConsultation): string {
    return this.getLocalizedOpenConsultationTitle(consultation);
  }

  protected formatLongDate(value: Date | string): string {
    const lang = this.i18n.lang();
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar-TN' : 'en-US';
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  protected canDeleteConsultation(consultation: DailyConsultation): boolean {
    if (this.isDoctor) {
      return true;
    }

    return consultation.status !== 'consultation_en_cours' && consultation.status !== 'consultation_paused';
  }

  protected canDeleteHistoryConsultation(consultation: PatientConsultation): boolean {
    if (this.isDoctor) {
      return true;
    }

    return consultation.isDone && !consultation.isTimerPaused;
  }

  protected openConsultationFromHistory(consultationId: string): void {
    if (!consultationId) {
      return;
    }
    const target = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultationId]),
    );
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  protected openDetailModal(consultation: PatientConsultation): void {
    if (!consultation) {
      return;
    }

    this.detailModalData = {
      consultationId: consultation.id,
      patient: this.expandedPatient,
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
      return;
    }

    this.openDetailModal(consultation);
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
      key.includes('laser') ||
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

  protected deleteHistoryConsultation(consultation: PatientConsultation): void {
    if (!consultation?.id || !this.canDeleteHistoryConsultation(consultation) || this.deletingConsultationId === consultation.id) {
      return;
    }

    this.deletingConsultationId = consultation.id;
    this.interrogatoireService.deleteConsultation(consultation.id).subscribe({
      next: () => {
        if (this.expandedPatientId) {
          this.loadExpandedConsultations(this.expandedPatientId);
        }
        this.deletingConsultationId = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.deletingConsultationId = '';
        this.cdr.detectChanges();
      },
    });
  }

  protected closeDetailModal(): void {
    this.detailModalOpen = false;
    this.detailModalData = null;
  }

  protected closeCarepDetailModal(): void {
    this.carepModalOpen = false;
    this.carepModalData = null;
  }

  private refreshSelectedDateRealtime(): void {
    this.loadConsultationsForDate(this.selectedDateIso, true);
  }

  private loadConsultationsForDate(dateIso: string, preserveExpandedState = false): void {
    this.isLoading = true;
    this.loadError = '';
    this.cdr.detectChanges();

    this.patientService.getDailyConsultations(dateIso).subscribe({
      next: (response) => {
        const effectiveDate = response.date || dateIso;
        this.selectedDateIso = effectiveDate;
        this.currentDate = new Date(`${effectiveDate}T00:00:00`);
        this.loadRdvsForDate(effectiveDate);
        this.consultations = [...(response.consultations ?? [])].sort((a, b) =>
          a.consultationDate.localeCompare(b.consultationDate),
        );
        if (!preserveExpandedState) {
          this.expandedPatientId = null;
          this.expandedConsultations = [];
          this.expandedTotalCount = 0;
          this.expandedDailyConsultation = null;
          this.expandedPatient = null;
        } else if (this.expandedPatientId) {
          const matchingConsultation = this.consultations.find(
            (consultation) => consultation.patientId === this.expandedPatientId,
          );

          if (matchingConsultation) {
            this.expandedDailyConsultation = matchingConsultation;
            this.expandedPatient = this.expandedPatient
              ? { ...this.expandedPatient, ...this.buildFallbackPatient(matchingConsultation) }
              : this.buildFallbackPatient(matchingConsultation);
            this.loadExpandedConsultations(this.expandedPatientId);
            this.loadExpandedPatient(matchingConsultation);
          } else {
            this.expandedPatientId = null;
            this.expandedConsultations = [];
            this.expandedTotalCount = 0;
            this.expandedDailyConsultation = null;
            this.expandedPatient = null;
          }
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.consultations = [];
        this.loadError = this.i18n.t('accueil.daily.loadError');
        this.loadRdvsForDate(this.selectedDateIso);
        if (!preserveExpandedState) {
          this.expandedPatientId = null;
          this.expandedConsultations = [];
          this.expandedTotalCount = 0;
          this.expandedDailyConsultation = null;
          this.expandedPatient = null;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadRdvsForDate(dateIso: string): void {
    const monthPrefix = dateIso.slice(0, 7);
    this.isRdvLoading = true;
    this.rdvLoadError = '';
    this.cdr.detectChanges();

    this.agendaService.getRdvsByMonth(monthPrefix).subscribe({
      next: (rdvs) => {
        this.dailyRdvs = (rdvs ?? [])
          .filter((rdv) => !rdv.isPersonnel && rdv.date === dateIso)
          .sort((left, right) => left.time.localeCompare(right.time));
        this.isRdvLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.dailyRdvs = [];
        this.rdvLoadError = this.i18n.t('agenda.errors.rdvsLoad');
        this.isRdvLoading = false;
        this.cdr.detectChanges();
      },
    });
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
          this.cdr.detectChanges();
        },
      });
  }

  private loadExpandedPatient(consultation: DailyConsultation): void {
    if (!consultation?.patientId) {
      return;
    }

    const fallbackPatient = this.buildFallbackPatient(consultation);
    this.patientService.getPatientById(consultation.patientId).subscribe({
      next: (patient) => {
        if (this.expandedPatientId === consultation.patientId) {
          this.expandedPatient = patient;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        if (this.expandedPatientId === consultation.patientId) {
          this.expandedPatient = fallbackPatient;
          this.cdr.detectChanges();
        }
      },
    });
  }

  private loadMonthDates(year: number, month: number): void {
    forkJoin({
      consultationDates: this.patientService.getConsultationDates(year, month).pipe(
        catchError(() => of({ dates: [] as string[] })),
      ),
      leaves: this.agendaService.getLeavesByYear(String(year)).pipe(
        catchError(() => of([] as Leave[])),
      ),
    }).subscribe({
      next: ({ consultationDates, leaves }) => {
        this.monthDatesSet = new Set(consultationDates.dates ?? []);
        this.blockedDatesSet = new Set(
          (leaves ?? [])
            .map((leave) => leave.date)
            .filter((date) => this.isDateInMonth(date, year, month)),
        );
        this.buildCalendar();
        this.cdr.detectChanges();
      },
      error: () => {
        this.monthDatesSet = new Set<string>();
        this.blockedDatesSet = new Set<string>();
        this.buildCalendar();
        this.cdr.detectChanges();
      },
    });
  }

  private buildCalendar(): void {
    const firstDay = new Date(this.pickerYear, this.pickerMonth - 1, 1);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(this.pickerYear, this.pickerMonth, 0).getDate();

    const cells: CalendarCell[] = [];

    for (let i = 0; i < startDay; i++) {
      cells.push({
        isoDate: null,
        dayNumber: null,
        inCurrentMonth: false,
        hasConsultation: false,
        isBlockedDay: false,
        isToday: false,
        isSelected: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(this.pickerYear, this.pickerMonth - 1, day);
      const isoDate = this.toIsoDate(dayDate);
      cells.push({
        isoDate,
        dayNumber: day,
        inCurrentMonth: true,
        hasConsultation: this.monthDatesSet.has(isoDate),
        isBlockedDay: this.blockedDatesSet.has(isoDate),
        isToday: isoDate === this.todayIso,
        isSelected: isoDate === this.selectedDateIso,
      });
    }

    const totalCells = Math.ceil(cells.length / 7) * 7;
    while (cells.length < totalCells) {
      cells.push({
        isoDate: null,
        dayNumber: null,
        inCurrentMonth: false,
        hasConsultation: false,
        isBlockedDay: false,
        isToday: false,
        isSelected: false,
      });
    }

    this.calendarCells = cells;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isDateInMonth(isoDate: string, year: number, month: number): boolean {
    if (!isoDate || isoDate.length !== 10) {
      return false;
    }

    return isoDate.startsWith(`${year}-${String(month).padStart(2, '0')}-`);
  }

  private getIntlLocale(): string {
    const lang = this.i18n.lang();
    if (lang === 'fr') return 'fr-FR';
    if (lang === 'ar') return 'ar-TN';
    return 'en-US';
  }

  private buildConsultationDateTime(dateIso: string): string {
    const now = new Date();
    const date = new Date(`${dateIso}T00:00:00`);
    date.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

  private buildFallbackPatient(consultation: DailyConsultation): Patient {
    return {
      id: consultation.patientId,
      dossierNumber: consultation.patientDossierNumber,
      consultationCount: consultation.patientConsultationCount,
      firstname: consultation.patientFirstname,
      lastname: consultation.patientLastname,
      dateOfBirth: '',
      phoneNumber: '',
      country: '',
      profession: consultation.patientProfession ?? '',
      workPlace: '',
      sex: '',
      familialStatus: '',
      city: '',
      address: '',
      postalCode: '',
      email: '',
      apci: '',
      insuranceType: '',
      insuranceEstablishment: '',
    };
  }

  navigateToPatient(patientId: string | number | null | undefined, event: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (patientId) {
      this.router.navigate(['/patients', patientId]);
    }
  }
}
