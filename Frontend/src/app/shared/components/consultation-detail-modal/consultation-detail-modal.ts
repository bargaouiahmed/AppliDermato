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
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ConsultationConduiteResponse } from '../../../core/models/conduite.models';
import {
  ConsultationExamPayload,
  createDefaultConsultationExamPayload,
} from '../../../core/models/exam.models';
import {
  ConsultationInterrogatoireResponse,
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../core/models/interrogatoire.models';
import { Patient } from '../../../core/models/patient.models';
import { ConduiteService } from '../../../core/services/conduite.service';
import { ExamService } from '../../../core/services/exam.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../core/services/interrogatoire.service';
import {
  ConsultationConclusionViewModel,
  buildConsultationConclusionViewModel,
} from '../../../features/dashboard/pages/consultation-interrogatoire-page/sections/conclusion/consultation-conclusion.helpers';
import { ConsultationConclusionReportComponent } from '../../../features/dashboard/pages/consultation-interrogatoire-page/sections/conclusion/consultation-conclusion-report.component';

export interface ConsultationDetailModalData {
  consultationId: string;
  patient: Patient | null;
  consultationDate: string;
  motifs: string[];
  diagnostics: string[];
  conduiteActions: string[];
}

@Component({
  selector: 'app-consultation-detail-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConsultationConclusionReportComponent],
  templateUrl: './consultation-detail-modal.html',
  styleUrl: './consultation-detail-modal.css',
})
export class ConsultationDetailModal implements OnChanges {
  private readonly router = inject(Router);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly examService = inject(ExamService);
  private readonly conduiteService = inject(ConduiteService);
  private readonly i18n = inject(I18nService);

  @Input() isOpen = false;
  @Input() data: ConsultationDetailModalData | null = null;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('modalBackdrop') private backdropRef?: ElementRef<HTMLElement>;

  protected isLoading = false;
  protected loadError = '';
  protected viewModel: ConsultationConclusionViewModel | null = null;

  private activeRequestId = 0;

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    this.close();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isOpen) {
      this.resetPreview();
      return;
    }

    if ((changes['isOpen']?.currentValue === true || changes['data']) && this.data) {
      this.loadPreview(this.data);
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.backdropRef?.nativeElement) {
      this.close();
    }
  }

  protected printConsultation(): void {
    if (!this.data?.consultationId) {
      return;
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', this.data.consultationId, 'print', 'conclusion']),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private loadPreview(data: ConsultationDetailModalData): void {
    const consultationId = data.consultationId?.trim();
    if (!consultationId) {
      this.resetPreview();
      return;
    }

    const requestId = ++this.activeRequestId;
    this.isLoading = true;
    this.loadError = '';
    this.viewModel = this.buildFallbackViewModel(data);

    forkJoin({
      interrogation: this.interrogatoireService.getConsultationInterrogatoire(consultationId),
      exam: this.examService.getConsultationExam(consultationId).pipe(
        catchError(() =>
          of({
            consultationId,
            payload: createDefaultConsultationExamPayload(),
          }),
        ),
      ),
      conduite: this.conduiteService.getConsultationConduite(consultationId).pipe(
        catchError(() =>
          of({
            consultationId,
            additionalInformation: '',
            actions: [] as ConsultationConduiteResponse['actions'],
          }),
        ),
      ),
    }).subscribe({
      next: ({ interrogation, exam, conduite }) => {
        if (requestId !== this.activeRequestId || !this.isOpen) {
          return;
        }

        this.viewModel = this.buildViewModel(
          data.patient,
          interrogation,
          exam?.payload,
          conduite,
        );
        this.isLoading = false;
        this.loadError = '';
      },
      error: () => {
        if (requestId !== this.activeRequestId || !this.isOpen) {
          return;
        }

        this.isLoading = false;
        this.loadError = 'consultation.page.conclusion.loadError';
        this.viewModel = this.buildFallbackViewModel(data);
      },
    });
  }

  private buildViewModel(
    patient: Patient | null,
    interrogation: ConsultationInterrogatoireResponse,
    examPayload: ConsultationExamPayload | null | undefined,
    conduite: ConsultationConduiteResponse | null | undefined,
  ): ConsultationConclusionViewModel {
    return buildConsultationConclusionViewModel({
      patient,
      consultationDate: interrogation.consultationDate,
      motifs: [...(interrogation.motifs ?? [])],
      histoireMaladie: interrogation.histoireMaladie ?? '',
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
      locale: this.resolveIntlLocale(),
      translate: (key) => this.i18n.t(key),
    });
  }

  private buildFallbackViewModel(data: ConsultationDetailModalData): ConsultationConclusionViewModel {
    return buildConsultationConclusionViewModel({
      patient: data.patient,
      consultationDate: data.consultationDate,
      motifs: [...(data.motifs ?? [])],
      histoireMaladie: '',
      diagnostics: [...(data.diagnostics ?? [])],
      anomalies: [] as UpdateInterrogatoireAnomalyRequest[],
      ongoingTreatments: [] as UpdateOngoingTreatmentMedicineRequest[],
      examPayload: createDefaultConsultationExamPayload(),
      conduite: {
        consultationId: data.consultationId,
        additionalInformation: '',
        actions: [],
      },
      locale: this.resolveIntlLocale(),
      translate: (key) => this.i18n.t(key),
    });
  }

  private resetPreview(): void {
    this.activeRequestId += 1;
    this.isLoading = false;
    this.loadError = '';
    this.viewModel = null;
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
