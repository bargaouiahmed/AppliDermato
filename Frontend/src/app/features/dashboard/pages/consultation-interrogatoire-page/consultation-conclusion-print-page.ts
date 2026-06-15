import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, AfterViewChecked, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import {
  ConsultationConduiteResponse,
} from '../../../../core/models/conduite.models';
import {
  createDefaultConsultationExamPayload,
} from '../../../../core/models/exam.models';
import {
  ConsultationInterrogatoireResponse,
  InterrogatoireAnomalyResponse,
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../core/models/interrogatoire.models';
import { Patient } from '../../../../core/models/patient.models';
import { ConduiteService } from '../../../../core/services/conduite.service';
import { ExamService } from '../../../../core/services/exam.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { PatientService } from '../../../../core/services/patient.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  ConsultationConclusionViewModel,
  buildConsultationConclusionViewModel,
} from './sections/conclusion/consultation-conclusion.helpers';
import { ConsultationConclusionReportComponent } from './sections/conclusion/consultation-conclusion-report.component';

@Component({
  selector: 'app-consultation-conclusion-print-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConsultationConclusionReportComponent],
  templateUrl: './consultation-conclusion-print-page.html',
  styleUrl: './consultation-conclusion-print-page.css',
})
export class ConsultationConclusionPrintPage implements OnInit, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly patientService = inject(PatientService);
  private readonly examService = inject(ExamService);
  private readonly conduiteService = inject(ConduiteService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected isLoading = true;
  protected errorMessage = '';
  protected viewModel: ConsultationConclusionViewModel | null = null;

  private consultation: ConsultationInterrogatoireResponse | null = null;
  private patientData: Patient | null = null;
  private examPayload = createDefaultConsultationExamPayload();
  private conduite: ConsultationConduiteResponse = {
    consultationId: '',
    additionalInformation: '',
    actions: [],
  };
  private hasAutoPrinted = false;

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.rebuildViewModel();
    });
  }

  ngOnInit(): void {
    const consultationId = (this.route.snapshot.paramMap.get('consultationId') ?? '').trim();
    if (!consultationId) {
      this.isLoading = false;
      this.errorMessage = this.i18n.t('consultation.documents.toast.consultationNotFound');
      return;
    }

    this.interrogatoireService
      .getConsultationInterrogatoire(consultationId)
      .pipe(
        switchMap((consultation) =>
          forkJoin({
            consultation: of(consultation),
            patient: consultation.patientId
              ? this.patientService.getPatientById(consultation.patientId).pipe(catchError(() => of(null as Patient | null)))
              : of(null as Patient | null),
            exam: this.examService.getConsultationExam(consultationId).pipe(
              catchError(() => of({ consultationId, payload: createDefaultConsultationExamPayload() })),
            ),
            conduite: this.conduiteService.getConsultationConduite(consultationId).pipe(
              catchError(() => of({
                consultationId,
                additionalInformation: '',
                actions: [] as ConsultationConduiteResponse['actions'],
              })),
            ),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ consultation, patient, exam, conduite }) => {
          this.consultation = consultation;
          this.patientData = patient;
          this.examPayload = exam?.payload ?? createDefaultConsultationExamPayload();
          this.conduite = conduite ?? {
            consultationId,
            additionalInformation: '',
            actions: [],
          };
          this.isLoading = false;
          this.errorMessage = '';

          try {
            this.rebuildViewModel();
            this.queueAutoPrint();
          } catch (error) {
            console.error('Failed to build consultation conclusion print view', error);
            this.viewModel = null;
            this.errorMessage = this.i18n.t('consultation.page.conclusion.loadError');
          }

          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = this.i18n.t('consultation.page.conclusion.loadError');
          this.cdr.detectChanges();
        },
      });
  }

  ngAfterViewChecked(): void {
    if (!this.hasAutoPrinted || this.isLoading || !this.viewModel) {
      return;
    }

    if (!this.hasPrintableContent()) {
      return;
    }

    this.hasAutoPrinted = false;
    this.runPrintAfterPaint();
  }

  protected retry(): void {
    window.print();
  }

  private rebuildViewModel(): void {
    if (!this.consultation) {
      this.viewModel = null;
      return;
    }

    this.viewModel = buildConsultationConclusionViewModel({
      patient: this.patientData,
      consultationDate: this.consultation.consultationDate,
      motifs: Array.isArray(this.consultation.motifs) ? this.consultation.motifs : [],
      diagnostics: Array.isArray(this.consultation.diagnostics) ? this.consultation.diagnostics : [],
      anomalies: this.mapResponseAnomaliesToUpdate(
        Array.isArray(this.consultation.anomalies) ? this.consultation.anomalies : [],
      ),
      ongoingTreatments: this.mapTreatmentsToUpdate(this.consultation),
      examPayload: this.examPayload,
      conduite: this.conduite,
      locale: this.resolveIntlLocale(),
      translate: (key) => this.i18n.t(key),
    });
  }

  private queueAutoPrint(): void {
    if (this.hasAutoPrinted) {
      return;
    }

    this.hasAutoPrinted = true;
  }

  private hasPrintableContent(): boolean {
    const printableSheet = document.querySelector('.print-shell .conclusion-sheet');
    const loadingCard = document.querySelector('.print-shell > .state-card:not(.error)');
    return (
      !loadingCard
      && printableSheet instanceof HTMLElement
      && printableSheet.offsetHeight > 0
      && printableSheet.innerText.trim().length > 0
    );
  }

  private runPrintAfterPaint(): void {
    const print = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.print();
        });
      });
    };

    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) {
      void fonts.ready.then(() => window.setTimeout(print, 120));
      return;
    }

    window.setTimeout(print, 120);
  }

  private mapResponseAnomaliesToUpdate(
    anomalies: InterrogatoireAnomalyResponse[],
  ): UpdateInterrogatoireAnomalyRequest[] {
    return [...(Array.isArray(anomalies) ? anomalies : [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, sortOrder) => ({
        section: item.section,
        isCustom: item.isCustom,
        templateKey: item.templateKey,
        sortOrder,
        payload: item.payload,
      }));
  }

  private mapTreatmentsToUpdate(
    consultation: ConsultationInterrogatoireResponse,
  ): UpdateOngoingTreatmentMedicineRequest[] {
    const treatments = Array.isArray(consultation.ongoingTreatments)
      ? consultation.ongoingTreatments
      : [];

    return treatments.map((item) => ({
      medicine: item.medicine,
      therapeuticClass: item.therapeuticClass,
      category: item.category,
      posology: item.posology,
      duration: item.duration,
      date: item.date,
    }));
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
}
