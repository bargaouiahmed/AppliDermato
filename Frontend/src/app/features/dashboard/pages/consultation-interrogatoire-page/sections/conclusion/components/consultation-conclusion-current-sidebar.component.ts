import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  effect,
  inject,
  Renderer2,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { ConsultationConduiteResponse } from '../../../../../../../core/models/conduite.models';
import {
  ConsultationExamPayload,
  createDefaultConsultationExamPayload,
} from '../../../../../../../core/models/exam.models';
import {
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../../core/models/interrogatoire.models';
import { Patient } from '../../../../../../../core/models/patient.models';
import { ConduiteService } from '../../../../../../../core/services/conduite.service';
import { DocumentsService } from '../../../../../../../core/services/documents.service';
import { ExamService } from '../../../../../../../core/services/exam.service';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';
import {
  ConclusionBadge,
  ConsultationConclusionViewModel,
  buildConsultationConclusionViewModel,
} from '../consultation-conclusion.helpers';
import { ConsultationConclusionReportComponent } from '../consultation-conclusion-report.component';

@Component({
  selector: 'app-consultation-conclusion-current-sidebar',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConsultationConclusionReportComponent],
  templateUrl: './consultation-conclusion-current-sidebar.component.html',
  styleUrl: './consultation-conclusion-current-sidebar.component.css',
})
export class ConsultationConclusionCurrentSidebarComponent implements OnChanges, AfterViewInit {
  @Input() consultationId: string | null = null;
  @Input() patient: Patient | null = null;
  @Input() consultationDate = '';
  @Input() motifs: string[] = [];
  @Input() diagnostics: string[] = [];
  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Input() ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Input('examPayload') inputExamPayload: ConsultationExamPayload | null = null;
  @Input('conduite') inputConduite: ConsultationConduiteResponse | null = null;
  @Input() canAccessExam = false;
  @Input() showToggle = true;
  @Input() drawerMode = false;

  private readonly examService = inject(ExamService);
  private readonly conduiteService = inject(ConduiteService);
  private readonly documentsService = inject(DocumentsService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  @ViewChild('imageModalContainer', { read: ElementRef }) imageModalContainer?: ElementRef;

  protected isCollapsed = false;
  protected isLoading = false;
  protected loadError = '';
  protected viewModel: ConsultationConclusionViewModel | null = null;
  protected imageModalOpen = false;
  protected imageModalUrl = '';
  protected imageModalTitle = '';

  private examPayload: ConsultationExamPayload = createDefaultConsultationExamPayload();
  private conduite: ConsultationConduiteResponse = {
    consultationId: '',
    additionalInformation: '',
    actions: [],
  };

  constructor() {
    effect(() => {
      this.i18n.lang();
      setTimeout(() => this.rebuildViewModel(), 0);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showToggle'] && !this.showToggle) {
      this.isCollapsed = false;
    }

    if (changes['consultationId'] || changes['canAccessExam']) {
      const nextConsultationId = this.consultationId?.trim() ?? '';
      if (!nextConsultationId) {
        this.resetState();
        return;
      }

      this.loadRemoteState(nextConsultationId);
      return;
    }

    if (changes['inputExamPayload'] && this.inputExamPayload) {
      this.examPayload = this.cloneExamPayload(this.inputExamPayload);
    }

    if (changes['inputConduite'] && this.inputConduite) {
      this.conduite = this.cloneConduite(this.inputConduite);
    }

    this.rebuildViewModel();
  }

  protected get toggleIconClass(): string {
    return this.isCollapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left';
  }

  protected toggleCollapsed(): void {
    if (!this.showToggle) {
      return;
    }

    this.isCollapsed = !this.isCollapsed;
  }

  protected onBadgeClick(badge: ConclusionBadge): void {
    if (badge.imageUrl) {
      this.imageModalUrl = this.documentsService.resolveAssetUrl(badge.imageUrl);
      this.imageModalTitle = badge.label;
      this.imageModalOpen = true;
      this.cdr.detectChanges();
      this.moveModalToBody();
    }
  }

  protected closeImageModal(): void {
    this.imageModalOpen = false;
    this.imageModalUrl = '';
    this.imageModalTitle = '';
  }

  ngAfterViewInit(): void {
    // Modal will be moved to body when opened
  }

  private moveModalToBody(): void {
    // Wait for the modal to render
    setTimeout(() => {
      if (this.imageModalContainer) {
        const modalElement = this.imageModalContainer.nativeElement;
        this.renderer.appendChild(this.document.body, modalElement);
      }
    }, 0);
  }

  private loadRemoteState(consultationId: string): void {
    this.isLoading = true;
    this.loadError = '';

    const examRequest = this.canAccessExam
      ? this.examService.getConsultationExam(consultationId).pipe(
          catchError(() =>
            of({
              consultationId,
              payload: createDefaultConsultationExamPayload(),
            }),
          ),
        )
      : of({
          consultationId,
          payload: createDefaultConsultationExamPayload(),
        });

    forkJoin({
      exam: examRequest,
      conduite: this.conduiteService.getConsultationConduite(consultationId).pipe(
        catchError(() => of({ consultationId, additionalInformation: '', actions: [] })),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exam, conduite }) => {
          this.examPayload = this.inputExamPayload
            ? this.cloneExamPayload(this.inputExamPayload)
            : exam?.payload ?? createDefaultConsultationExamPayload();
          this.conduite = this.inputConduite
            ? this.cloneConduite(this.inputConduite)
            : {
                consultationId,
                additionalInformation: conduite?.additionalInformation ?? '',
                actions: [...(conduite?.actions ?? [])],
              };
          this.isLoading = false;
          this.loadError = '';
          
          // Use setTimeout to defer view model rebuild to next tick
          setTimeout(() => this.rebuildViewModel(), 0);
        },
        error: () => {
          this.isLoading = false;
          this.loadError = 'consultation.page.conclusion.loadError';
          this.examPayload = createDefaultConsultationExamPayload();
          this.conduite = {
            consultationId,
            additionalInformation: '',
            actions: [],
          };
          
          setTimeout(() => this.rebuildViewModel(), 0);
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
      examPayload: this.examPayload,
      conduite: this.conduite,
      locale: this.resolveIntlLocale(),
      translate: (key) => this.i18n.t(key),
    });
  }

  private resetState(): void {
    this.isLoading = false;
    this.loadError = '';
    this.viewModel = null;
    this.examPayload = createDefaultConsultationExamPayload();
    this.conduite = {
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
