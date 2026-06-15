import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';
import { ConsultationConduiteResponse } from '../../../../../../../core/models/conduite.models';
import {
  ConsultationExamPayload,
  createDefaultConsultationExamPayload,
} from '../../../../../../../core/models/exam.models';
import {
  ConsultationInterrogatoireResponse,
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../../core/models/interrogatoire.models';
import { Patient, PatientConsultation } from '../../../../../../../core/models/patient.models';
import { ConduiteService } from '../../../../../../../core/services/conduite.service';
import { ExamService } from '../../../../../../../core/services/exam.service';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../../../../core/services/interrogatoire.service';
import { PatientService } from '../../../../../../../core/services/patient.service';
import { ConsultationConclusionReportComponent } from '../consultation-conclusion-report.component';
import {
  ConsultationConclusionViewModel,
  buildConsultationConclusionViewModel,
} from '../consultation-conclusion.helpers';

type LoadedHistoryBundle = {
  consultationDate: string;
  motifs: string[];
  diagnostics: string[];
  anomalies: UpdateInterrogatoireAnomalyRequest[];
  ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[];
  examPayload: ConsultationExamPayload;
  conduite: ConsultationConduiteResponse;
};

@Component({
  selector: 'app-consultation-conclusion-history-sidebar',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConsultationConclusionReportComponent],
  templateUrl: './consultation-conclusion-history-sidebar.component.html',
  styleUrl: './consultation-conclusion-history-sidebar.component.css',
})
export class ConsultationConclusionHistorySidebarComponent implements OnChanges {
  @Input() consultationId: string | null = null;
  @Input() patientId: string | null = null;
  @Input() patient: Patient | null = null;
  @Input() canAccessExam = false;
  @Input() showToggle = true;
  @Input() drawerMode = false;

  private readonly patientService = inject(PatientService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly examService = inject(ExamService);
  private readonly conduiteService = inject(ConduiteService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected isCollapsed = false;
  protected isHistoryLoading = false;
  protected historyLoadError = '';
  protected previousConsultations: PatientConsultation[] = [];
  protected pageNumber = 1;
  protected readonly pageSize = 6;
  protected totalCount = 0;
  protected isPreviewLoading = false;
  protected previewLoadError = '';
  protected selectedHistoryConsultationId: string | null = null;
  protected selectedHistoryViewModel: ConsultationConclusionViewModel | null = null;

  private readonly historyCache = new Map<string, LoadedHistoryBundle>();
  private selectedHistoryBundle: LoadedHistoryBundle | null = null;

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.rebuildSelectedHistoryViewModel();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showToggle'] && !this.showToggle) {
      this.isCollapsed = false;
    }

    if (changes['consultationId'] || changes['patientId']) {
      this.resetSelection();
      this.historyCache.clear();
      this.previousConsultations = [];
      this.totalCount = 0;

      const nextPatientId = this.patientId?.trim() ?? '';
      if (!nextPatientId) {
        this.resetHistoryState();
        return;
      }

      this.pageNumber = 1;
      this.loadHistoryPage(nextPatientId, this.pageNumber);
      return;
    }

    if (changes['patient']) {
      this.rebuildSelectedHistoryViewModel();
    }
  }

  protected get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  protected get toggleIconClass(): string {
    return this.isCollapsed ? 'bi bi-chevron-left' : 'bi bi-chevron-right';
  }

  protected get hasPreviousConsultations(): boolean {
    return this.previousConsultations.length > 0;
  }

  protected toggleCollapsed(): void {
    if (!this.showToggle) {
      return;
    }

    this.isCollapsed = !this.isCollapsed;
  }

  protected changePage(direction: -1 | 1): void {
    const nextPatientId = this.patientId?.trim() ?? '';
    const nextPage = this.pageNumber + direction;
    if (!nextPatientId || nextPage < 1 || nextPage > this.totalPages || this.isHistoryLoading) {
      return;
    }

    this.pageNumber = nextPage;
    this.loadHistoryPage(nextPatientId, nextPage);
  }

  protected toggleHistoryCard(consultation: PatientConsultation): void {
    if (this.isPreviewLoading) {
      return;
    }

    if (this.selectedHistoryConsultationId === consultation.id) {
      this.resetSelection();
      return;
    }

    const cachedBundle = this.historyCache.get(consultation.id);
    if (cachedBundle) {
      this.selectedHistoryConsultationId = consultation.id;
      this.selectedHistoryBundle = cachedBundle;
      this.previewLoadError = '';
      this.rebuildSelectedHistoryViewModel();
      return;
    }

    this.loadHistoryPreview(consultation);
  }

  private loadHistoryPage(patientId: string, pageNumber: number): void {
    this.isHistoryLoading = true;
    this.historyLoadError = '';

    this.patientService
      .getPatientConsultations(patientId, pageNumber, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if ((this.patientId?.trim() ?? '') !== patientId) {
            return;
          }

          const currentConsultationId = this.consultationId?.trim() ?? '';
          this.previousConsultations = (response.consultations ?? []).filter(
            (consultation) => consultation.id !== currentConsultationId,
          );
          this.totalCount = Math.max(
            this.previousConsultations.length,
            response.totalCount - (currentConsultationId ? 1 : 0),
          );
          this.isHistoryLoading = false;

          if (
            this.selectedHistoryConsultationId &&
            !this.previousConsultations.some(
              (consultation) => consultation.id === this.selectedHistoryConsultationId,
            )
          ) {
            this.resetSelection();
          }
        },
        error: () => {
          if ((this.patientId?.trim() ?? '') !== patientId) {
            return;
          }

          this.isHistoryLoading = false;
          this.previousConsultations = [];
          this.totalCount = 0;
          this.historyLoadError = 'consultation.page.conclusion.sidebar.historyLoadError';
        },
      });
  }

  private loadHistoryPreview(consultation: PatientConsultation): void {
    this.isPreviewLoading = true;
    this.previewLoadError = '';
    this.selectedHistoryConsultationId = consultation.id;
    this.selectedHistoryViewModel = null;
    this.selectedHistoryBundle = null;

    const examRequest = this.canAccessExam
      ? this.examService.getConsultationExam(consultation.id).pipe(
          catchError(() =>
            of({
              consultationId: consultation.id,
              payload: createDefaultConsultationExamPayload(),
            }),
          ),
        )
      : of({
          consultationId: consultation.id,
          payload: createDefaultConsultationExamPayload(),
        });

    forkJoin({
      interrogation: this.interrogatoireService.getConsultationInterrogatoire(consultation.id),
      exam: examRequest,
      conduite: this.conduiteService.getConsultationConduite(consultation.id).pipe(
        catchError(() => of({ consultationId: consultation.id, additionalInformation: '', actions: [] })),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ interrogation, exam, conduite }) => {
          if (this.selectedHistoryConsultationId !== consultation.id) {
            return;
          }

          const bundle = this.createLoadedHistoryBundle(interrogation, exam?.payload, conduite);
          this.historyCache.set(consultation.id, bundle);
          this.selectedHistoryBundle = bundle;
          this.isPreviewLoading = false;
          this.previewLoadError = '';
          this.rebuildSelectedHistoryViewModel();
        },
        error: () => {
          if (this.selectedHistoryConsultationId !== consultation.id) {
            return;
          }

          this.isPreviewLoading = false;
          this.previewLoadError = 'consultation.page.conclusion.sidebar.historyPreviewError';
          this.selectedHistoryViewModel = null;
          this.selectedHistoryBundle = null;
        },
      });
  }

  private createLoadedHistoryBundle(
    interrogation: ConsultationInterrogatoireResponse,
    examPayload: ConsultationExamPayload | null | undefined,
    conduite: ConsultationConduiteResponse | null | undefined,
  ): LoadedHistoryBundle {
    return {
      consultationDate: interrogation.consultationDate,
      motifs: [...(interrogation.motifs ?? [])],
      diagnostics: [...(interrogation.diagnostics ?? [])],
      anomalies: (interrogation.anomalies ?? []).map((anomaly, index) => ({
        section: anomaly.section,
        isCustom: anomaly.isCustom,
        templateKey: anomaly.templateKey,
        sortOrder: anomaly.sortOrder ?? index,
        payload: anomaly.payload,
      })),
      ongoingTreatments: (interrogation.ongoingTreatments ?? []).map((item) => ({
        medicine: item.medicine ?? '',
        therapeuticClass: item.therapeuticClass ?? '',
        category: item.category ?? '',
        posology: item.posology ?? '',
        duration: item.duration ?? '',
        date: item.date ?? '',
      })),
      examPayload: examPayload ?? createDefaultConsultationExamPayload(),
      conduite: conduite ?? {
        consultationId: interrogation.consultationId,
        additionalInformation: '',
        actions: [],
      },
    };
  }

  private rebuildSelectedHistoryViewModel(): void {
    if (!this.selectedHistoryBundle || !this.selectedHistoryConsultationId) {
      this.selectedHistoryViewModel = null;
      return;
    }

    this.selectedHistoryViewModel = buildConsultationConclusionViewModel({
      patient: this.patient,
      consultationDate: this.selectedHistoryBundle.consultationDate,
      motifs: this.selectedHistoryBundle.motifs,
      diagnostics: this.selectedHistoryBundle.diagnostics,
      anomalies: this.selectedHistoryBundle.anomalies,
      ongoingTreatments: this.selectedHistoryBundle.ongoingTreatments,
      examPayload: this.selectedHistoryBundle.examPayload,
      conduite: this.selectedHistoryBundle.conduite,
      locale: this.resolveIntlLocale(),
      translate: (key) => this.i18n.t(key),
    });
  }

  private resolveIntlLocale(): string {
    const lang = this.i18n.lang();
    if (lang === 'ar') {
      return 'ar-TN';
    }
    if (lang === 'en') {
      return 'en-US';
    }
    return 'fr-FR';
  }

  private resetSelection(): void {
    this.selectedHistoryConsultationId = null;
    this.selectedHistoryViewModel = null;
    this.selectedHistoryBundle = null;
    this.previewLoadError = '';
    this.isPreviewLoading = false;
  }

  private resetHistoryState(): void {
    this.isHistoryLoading = false;
    this.historyLoadError = '';
    this.previousConsultations = [];
    this.totalCount = 0;
    this.pageNumber = 1;
    this.historyCache.clear();
    this.resetSelection();
  }
}
