import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { catchError, forkJoin, of } from 'rxjs';
import { ConsultationConduiteResponse } from '../../../../../../core/models/conduite.models';
import {
  ConsultationExamPayload,
  createDefaultConsultationExamPayload,
} from '../../../../../../core/models/exam.models';
import {
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../core/models/interrogatoire.models';
import { Patient } from '../../../../../../core/models/patient.models';
import { ConduiteService } from '../../../../../../core/services/conduite.service';
import { ExamService } from '../../../../../../core/services/exam.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import {
  ConsultationConclusionViewModel,
  buildConsultationConclusionViewModel,
} from './consultation-conclusion.helpers';
import { ConsultationConclusionReportComponent } from './consultation-conclusion-report.component';

const PDF_MARGIN_PT = 12;

@Component({
  selector: 'app-consultation-conclusion-section',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConsultationConclusionReportComponent],
  templateUrl: './consultation-conclusion-section.component.html',
  styleUrl: './consultation-conclusion-section.component.css',
})
export class ConsultationConclusionSectionComponent implements OnChanges, OnDestroy {
  @Input() consultationId: string | null = null;
  @Input() patient: Patient | null = null;
  @Input() consultationDate = '';
  @Input() motifs: string[] = [];
  @Input() diagnostics: string[] = [];
  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Input() ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Input() examPayload: ConsultationExamPayload | null = null;
  @Input() conduite: ConsultationConduiteResponse | null = null;
  @Input() canAccessExam = false;

  @ViewChild('reportHost', { read: ElementRef })
  private reportHost?: ElementRef<HTMLElement>;

  private readonly examService = inject(ExamService);
  private readonly conduiteService = inject(ConduiteService);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected isLoading = false;
  protected isDownloadingPdf = false;
  protected loadError = '';
  protected viewModel: ConsultationConclusionViewModel | null = null;

  private activeCaptureTarget: HTMLElement | null = null;
  private captureCleanupTimer: number | null = null;
  private resolvedExamPayload: ConsultationExamPayload = createDefaultConsultationExamPayload();
  private resolvedConduite: ConsultationConduiteResponse = {
    consultationId: '',
    additionalInformation: '',
    actions: [],
  };

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.rebuildViewModel();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['consultationId'] || changes['canAccessExam']) {
      const nextConsultationId = this.consultationId?.trim() ?? '';
      if (!nextConsultationId) {
        this.resetState();
        return;
      }

      this.loadRemoteState(nextConsultationId);
      return;
    }

    if (changes['examPayload'] && this.examPayload) {
      this.resolvedExamPayload = this.cloneExamPayload(this.examPayload);
    }

    if (changes['conduite'] && this.conduite) {
      this.resolvedConduite = this.cloneConduite(this.conduite);
    }

    this.rebuildViewModel();
  }

  ngOnDestroy(): void {
    this.cleanupCaptureMode();
  }

  protected async printCurrentView(): Promise<void> {
    if (!this.viewModel || this.isDownloadingPdf) {
      return;
    }

    const target = this.resolveCaptureTarget();
    if (!target) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.printFailed'));
      return;
    }

    this.isDownloadingPdf = true;
    this.enterCaptureMode(target);

    try {
      await this.waitForCapturePaint();
      const captureWidth = Math.ceil(target.getBoundingClientRect().width || target.scrollWidth || target.offsetWidth);
      const captureHeight = Math.ceil(target.scrollHeight || target.offsetHeight);
      const viewportWidth = Math.ceil(
        document.documentElement.clientWidth || window.innerWidth || captureWidth,
      );
      const viewportHeight = Math.ceil(
        window.innerHeight || document.documentElement.clientHeight || captureHeight,
      );

      const canvas = await html2canvas(target, {
        backgroundColor: '#f7f0e6',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 0,
        windowWidth: Math.max(viewportWidth, captureWidth),
        windowHeight: Math.max(viewportHeight, captureHeight),
      });

      const pdfBytes = this.buildPdfFromCanvas(canvas, captureWidth, captureHeight);
      this.downloadPdf(pdfBytes, this.buildPdfFilename());
    } catch (error) {
      console.error('Failed to export consultation conclusion PDF', error);
      this.toastService.error(this.i18n.t('consultation.documents.toast.printFailed'));
    } finally {
      this.cleanupCaptureMode();
      this.isDownloadingPdf = false;
    }
  }

  private resolveCaptureTarget(): HTMLElement | null {
    const target = this.reportHost?.nativeElement.querySelector('.conclusion-sheet');
    return target instanceof HTMLElement ? target : null;
  }

  private enterCaptureMode(target: HTMLElement): void {
    this.activeCaptureTarget = target;
    this.activeCaptureTarget.classList.add('capture-mode');

    if (this.captureCleanupTimer !== null) {
      window.clearTimeout(this.captureCleanupTimer);
    }

    this.captureCleanupTimer = window.setTimeout(() => this.cleanupCaptureMode(), 15000);
  }

  private cleanupCaptureMode(): void {
    this.activeCaptureTarget?.classList.remove('capture-mode');
    this.activeCaptureTarget = null;

    if (this.captureCleanupTimer !== null) {
      window.clearTimeout(this.captureCleanupTimer);
      this.captureCleanupTimer = null;
    }
  }

  private async waitForCapturePaint(): Promise<void> {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) {
      await fonts.ready.catch(() => undefined);
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }

  private buildPdfFromCanvas(
    canvas: HTMLCanvasElement,
    contentWidth: number,
    contentHeight: number,
  ): ArrayBuffer {
    const imageData = canvas.toDataURL('image/png');
    const pdfPageWidth = contentWidth + (PDF_MARGIN_PT * 2);
    const maxPrintablePageHeight = Math.max(contentWidth * 1.95, 1200);

    let consumedHeight = 0;
    let remainingHeight = contentHeight;
    let currentPageContentHeight = Math.min(maxPrintablePageHeight, remainingHeight);
    let currentPageHeight = currentPageContentHeight + (PDF_MARGIN_PT * 2);
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [pdfPageWidth, currentPageHeight],
      hotfixes: ['px_scaling'],
    });

    while (remainingHeight > 0) {
      currentPageContentHeight = Math.min(maxPrintablePageHeight, remainingHeight);
      currentPageHeight = currentPageContentHeight + (PDF_MARGIN_PT * 2);

      if (consumedHeight > 0) {
        pdf.addPage([pdfPageWidth, currentPageHeight], 'p');
      }

      pdf.addImage(
        imageData,
        'PNG',
        PDF_MARGIN_PT,
        PDF_MARGIN_PT - consumedHeight,
        contentWidth,
        contentHeight,
      );

      consumedHeight += currentPageContentHeight;
      remainingHeight -= currentPageContentHeight;
    }

    return pdf.output('arraybuffer');
  }

  private downloadPdf(bytes: ArrayBuffer, filename: string): void {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private buildPdfFilename(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const patientName = [this.patient?.lastname ?? '', this.patient?.firstname ?? '']
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join('-')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `Conclusion-${patientName || 'patient'}-${year}${month}${day}.pdf`;
  }

  private loadRemoteState(consultationId: string): void {
    this.isLoading = true;
    this.loadError = '';

    const examRequest = this.canAccessExam
      ? this.examService.getConsultationExam(consultationId).pipe(
          catchError(() => of({ consultationId, payload: createDefaultConsultationExamPayload() })),
        )
      : of({ consultationId, payload: createDefaultConsultationExamPayload() });

    forkJoin({
      exam: examRequest,
      conduite: this.conduiteService.getConsultationConduite(consultationId).pipe(
        catchError(() => of({ consultationId, additionalInformation: '', actions: [] })),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exam, conduite }) => {
          this.resolvedExamPayload = this.examPayload
            ? this.cloneExamPayload(this.examPayload)
            : exam?.payload ?? createDefaultConsultationExamPayload();
          this.resolvedConduite = this.conduite
            ? this.cloneConduite(this.conduite)
            : {
                consultationId,
                additionalInformation: conduite?.additionalInformation ?? '',
                actions: [...(conduite?.actions ?? [])],
              };
          this.isLoading = false;
          this.loadError = '';

          try {
            this.rebuildViewModel();
          } catch (error) {
            console.error('Failed to build consultation conclusion view', error);
            this.viewModel = null;
            this.loadError = 'consultation.page.conclusion.loadError';
          }
        },
        error: () => {
          this.isLoading = false;
          this.loadError = 'consultation.page.conclusion.loadError';
          this.resolvedExamPayload = createDefaultConsultationExamPayload();
          this.resolvedConduite = {
            consultationId,
            additionalInformation: '',
            actions: [],
          };
          this.rebuildViewModel();
        },
      });
  }

  private rebuildViewModel(): void {
    const nextConsultationId = this.consultationId?.trim() ?? '';
    if (!nextConsultationId) {
      this.viewModel = null;
      return;
    }

    this.viewModel = buildConsultationConclusionViewModel({
      patient: this.patient,
      consultationDate: this.consultationDate,
      motifs: this.motifs,
      diagnostics: this.diagnostics,
      anomalies: this.anomalies,
      ongoingTreatments: this.ongoingTreatments,
      examPayload: this.resolvedExamPayload,
      conduite: this.resolvedConduite,
      locale: this.resolveIntlLocale(),
      translate: (key) => this.i18n.t(key),
    });
  }

  private resetState(): void {
    this.isLoading = false;
    this.loadError = '';
    this.viewModel = null;
    this.resolvedExamPayload = createDefaultConsultationExamPayload();
    this.resolvedConduite = {
      consultationId: '',
      additionalInformation: '',
      actions: [],
    };
  }

  private cloneExamPayload(payload: ConsultationExamPayload): ConsultationExamPayload {
    return JSON.parse(JSON.stringify(payload)) as ConsultationExamPayload;
  }

  private cloneConduite(conduite: ConsultationConduiteResponse): ConsultationConduiteResponse {
    return {
      consultationId: conduite.consultationId,
      additionalInformation: conduite.additionalInformation ?? '',
      actions: [...(conduite.actions ?? [])].map((action) => ({
        ...action,
        payload: { ...(action.payload ?? {}) },
      })),
    };
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
