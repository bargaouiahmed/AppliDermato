import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import {
  ConsultationExamPayload,
  ExamFindingCatalogItem,
  GeneralExamData,
  SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS,
  SPECIFIC_EXAM_SECTION_KEYS,
  SpecificExamSectionData,
  SpecificExamSectionKey,
  createDefaultConsultationExamPayload,
  createDefaultSpecificExamSections,
} from '../../../../../../core/models/exam.models';
import { PatientConsultation } from '../../../../../../core/models/patient.models';
import { ExamService } from '../../../../../../core/services/exam.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { PatientService } from '../../../../../../core/services/patient.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { ConsultationExamenGeneralSectionComponent } from './components/consultation-examen-general-section.component';
import { ConsultationExamenSpecificSectionComponent } from './components/consultation-examen-specific-section.component';

type SpecificSectionChangeEvent = {
  section: SpecificExamSectionKey;
  data: SpecificExamSectionData;
};

type CustomFindingCreateEvent = {
  section: SpecificExamSectionKey;
  label: string;
};

@Component({
  selector: 'app-consultation-examen-section',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ConsultationExamenGeneralSectionComponent,
    ConsultationExamenSpecificSectionComponent,
  ],
  templateUrl: './consultation-examen-section.component.html',
  styleUrl: './consultation-examen-section.component.css',
})
export class ConsultationExamenSectionComponent implements OnInit, OnChanges {
  @Input() consultationId: string | null = null;
  @Input() patientId: string | null = null;
  @Output() payloadChange = new EventEmitter<ConsultationExamPayload>();
  @Output() navigateToConduite = new EventEmitter<void>();
  @ViewChild('timelineScroller') private timelineScroller?: ElementRef<HTMLDivElement>;

  private readonly examService = inject(ExamService);
  private readonly patientService = inject(PatientService);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected isLoading = false;
  protected loadError = '';
  protected payload: ConsultationExamPayload = createDefaultConsultationExamPayload();
  protected catalogBySection = this.createEmptyCatalogBySection();
  protected isHistoryLoading = false;
  protected historyLoadError = '';
  protected historyConsultations: PatientConsultation[] = [];
  protected historyPageNumber = 1;
  protected historyPageSize = 8;
  protected historyTotalCount = 0;
  protected isHistoryExamLoading = false;
  protected isApplyingHistoricalPayload = false;
  protected selectedHistoryConsultationId: string | null = null;
  protected previewSourceDate: string | null = null;
  protected isPreviewingHistory = false;
  protected timelineScrollProgress = 0;

  private readonly autosaveTrigger = new Subject<string>();
  private isHydratingFromBackend = false;
  private lastAutosaveToastAt = 0;
  private persistedCurrentPayload: ConsultationExamPayload = createDefaultConsultationExamPayload();
  private isTimelineDragging = false;
  private timelinePointerId: number | null = null;
  private timelineDragStartX = 0;
  private timelineDragStartScrollLeft = 0;
  private timelineHasDragged = false;
  private suppressNextTimelineClick = false;

  protected get historyTotalPages(): number {
    return Math.max(1, Math.ceil(this.historyTotalCount / this.historyPageSize));
  }

  protected get historyVisiblePages(): number[] {
    if (!this.historyTotalCount) {
      return [];
    }

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.historyPageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > this.historyTotalPages) {
      endPage = this.historyTotalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  protected get hasHistoryConsultations(): boolean {
    return this.historyConsultations.length > 0;
  }

  ngOnInit(): void {
    this.autosaveTrigger
      .pipe(
        debounceTime(550),
        distinctUntilChanged(),
        switchMap(() => {
          if (
            !this.consultationId ||
            this.isHydratingFromBackend ||
            this.isPreviewingHistory ||
            this.isApplyingHistoricalPayload
          ) {
            return of(null);
          }

          return this.examService
            .updateConsultationExam(this.consultationId, { payload: this.payload })
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

        this.persistedCurrentPayload = this.clonePayload(this.payload);

        const now = Date.now();
        if (now - this.lastAutosaveToastAt > 2200) {
          this.lastAutosaveToastAt = now;
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const consultationChanged = !!changes['consultationId'];
    const patientChanged = !!changes['patientId'];

    if (consultationChanged) {
      const nextId = this.consultationId?.trim() ?? '';
      if (!nextId) {
        this.resetCurrentExamState();
      } else {
        this.loadExamSection(nextId);
      }
    }

    if (consultationChanged || patientChanged) {
      const nextPatientId = this.patientId?.trim() ?? '';
      if (!nextPatientId) {
        this.resetHistoryState();
        return;
      }

      this.historyPageNumber = 1;
      this.loadHistoryTimeline(nextPatientId, this.historyPageNumber);
    }
  }

  protected onGeneralChange(next: GeneralExamData): void {
    this.payload = {
      ...this.payload,
      general: {
        ...next,
      },
    };

    this.queueAutosave();
    this.emitPayloadChange();
  }

  protected onSpecificSectionChange(event: SpecificSectionChangeEvent): void {
    this.payload = {
      ...this.payload,
      specific: {
        ...this.payload.specific,
        [event.section]: {
          ...event.data,
          selectedFindings: [...event.data.selectedFindings],
          findingDetails: { ...event.data.findingDetails },
        },
      },
    };

    this.queueAutosave();
    this.emitPayloadChange();
  }

  protected goToHistoryPage(page: number): void {
    if (
      this.isHistoryLoading ||
      page < 1 ||
      page > this.historyTotalPages ||
      page === this.historyPageNumber
    ) {
      return;
    }

    const patientId = this.patientId?.trim() ?? '';
    if (!patientId) {
      return;
    }

    this.historyPageNumber = page;
    this.loadHistoryTimeline(patientId, this.historyPageNumber);
  }

  protected onTimelineWheel(event: WheelEvent): void {
    const scroller = this.timelineScroller?.nativeElement;
    if (!scroller) {
      return;
    }

    const hasHorizontalOverflow = scroller.scrollWidth > scroller.clientWidth;
    if (!hasHorizontalOverflow) {
      return;
    }

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    scroller.scrollBy({
      left: event.deltaY,
      behavior: 'smooth',
    });
  }

  protected onTimelineScroll(): void {
    this.updateTimelineScrollProgress();
  }

  protected onTimelinePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const scroller = this.timelineScroller?.nativeElement;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    this.isTimelineDragging = true;
    this.timelinePointerId = event.pointerId;
    this.timelineDragStartX = event.clientX;
    this.timelineDragStartScrollLeft = scroller.scrollLeft;
    this.timelineHasDragged = false;
    scroller.classList.add('dragging');
    scroller.setPointerCapture(event.pointerId);
  }

  protected onTimelinePointerMove(event: PointerEvent): void {
    if (!this.isTimelineDragging || this.timelinePointerId !== event.pointerId) {
      return;
    }

    const scroller = this.timelineScroller?.nativeElement;
    if (!scroller) {
      return;
    }

    const deltaX = event.clientX - this.timelineDragStartX;
    if (Math.abs(deltaX) > 4) {
      this.timelineHasDragged = true;
    }

    scroller.scrollLeft = this.timelineDragStartScrollLeft - deltaX;
    this.updateTimelineScrollProgress();
  }

  protected onTimelinePointerUp(event: PointerEvent): void {
    if (!this.isTimelineDragging || this.timelinePointerId !== event.pointerId) {
      return;
    }

    this.releaseTimelinePointer(event.pointerId);
  }

  protected isCurrentConsultation(consultation: PatientConsultation): boolean {
    const currentId = this.consultationId?.trim() ?? '';
    return !!currentId && consultation.id === currentId;
  }

  protected onTimelineConsultationClick(consultation: PatientConsultation): void {
    if (this.suppressNextTimelineClick) {
      this.suppressNextTimelineClick = false;
      return;
    }

    if (this.isCurrentConsultation(consultation)) {
      if (this.isPreviewingHistory) {
        this.restoreTodayExam();
      } else {
        queueMicrotask(() => this.scrollToActiveTimelineItem());
      }
      return;
    }

    this.loadHistoricalExam(consultation);
  }

  protected loadHistoricalExam(consultation: PatientConsultation): void {
    if (this.suppressNextTimelineClick) {
      this.suppressNextTimelineClick = false;
      return;
    }

    if (
      this.isCurrentConsultation(consultation) ||
      this.isHistoryExamLoading ||
      this.isApplyingHistoricalPayload
    ) {
      return;
    }

    this.isHistoryExamLoading = true;
    this.examService
      .getConsultationExam(consultation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (exam) => {
          this.isHydratingFromBackend = true;
          this.payload = this.normalizePayload(exam?.payload);
          this.isHydratingFromBackend = false;

          this.isPreviewingHistory = true;
          this.selectedHistoryConsultationId = consultation.id;
          this.previewSourceDate = consultation.consultationDate;
          this.isHistoryExamLoading = false;
          queueMicrotask(() => this.scrollToActiveTimelineItem());
        },
        error: () => {
          this.isHistoryExamLoading = false;
          this.toastService.error(this.i18n.t('consultation.page.exam.timeline.loadHistoricalError'));
        },
      });
  }

  protected restoreTodayExam(): void {
    if (!this.isPreviewingHistory) {
      return;
    }

    this.isHydratingFromBackend = true;
    this.payload = this.clonePayload(this.persistedCurrentPayload);
    this.isHydratingFromBackend = false;
    this.clearHistoryPreview();
    queueMicrotask(() => this.scrollToActiveTimelineItem());
  }

  protected applyHistoricalPayloadToToday(): void {
    if (!this.consultationId || !this.isPreviewingHistory || this.isApplyingHistoricalPayload) {
      return;
    }

    this.isApplyingHistoricalPayload = true;
    this.examService
      .updateConsultationExam(this.consultationId, { payload: this.payload })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isHydratingFromBackend = true;
          this.payload = this.normalizePayload(response?.payload ?? this.payload);
          this.isHydratingFromBackend = false;

          this.persistedCurrentPayload = this.clonePayload(this.payload);
          this.clearHistoryPreview();
          this.emitPayloadChange();
          this.isApplyingHistoricalPayload = false;
          queueMicrotask(() => this.scrollToActiveTimelineItem());
          this.toastService.success(this.i18n.t('consultation.page.exam.timeline.applySuccess'));
        },
        error: () => {
          this.isApplyingHistoricalPayload = false;
          this.toastService.error(this.i18n.t('consultation.page.exam.timeline.applyError'));
        },
      });
  }

  protected onCustomFindingCreate(event: CustomFindingCreateEvent): void {
    const label = this.normalizeLabel(event.label);
    if (!label) {
      return;
    }

    this.upsertCatalogItem({
      section: event.section,
      isCustom: true,
      label,
    });

    this.examService
      .addFindingCatalogItem({
        section: event.section,
        label,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.upsertCatalogItem(item);
        },
        error: () => {
          this.toastService.error(this.i18n.t('consultation.page.exam.customAddError'));
        },
      });
  }

  protected goToConduite(): void {
    this.navigateToConduite.emit();
  }

  private loadExamSection(consultationId: string): void {
    this.isLoading = true;
    this.loadError = '';

    forkJoin({
      exam: this.examService.getConsultationExam(consultationId),
      catalog: this.examService.getFindingCatalog().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exam, catalog }) => {
          if ((this.consultationId?.trim() ?? '') !== consultationId) {
            return;
          }

          this.clearHistoryPreview();
          this.isHydratingFromBackend = true;
          this.payload = this.normalizePayload(exam?.payload);
          this.persistedCurrentPayload = this.clonePayload(this.payload);
          this.catalogBySection = this.createEmptyCatalogBySection();

          for (const item of catalog) {
            this.upsertCatalogItem(item, false);
          }

          this.isHydratingFromBackend = false;
          this.emitPayloadChange();
          this.isLoading = false;
          queueMicrotask(() => {
            this.scrollToActiveTimelineItem(false);
            this.updateTimelineScrollProgress();
          });
        },
        error: () => {
          if ((this.consultationId?.trim() ?? '') !== consultationId) {
            return;
          }

          this.isHydratingFromBackend = false;
          this.isLoading = false;
          this.loadError = 'consultation.page.loadError';
        },
      });
  }

  private loadHistoryTimeline(patientId: string, pageNumber: number): void {
    this.isHistoryLoading = true;
    this.historyLoadError = '';

    this.patientService
      .getPatientConsultations(patientId, pageNumber, this.historyPageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if ((this.patientId?.trim() ?? '') !== patientId) {
            return;
          }

          this.isHistoryLoading = false;
          this.historyConsultations = [...(response.consultations ?? [])].sort((a, b) =>
            this.compareConsultationDates(a, b),
          );
          this.historyTotalCount = response.totalCount;

          if (this.historyPageNumber > this.historyTotalPages) {
            this.historyPageNumber = this.historyTotalPages;
            this.loadHistoryTimeline(patientId, this.historyPageNumber);
            return;
          }

          queueMicrotask(() => {
            this.scrollToActiveTimelineItem(false);
            this.updateTimelineScrollProgress();
          });
        },
        error: () => {
          if ((this.patientId?.trim() ?? '') !== patientId) {
            return;
          }

          this.isHistoryLoading = false;
          this.historyConsultations = [];
          this.historyTotalCount = 0;
          this.historyLoadError = 'consultation.page.exam.timeline.loadHistoryError';
          this.timelineScrollProgress = 0;
        },
      });
  }

  private normalizePayload(incoming: ConsultationExamPayload | null | undefined): ConsultationExamPayload {
    const defaults = createDefaultConsultationExamPayload();
    if (!incoming) {
      return defaults;
    }

    const specific = this.createDefaultSpecificSectionMap();
    for (const sectionKey of SPECIFIC_EXAM_SECTION_KEYS) {
      const rawSection = incoming.specific?.[sectionKey];
      if (!rawSection) {
        continue;
      }

      const findingDetails: SpecificExamSectionData['findingDetails'] = {};
      for (const [key, value] of Object.entries(rawSection.findingDetails ?? {})) {
        const normalizedKey = this.normalizeLabel(key);
        if (!normalizedKey) {
          continue;
        }

        findingDetails[normalizedKey] = {
          description: value?.description ?? '',
        };
      }

      const normalizedSection: SpecificExamSectionData = {
        status: rawSection.status ?? 'not_examined',
        selectedFindings: Array.isArray(rawSection.selectedFindings)
          ? rawSection.selectedFindings.map((item) => this.normalizeLabel(item)).filter((item) => !!item)
          : [],
        findingDetails,
        notes: '',
      };

      specific[sectionKey] = this.applySpecificSectionNormalDefaults(sectionKey, normalizedSection);
    }

    return {
      general: this.normalizeGeneralData(incoming.general, defaults.general),
      specific,
    };
  }

  private normalizeGeneralData(
    incoming: ConsultationExamPayload['general'] | null | undefined,
    defaults: ConsultationExamPayload['general'],
  ): ConsultationExamPayload['general'] {
    const general: Partial<ConsultationExamPayload['general']> = incoming ?? {};
    return {
      etatGeneral: general.etatGeneral ?? defaults.etatGeneral,
      tensionSystolique: general.tensionSystolique ?? defaults.tensionSystolique,
      tensionDiastolique: general.tensionDiastolique ?? defaults.tensionDiastolique,
      frequenceCardiaque: general.frequenceCardiaque ?? defaults.frequenceCardiaque,
      rythmeCardiaque: general.rythmeCardiaque ?? defaults.rythmeCardiaque,
      temperature: general.temperature ?? defaults.temperature,
      saturationO2: general.saturationO2 ?? defaults.saturationO2,
      poidsKg: general.poidsKg ?? defaults.poidsKg,
      tailleCm: general.tailleCm ?? defaults.tailleCm,
      imc: general.imc ?? defaults.imc,
    };
  }

  private queueAutosave(): void {
    if (
      this.isHydratingFromBackend ||
      !this.consultationId ||
      this.isPreviewingHistory ||
      this.isApplyingHistoricalPayload
    ) {
      return;
    }

    this.autosaveTrigger.next(this.buildPayloadSignature(this.payload));
  }

  private emitPayloadChange(): void {
    if (this.isHydratingFromBackend || this.isPreviewingHistory) {
      return;
    }

    this.payloadChange.emit(this.clonePayload(this.payload));
  }

  private buildPayloadSignature(payload: ConsultationExamPayload): string {
    return JSON.stringify(payload);
  }

  private normalizeLabel(value: string): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .trim()
      .replace(/\s+/g, ' ');
  }

  private compareConsultationDates(a: PatientConsultation, b: PatientConsultation): number {
    const leftTimestamp = this.readConsultationTimestamp(a.consultationDate);
    const rightTimestamp = this.readConsultationTimestamp(b.consultationDate);

    if (leftTimestamp !== null && rightTimestamp !== null) {
      return leftTimestamp - rightTimestamp;
    }

    if (leftTimestamp !== null) {
      return -1;
    }

    if (rightTimestamp !== null) {
      return 1;
    }

    return (a.consultationDate ?? '').localeCompare(b.consultationDate ?? '', 'fr', {
      sensitivity: 'base',
    });
  }

  private readConsultationTimestamp(value: string): number | null {
    const timestamp = Date.parse(value ?? '');
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  private clearHistoryPreview(): void {
    this.isPreviewingHistory = false;
    this.selectedHistoryConsultationId = null;
    this.previewSourceDate = null;
  }

  private scrollToActiveTimelineItem(smooth = true): void {
    const scroller = this.timelineScroller?.nativeElement;
    if (!scroller) {
      return;
    }

    const activeId = this.getActiveTimelineConsultationId();
    if (!activeId) {
      this.updateTimelineScrollProgress();
      return;
    }

    const nodes = Array.from(scroller.querySelectorAll<HTMLButtonElement>('.timeline-node'));
    const targetNode = nodes.find((node) => node.dataset['timelineId'] === activeId);
    if (!targetNode) {
      this.updateTimelineScrollProgress();
      return;
    }

    const targetCenter = targetNode.offsetLeft + (targetNode.offsetWidth / 2);
    const nextLeft = Math.max(0, targetCenter - (scroller.clientWidth / 2));
    scroller.scrollTo({
      left: nextLeft,
      behavior: smooth ? 'smooth' : 'auto',
    });

    this.updateTimelineScrollProgress();
  }

  private getActiveTimelineConsultationId(): string {
    const selected = this.selectedHistoryConsultationId?.trim() ?? '';
    if (selected) {
      return selected;
    }

    return this.consultationId?.trim() ?? '';
  }

  private updateTimelineScrollProgress(): void {
    const scroller = this.timelineScroller?.nativeElement;
    if (!scroller) {
      this.timelineScrollProgress = 0;
      return;
    }

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (maxScroll <= 0) {
      this.timelineScrollProgress = this.historyConsultations.length > 0 ? 100 : 0;
      return;
    }

    const raw = (scroller.scrollLeft / maxScroll) * 100;
    this.timelineScrollProgress = Math.max(0, Math.min(100, Math.round(raw)));
  }

  private releaseTimelinePointer(pointerId?: number): void {
    const scroller = this.timelineScroller?.nativeElement;
    if (scroller && pointerId !== undefined && scroller.hasPointerCapture(pointerId)) {
      scroller.releasePointerCapture(pointerId);
    }

    if (scroller) {
      scroller.classList.remove('dragging');
    }

    if (this.timelineHasDragged) {
      this.suppressNextTimelineClick = true;
      setTimeout(() => {
        this.suppressNextTimelineClick = false;
      }, 0);
    }

    this.isTimelineDragging = false;
    this.timelinePointerId = null;
    this.timelineHasDragged = false;
  }

  private clonePayload(payload: ConsultationExamPayload): ConsultationExamPayload {
    return this.normalizePayload(payload);
  }

  private resetCurrentExamState(): void {
    this.payload = createDefaultConsultationExamPayload();
    this.persistedCurrentPayload = this.clonePayload(this.payload);
    this.catalogBySection = this.createEmptyCatalogBySection();
    this.loadError = '';
    this.clearHistoryPreview();
  }

  private resetHistoryState(): void {
    this.isHistoryLoading = false;
    this.historyLoadError = '';
    this.historyConsultations = [];
    this.historyPageNumber = 1;
    this.historyTotalCount = 0;
    this.isHistoryExamLoading = false;
    this.timelineScrollProgress = 0;
    this.releaseTimelinePointer();
    this.clearHistoryPreview();
  }

  private createEmptyCatalogBySection(): Record<SpecificExamSectionKey, ExamFindingCatalogItem[]> {
    return {
      orlCouConjonctive: [],
      auscultationCardiaque: [],
      auscultationPulmonaire: [],
      abdomen: [],
      neurologique: [],
      locomoteurOsteoArticulaire: [],
      peauDermatologique: [],
      urogenital: [],
    };
  }

  private createDefaultSpecificSectionMap(): ConsultationExamPayload['specific'] {
    return createDefaultSpecificExamSections();
  }

  private applySpecificSectionNormalDefaults(
    sectionKey: SpecificExamSectionKey,
    sectionData: SpecificExamSectionData,
  ): SpecificExamSectionData {
    if (sectionData.status === 'abnormal') {
      return sectionData;
    }

    const hasSelection = sectionData.selectedFindings.length > 0;
    const hasDetails = Object.keys(sectionData.findingDetails).length > 0;
    if (hasSelection || hasDetails) {
      return sectionData;
    }

    const normalFinding = SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS[sectionKey] ?? '';
    if (!normalFinding) {
      return sectionData;
    }

    return {
      ...sectionData,
      status: 'normal',
      selectedFindings: [normalFinding],
      findingDetails: {
        [normalFinding]: {
          description: '',
        },
      },
    };
  }

  private upsertCatalogItem(item: ExamFindingCatalogItem, createClones = true): void {
    const section = item.section;
    const label = this.normalizeLabel(item.label);
    if (!label) {
      return;
    }

    const current = this.catalogBySection[section] ?? [];
    const normalized = label.toLowerCase();
    const existing = current.find((entry) => entry.label.trim().toLowerCase() === normalized);
    if (existing) {
      return;
    }

    const next = [
      ...current,
      {
        section,
        isCustom: item.isCustom,
        label,
      },
    ].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));

    this.catalogBySection = {
      ...this.catalogBySection,
      [section]: createClones ? [...next] : next,
    };
  }
}
