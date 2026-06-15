import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, finalize, interval, map, of, Subject, switchMap } from 'rxjs';
import {
  NgNotFoundTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import {
  ConsultationInterrogatoireResponse,
  InterrogatoireAnomalyResponse,
  UpdateConsultationDataRequest,
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../core/models/interrogatoire.models';
import { ConsultationConduiteResponse } from '../../../../core/models/conduite.models';
import { ConsultationExamPayload, createDefaultConsultationExamPayload } from '../../../../core/models/exam.models';
import { Patient } from '../../../../core/models/patient.models';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ConsultationAiRealtimeEvent,
  ConsultationAiRealtimeService,
} from '../../../../core/services/consultation-ai-realtime.service';
import { DoctorMotifService } from '../../../../core/services/doctor-motif.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { PatientService } from '../../../../core/services/patient.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConsultationInterrogatoireSectionComponent } from './sections/interrogatoire/consultation-interrogatoire-section.component';
import { ConsultationExamenSectionComponent } from './sections/examen/consultation-examen-section.component';
import { ConsultationConduiteSectionComponent } from './sections/conduite/consultation-conduite-section.component';
import { ConsultationConclusionSectionComponent } from './sections/conclusion/consultation-conclusion-section.component';
import { ConsultationConclusionCurrentSidebarComponent } from './sections/conclusion/components/consultation-conclusion-current-sidebar.component';
import { ConsultationConclusionHistorySidebarComponent } from './sections/conclusion/components/consultation-conclusion-history-sidebar.component';
import { ConsultationDocumentsSectionComponent } from './sections/documents/consultation-documents-section.component';

type ConsultationTab =
  | 'interrogatoire'
  | 'examen'
  | 'conduite'
  | 'conclusion'
  | 'documents';

type MotifOption = {
  nom: string;
  value: string;
  isDeletable: boolean;
};

@Component({
  selector: 'app-consultation-interrogatoire-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgNotFoundTemplateDirective,
    TranslatePipe,
    ConsultationInterrogatoireSectionComponent,
    ConsultationExamenSectionComponent,
    ConsultationConduiteSectionComponent,
    ConsultationConclusionSectionComponent,
    ConsultationConclusionCurrentSidebarComponent,
    ConsultationConclusionHistorySidebarComponent,
    ConsultationDocumentsSectionComponent,
  ],
  templateUrl: './consultation-interrogatoire-page.html',
  styleUrl: './consultation-interrogatoire-page.css',
})
export class ConsultationInterrogatoirePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly consultationAiRealtime = inject(ConsultationAiRealtimeService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly patientService = inject(PatientService);
  private readonly doctorMotifService = inject(DoctorMotifService);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected consultation: ConsultationInterrogatoireResponse | null = null;
  protected readonly canAccessExam = this.authService.hasAnyRole(['doctor', 'admin', 'super_admin']);
  protected patient: Patient | null = null;
  protected isLoading = false;
  protected isFinishing = false;
  protected loadError = '';
  protected activeTab: ConsultationTab = 'interrogatoire';
  protected elapsedDurationDisplay = '00:00:00';
  protected isTimerPaused = false;
  protected currentTime = new Date();
  protected motifList: MotifOption[] = [];
  protected selectedMotif: string | null = null;
  protected selectedMotifs: string[] = [];
  protected isLeftSidebarOpen = false;
  protected isRightSidebarOpen = false;
  protected conduiteFocusActionKey: string | null = null;
  protected conduiteFocusRequestId = 0;
  protected currentExamPayload: ConsultationExamPayload | null = null;
  protected currentConduite: ConsultationConduiteResponse | null = null;
  private elapsedDurationSeconds = 0;
  private runningSinceMs: number | null = null;
  private runningBaseSeconds = 0;
  private lastPersistedSeconds = 0;
  private readonly autosaveTrigger = new Subject<string>();
  private pendingInterrogatoireAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private pendingOngoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  private pendingDiagnostics: string[] = [];
  private lastAutosaveToastAt = 0;

  protected get interrogatoireAnomalies(): UpdateInterrogatoireAnomalyRequest[] {
    return this.pendingInterrogatoireAnomalies;
  }

  protected get ongoingTreatments(): UpdateOngoingTreatmentMedicineRequest[] {
    return this.pendingOngoingTreatments;
  }

  protected get diagnostics(): string[] {
    return this.pendingDiagnostics;
  }

  protected get hasElapsedDuration(): boolean {
    return this.elapsedDurationSeconds > 0;
  }

  protected get isConsultationRunning(): boolean {
    return !!this.consultation && !this.consultation.isDone && !this.isTimerPaused;
  }

  protected get showStartConsultationAction(): boolean {
    return !!this.consultation && !this.consultation.isDone && this.isTimerPaused && !this.hasElapsedDuration;
  }

  protected get showResumeConsultationAction(): boolean {
    return !!this.consultation && !this.consultation.isDone && this.isTimerPaused && this.hasElapsedDuration;
  }

  protected readonly tabs: Array<{ key: ConsultationTab; labelKey: string; iconClass: string }> = [
    {
      key: 'interrogatoire',
      labelKey: 'consultation.page.tabs.interrogatoire',
      iconClass: 'bi bi-chat-dots',
    },
    { key: 'examen', labelKey: 'consultation.page.tabs.examen', iconClass: 'bi bi-activity' },
    { key: 'conduite', labelKey: 'consultation.page.tabs.conduite', iconClass: 'bi bi-flag' },
    {
      key: 'conclusion',
      labelKey: 'consultation.page.tabs.conclusion',
      iconClass: 'bi bi-check2-circle',
    },
    {
      key: 'documents',
      labelKey: 'consultation.page.tabs.documents',
      iconClass: 'fa fa-plus-square',
    },
  ];

  protected get visibleTabs(): Array<{ key: ConsultationTab; labelKey: string; iconClass: string }> {
    return this.tabs.filter((tab) => tab.key !== 'examen' || this.canAccessExam);
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('consultationId')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((consultationId) => {
        if (!consultationId) {
          return;
        }
        this.loadConsultationPage(consultationId);
      });

    this.route.queryParamMap
      .pipe(
        map((params) => this.resolveRequestedTab(params.get('tab'))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((requestedTab) => {
        this.activeTab = requestedTab;
      });

    void this.consultationAiRealtime.connect();
    this.consultationAiRealtime.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.handleConsultationAiEvent(event);
      });

    interval(250)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentTime = new Date();
        this.tickDuration();
      });

    this.autosaveTrigger
      .pipe(
        debounceTime(550),
        distinctUntilChanged(),
        switchMap(() => {
          const request = this.buildConsultationDataRequest();
          if (!this.consultation?.consultationId || !request) {
            return of(null);
          }

          return this.interrogatoireService
            .updateConsultationData(this.consultation.consultationId, request)
            .pipe(
              map(() => ({ ok: true as const })),
              catchError(() => of({ ok: false as const })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }

        if (!result.ok) {
          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
          return;
        }

        const now = Date.now();
        if (now - this.lastAutosaveToastAt > 2200) {
          this.lastAutosaveToastAt = now;
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
        }
      });
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight') return;

    const activeEl = document.activeElement as HTMLInputElement | null;
    if (!activeEl || activeEl.tagName !== 'INPUT') return;

    const ngSelectEl = activeEl.closest('ng-select') as HTMLElement | null;
    if (!ngSelectEl || !ngSelectEl.classList.contains('ng-select-opened')) return;

    // Use global query since dropdown panel might be appended to body
    const markedOption = document.querySelector('.ng-dropdown-panel .ng-option-marked') as HTMLElement | null;
    if (!markedOption) return;

    const labelEl = markedOption.querySelector('.ng-option-label') || markedOption;
    const markedText = (labelEl.textContent || '').trim();
    if (!markedText) return;

    const currentValue = activeEl.value || '';
    if (markedText.toLowerCase().startsWith(currentValue.toLowerCase()) && markedText.length > currentValue.length) {
      event.preventDefault();
      event.stopPropagation();

      activeEl.value = markedText;
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));

      try {
        activeEl.setSelectionRange(markedText.length, markedText.length);
      } catch {
        // ignore
      }
    }
  }

  protected selectTab(tab: ConsultationTab): void {
    if (tab === 'examen' && !this.canAccessExam) {
      return;
    }

    this.activeTab = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.syncTabQueryParam(tab);
  }

  private handleConsultationAiEvent(event: ConsultationAiRealtimeEvent): void {
    const currentConsultationId = this.consultation?.consultationId?.trim().toLowerCase();
    const eventConsultationId = event.consultationId?.trim().toLowerCase();
    if (!currentConsultationId || currentConsultationId !== eventConsultationId) {
      return;
    }

    if ((event.actionKey ?? '').toLowerCase() !== 'lettre_confrere') {
      return;
    }

    const status = (event.status ?? '').toLowerCase();
    if (status === 'completed') {
      this.toastService.success(this.i18n.t('consultation.conduite.lettreConfrere.ai.completed'));
      this.conduiteFocusActionKey = 'lettre_confrere';
      this.conduiteFocusRequestId += 1;
      this.selectTab('conduite');
      return;
    }

    if (status === 'failed') {
      this.toastService.error(
        event.error?.trim() || this.i18n.t('consultation.conduite.lettreConfrere.ai.failed'),
      );
    }
  }

  protected toggleSidebar(side: 'left' | 'right'): void {
    if (side === 'left') {
      const next = !this.isLeftSidebarOpen;
      this.isLeftSidebarOpen = next;
      this.isRightSidebarOpen = false;
      return;
    }

    const next = !this.isRightSidebarOpen;
    this.isRightSidebarOpen = next;
    this.isLeftSidebarOpen = false;
  }

  protected closeSidebars(): void {
    this.isLeftSidebarOpen = false;
    this.isRightSidebarOpen = false;
  }

  protected openHistorySidebar(): void {
    this.isLeftSidebarOpen = false;
    this.isRightSidebarOpen = true;
  }

  protected openPatientDetailsInNewTab(): void {
    const patientId = this.patient?.id?.trim();
    if (!patientId) {
      return;
    }

    const target = this.router.serializeUrl(
      this.router.createUrlTree(['/patients', patientId]),
    );
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  private resolveRequestedTab(value: string | null): ConsultationTab {
    const normalized = (value ?? '').trim().toLowerCase();

    if (normalized === 'documents') {
      return 'documents';
    }

    if (normalized === 'conclusion') {
      return 'conclusion';
    }

    if (normalized === 'conduite') {
      return 'conduite';
    }

    if (normalized === 'examen' && this.canAccessExam) {
      return 'examen';
    }

    return 'interrogatoire';
  }

  private syncTabQueryParam(tab: ConsultationTab): void {
    const currentTab = this.route.snapshot.queryParamMap.get('tab');
    const nextTab = tab === 'interrogatoire' ? null : tab;
    if ((currentTab ?? null) === nextTab) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: nextTab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected get patientMotifs(): string[] {
    if (this.selectedMotifs.length > 0) {
      return this.selectedMotifs;
    }

    return this.consultation?.motifs ?? [];
  }

  protected getMotifList(): void {
    const predefined = this.doctorMotifService.getPredefinedMotifs().map((nom) => ({
      nom,
      value: nom,
      isDeletable: false,
    }));

    const custom = this.doctorMotifService.getCustomMotifs().map((nom) => ({
      nom,
      value: nom,
      isDeletable: true,
    }));

    const fromConsultation = this.patientMotifs.map((nom) => ({
      nom,
      value: nom,
      isDeletable: false,
    }));

    const byNormalized = new Map<string, MotifOption>();
    for (const item of [...predefined, ...custom, ...fromConsultation]) {
      const key = this.normalizeMotif(item.nom);
      if (!key || byNormalized.has(key)) {
        continue;
      }

      byNormalized.set(key, item);
    }

    this.motifList = [...byNormalized.values()].sort((a, b) =>
      a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }),
    );
  }

  protected addInputMotif(event: unknown): string {
    const motif = this.extractMotifLabel(event);
    if (!motif) {
      return '';
    }

    const normalized = this.normalizeMotif(motif);
    if (!this.patientMotifs.some((item) => this.normalizeMotif(item) === normalized)) {
      this.selectedMotifs = [...this.patientMotifs, motif];
      this.queueConsultationAutosave();
    }

    if (!this.motifList.some((item) => this.normalizeMotif(item.nom) === normalized)) {
      this.doctorMotifService.addCustomMotif(motif);
      this.getMotifList();
    }

    this.selectedMotif = null;
    return motif;
  }

  protected removeMotif(motif: string): void {
    const normalized = this.normalizeMotif(motif);
    this.selectedMotifs = this.patientMotifs.filter(
      (item) => this.normalizeMotif(item) !== normalized,
    );
    this.queueConsultationAutosave();
  }

  protected deleteMotif(item: MotifOption, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    if (!item.isDeletable) {
      return;
    }

    this.doctorMotifService.removeCustomMotif(item.nom);
    this.selectedMotifs = this.patientMotifs.filter(
      (motif) => this.normalizeMotif(motif) !== this.normalizeMotif(item.nom),
    );
    this.getMotifList();
    this.queueConsultationAutosave();
  }

  protected onInterrogatoireAnomaliesChange(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.pendingInterrogatoireAnomalies = [...(anomalies ?? [])].map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    this.queueConsultationAutosave();
  }

  protected onInterrogatoireTreatmentsChange(treatments: UpdateOngoingTreatmentMedicineRequest[]): void {
    this.pendingOngoingTreatments = [...(treatments ?? [])].map((item) => ({
      medicine: this.normalizeFreeText(item.medicine),
      therapeuticClass: this.normalizeFreeText(item.therapeuticClass),
      category: this.normalizeFreeText(item.category),
      posology: this.normalizeFreeText(item.posology),
      duration: this.normalizeFreeText(item.duration),
      date: this.normalizeFreeText(item.date),
    }));

    this.queueConsultationAutosave();
  }

  protected onDiagnosticsChange(diagnostics: string[]): void {
    this.pendingDiagnostics = this.normalizeDiagnostics(diagnostics);
    this.queueConsultationAutosave();
  }

  protected onExamPayloadChange(payload: ConsultationExamPayload): void {
    this.currentExamPayload = this.cloneExamPayload(payload);
  }

  protected onConduiteChange(conduite: ConsultationConduiteResponse): void {
    this.currentConduite = {
      consultationId: conduite.consultationId,
      additionalInformation: conduite.additionalInformation ?? '',
      actions: [...(conduite.actions ?? [])].map((action) => ({
        ...action,
        payload: { ...(action.payload ?? {}) },
      })),
    };
  }

  protected startConsultation(): void {
    if (!this.showStartConsultationAction) {
      return;
    }

    this.runConsultationTimer();
  }

  protected resumeConsultation(): void {
    if (!this.showResumeConsultationAction) {
      return;
    }

    this.runConsultationTimer();
  }

  protected pauseConsultation(): void {
    if (!this.isConsultationRunning) {
      return;
    }

    this.refreshElapsedFromRuntimeClock();
    if (!this.hasElapsedDuration) {
      this.elapsedDurationSeconds = 1;
      this.elapsedDurationDisplay = this.formatDuration(this.elapsedDurationSeconds);
    }
    this.isTimerPaused = true;
    this.syncRuntimeClock();
    this.persistTimerState({ navigateToAccueil: true });
  }

  protected finishExam(): void {
    if (!this.consultation || this.consultation.isDone || this.isFinishing) {
      return;
    }

    this.pendingDiagnostics = this.normalizeDiagnostics(this.pendingDiagnostics);
    if (this.pendingDiagnostics.length === 0) {
      this.toastService.error(this.i18n.t('consultation.page.toast.diagnosticRequired'));
      this.selectTab('conduite');
      return;
    }

    const request = this.buildConsultationDataRequest();
    if (!request) {
      this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
      return;
    }

    this.refreshElapsedFromRuntimeClock();
    this.isFinishing = true;

    this.interrogatoireService
      .updateConsultationData(this.consultation.consultationId, request)
      .pipe(
        switchMap(() => this.interrogatoireService.updateConsultationTimer(this.consultation!.consultationId, {
          durationSeconds: this.elapsedDurationSeconds,
          isTimerPaused: true,
          isDone: true,
        })),
        finalize(() => {
          this.isFinishing = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (!this.consultation) {
            return;
          }

          this.isTimerPaused = true;
          this.consultation.isDone = true;
          this.syncRuntimeClock();
          void this.router.navigate(['/patients']);
        },
        error: (error) => {
          const backendMessage = typeof error?.error === 'string' ? error.error.trim() : '';
          if (backendMessage.toLowerCase().includes('diagnostic')) {
            this.toastService.error(this.i18n.t('consultation.page.toast.diagnosticRequired'));
            this.selectTab('conduite');
            return;
          }

          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
        },
      });
  }

  protected get localizedConsultationDate(): string {
    const rawValue = this.consultation?.consultationDate;
    if (!rawValue) {
      return '-';
    }

    const value = new Date(rawValue);
    if (Number.isNaN(value.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat(this.getIntlLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(value);
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

  private loadConsultationPage(consultationId: string): void {
    this.isLoading = true;
    this.loadError = '';
    this.consultation = null;
    this.patient = null;
    this.isTimerPaused = false;
    this.motifList = [];
    this.selectedMotif = null;
    this.selectedMotifs = [];
    this.closeSidebars();
    this.elapsedDurationSeconds = 0;
    this.elapsedDurationDisplay = '00:00:00';
    this.runningSinceMs = null;
    this.runningBaseSeconds = 0;
    this.lastPersistedSeconds = 0;
    this.pendingInterrogatoireAnomalies = [];
    this.pendingOngoingTreatments = [];
    this.pendingDiagnostics = [];
    this.currentExamPayload = null;
    this.currentConduite = null;

    if (!this.canAccessExam && this.activeTab === 'examen') {
      this.activeTab = 'interrogatoire';
    }

    this.interrogatoireService
      .getConsultationInterrogatoire(consultationId)
      .pipe(
        switchMap((consultation) => {
          this.consultation = consultation;
          this.selectedMotifs = [...(consultation.motifs ?? [])];
          this.getMotifList();
          this.syncDurationFromBackend(consultation.duration);
          this.isTimerPaused = consultation.isTimerPaused || consultation.isDone;
          this.pendingInterrogatoireAnomalies = this.mapResponseAnomaliesToUpdate(consultation.anomalies ?? [])
            .filter((item) => !this.isFunctionalSignAnomaly(item));
          this.pendingOngoingTreatments = this.mapResponseTreatmentsToUpdate(consultation.ongoingTreatments ?? []);
          this.pendingDiagnostics = this.normalizeDiagnostics(consultation.diagnostics ?? []);
          this.syncRuntimeClock();

          if (!consultation.patientId) {
            return of(null);
          }

          return this.patientService.getPatientById(consultation.patientId).pipe(
            catchError(() => of(null)),
          );
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (patient) => {
          this.patient = patient;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadError = 'consultation.page.loadError';
          this.cdr.detectChanges();
        },
      });
  }

  private tickDuration(): void {
    if (!this.consultation || this.consultation.isDone || this.isTimerPaused) {
      this.syncRuntimeClock();
      this.cdr.detectChanges();
      return;
    }

    this.syncRuntimeClock();
    this.refreshElapsedFromRuntimeClock();

    // In some runtime configurations, async ticks do not trigger a render pass automatically.
    // Forcing a detect here keeps the timer moving without requiring user interaction.
    this.cdr.detectChanges();

    if (this.elapsedDurationSeconds > 0 && this.elapsedDurationSeconds % 5 === 0 && this.elapsedDurationSeconds != this.lastPersistedSeconds) {
      this.lastPersistedSeconds = this.elapsedDurationSeconds;
      this.persistTimerState();
    }
  }

  private syncDurationFromBackend(duration: string): void {
    this.elapsedDurationSeconds = this.parseDurationSeconds(duration);
    this.lastPersistedSeconds = this.elapsedDurationSeconds;
    this.elapsedDurationDisplay = this.formatDuration(this.elapsedDurationSeconds);
  }

  private syncRuntimeClock(): void {
    const shouldRun = !!this.consultation && !this.consultation.isDone && !this.isTimerPaused;
    if (!shouldRun) {
      this.runningSinceMs = null;
      this.runningBaseSeconds = this.elapsedDurationSeconds;
      return;
    }

    if (this.runningSinceMs === null) {
      this.runningSinceMs = Date.now();
      this.runningBaseSeconds = this.elapsedDurationSeconds;
    }
  }

  private refreshElapsedFromRuntimeClock(): void {
    if (this.runningSinceMs === null) {
      return;
    }

    const elapsedFromAnchor = Math.floor((Date.now() - this.runningSinceMs) / 1000);
    const nextValue = Math.max(this.runningBaseSeconds, this.runningBaseSeconds + elapsedFromAnchor);
    this.elapsedDurationSeconds = nextValue;
    this.elapsedDurationDisplay = this.formatDuration(this.elapsedDurationSeconds);
  }

  private getIntlLocale(): string {
    const lang = this.i18n.lang();
    if (lang === 'fr') return 'fr-FR';
    if (lang === 'ar') return 'ar-TN';
    return 'en-US';
  }

  private parseDurationSeconds(duration: string): number {
    if (!duration || !duration.trim()) {
      return 0;
    }

    const [hoursRaw, minutesRaw, secondsRaw] = duration.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if ([hours, minutes, seconds].some((item) => Number.isNaN(item))) {
      return 0;
    }

    return Math.max(0, (hours * 3600) + (minutes * 60) + seconds);
  }

  private formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  private runConsultationTimer(): void {
    if (!this.consultation || this.consultation.isDone) {
      return;
    }

    this.isTimerPaused = false;
    this.syncRuntimeClock();
    this.persistTimerState();
  }

  private persistTimerState(options?: { isDone?: boolean; navigateToAccueil?: boolean }): void {
    if (!this.consultation?.consultationId) {
      return;
    }

    if (options?.isDone) {
      this.consultation.isDone = true;
      this.isTimerPaused = true;
    }

    this.interrogatoireService
      .updateConsultationTimer(this.consultation.consultationId, {
        durationSeconds: this.elapsedDurationSeconds,
        isTimerPaused: this.isTimerPaused,
        isDone: this.consultation.isDone,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (options?.navigateToAccueil) {
            void this.router.navigate(['/accueil']);
          }
        },
        error: () => {
          // Keep UX responsive even if persistence fails; next tick will retry.
        },
      });
  }

  private extractMotifLabel(event: unknown): string {
    if (typeof event === 'string') {
      return event.trim();
    }

    const item = event as { nom?: string; value?: string } | null;
    if (!item) {
      return '';
    }

    if (typeof item.nom === 'string' && item.nom.trim()) {
      return item.nom.trim();
    }

    if (typeof item.value === 'string' && item.value.trim()) {
      return item.value.trim();
    }

    return '';
  }

  private normalizeMotif(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private queueConsultationAutosave(): void {
    if (!this.consultation?.consultationId) {
      return;
    }

    const request = this.buildConsultationDataRequest();
    if (!request) {
      return;
    }

    this.autosaveTrigger.next(JSON.stringify(request));
  }

  private buildConsultationDataRequest(): UpdateConsultationDataRequest | null {
    if (!this.consultation) {
      return null;
    }

    const motifs = this.patientMotifs.filter((motif) => !!motif?.trim());
    if (motifs.length === 0) {
      return null;
    }

    return {
      motifs,
      histoireMaladie: '',
      diagnostics: this.normalizeDiagnostics(this.pendingDiagnostics),
      anomalies: this.pendingInterrogatoireAnomalies.map((item, sortOrder) => ({
        section: item.section,
        isCustom: item.isCustom,
        templateKey: item.templateKey,
        sortOrder,
        payload: item.payload,
      })),
      ongoingTreatments: this.pendingOngoingTreatments
        .map((item) => ({
          medicine: this.normalizeFreeText(item.medicine),
          therapeuticClass: this.normalizeFreeText(item.therapeuticClass),
          category: this.normalizeFreeText(item.category),
          posology: this.normalizeFreeText(item.posology),
          duration: this.normalizeFreeText(item.duration),
          date: this.normalizeFreeText(item.date),
        })),
    };
  }

  private mapResponseAnomaliesToUpdate(
    anomalies: InterrogatoireAnomalyResponse[],
  ): UpdateInterrogatoireAnomalyRequest[] {
    return [...anomalies]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item, sortOrder) => ({
        section: item.section,
        isCustom: item.isCustom,
        templateKey: item.templateKey,
        sortOrder,
        payload: item.payload,
      }));
  }

  private mapResponseTreatmentsToUpdate(
    treatments: Array<{
      medicine: string;
      therapeuticClass: string;
      category: string;
      posology: string;
      duration: string;
      date: string;
    }>,
  ): UpdateOngoingTreatmentMedicineRequest[] {
    return (treatments ?? []).map((item) => ({
      medicine: this.normalizeFreeText(item.medicine),
      therapeuticClass: this.normalizeFreeText(item.therapeuticClass),
      category: this.normalizeFreeText(item.category),
      posology: this.normalizeFreeText(item.posology),
      duration: this.normalizeFreeText(item.duration),
      date: this.normalizeFreeText(item.date),
    }));
  }

  private normalizeFreeText(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .trim()
      .replace(/\s+/g, ' ');
  }

  private cloneExamPayload(payload: ConsultationExamPayload | null | undefined): ConsultationExamPayload {
    const fallback = createDefaultConsultationExamPayload();
    const source = payload ?? fallback;
    return JSON.parse(JSON.stringify(source)) as ConsultationExamPayload;
  }

  private isFunctionalSignAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
    return (item.templateKey ?? '').trim().toLowerCase().startsWith('functional-sign-');
  }

  private normalizeDiagnostics(values: string[] | null | undefined): string[] {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = this.normalizeDiagnosticLabel(value);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(normalized);
    }

    return result;
  }

  private normalizeDiagnosticLabel(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    let normalized = value.trim().replace(/\s+/g, ' ');
    normalized = normalized.replace(/^add item\s*/i, '').trim();

    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith('\'') && normalized.endsWith('\''))) {
      normalized = normalized.slice(1, -1).trim();
    } else if (normalized.startsWith('"') || normalized.startsWith('\'')) {
      normalized = normalized.slice(1).trim();
    }

    return normalized;
  }
}
