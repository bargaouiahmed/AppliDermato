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
import { FormsModule } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import {
  BodyGender,
  BodyView,
  ConsultationExamPayload,
  DermatologyExamImage,
  DermatologyExamZone,
  cloneConsultationExamPayload,
  createDefaultConsultationExamPayload,
  createDefaultDermatologyExamZone,
} from '../../../../../../core/models/exam.models';
import { ConsultationExplorationDocumentResponse } from '../../../../../../core/models/documents.models';
import { PatientConsultation } from '../../../../../../core/models/patient.models';
import { DocumentsService } from '../../../../../../core/services/documents.service';
import { ExamService } from '../../../../../../core/services/exam.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { PatientService } from '../../../../../../core/services/patient.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { bodyBack } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyBack';
import { bodyFemaleBack } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyFemaleBack';
import { bodyFemaleFront } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyFemaleFront';
import { bodyFront } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyFront';
import { BodyPart, BodyPartSide, Slug } from '../../../sketchfab-test-page/react-muscle-assets';
import { BODY_OUTLINE_PATHS } from '../../../sketchfab-test-page/sketchfab-test-page';

type RegionSegment = 'common' | BodyPartSide;
type RegionKeyPart = Slug | 'unknown';

type ZoneModalState = {
  regionId: string;
  label: string;
  slug: string;
  segment: RegionSegment;
  pathIndex: number;
  view: BodyView;
  description: string;
  existingImage: DermatologyExamImage | null;
  nextFile: File | null;
  removeExistingImage: boolean;
};

@Component({
  selector: 'app-consultation-examen-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './consultation-examen-section.component.html',
  styleUrl: './consultation-examen-section.component.css',
})
export class ConsultationExamenSectionComponent implements OnInit, OnChanges {
  @Input() consultationId: string | null = null;
  @Input() patientId: string | null = null;
  @Input() patientSex: string | null = null;
  @Output() payloadChange = new EventEmitter<ConsultationExamPayload>();
  @Output() navigateToConduite = new EventEmitter<void>();
  @ViewChild('timelineScroller') private timelineScroller?: ElementRef<HTMLDivElement>;

  private readonly examService = inject(ExamService);
  private readonly patientService = inject(PatientService);
  private readonly documentsService = inject(DocumentsService);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected isLoading = false;
  protected loadError = '';
  protected payload: ConsultationExamPayload = createDefaultConsultationExamPayload();
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
  protected modalState: ZoneModalState | null = null;
  protected isSavingZone = false;

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

  protected get bodyGender(): BodyGender {
    return this.payload.bodyMap.gender;
  }

  protected get documentedZones(): DermatologyExamZone[] {
    const locale = this.i18n.lang();
    return Object.values(this.payload.bodyMap.zones ?? {})
      .filter((zone) => this.hasZoneData(zone))
      .sort((left, right) =>
        this.regionLabel(left.regionId).localeCompare(this.regionLabel(right.regionId), locale, {
          sensitivity: 'base',
        }),
      );
  }

  protected get lesionCount(): number {
    return this.documentedZones.length;
  }

  protected get imageCount(): number {
    return this.documentedZones.filter((zone) => !!zone.image?.fileUrl).length;
  }

  protected bodyPartsFor(view: BodyView): BodyPart[] {
    if (this.bodyGender === 'female') {
      return view === 'front' ? bodyFemaleFront : bodyFemaleBack;
    }

    return view === 'front' ? bodyFront : bodyBack;
  }

  protected viewBoxFor(view: BodyView): string {
    if (this.bodyGender === 'female') {
      return view === 'front' ? '-60 -10 760 1600' : '740 -10 810 1505';
    }

    return view === 'front' ? '0 0 724 1448' : '724 0 724 1448';
  }

  protected outlinePathFor(view: BodyView): string {
    return BODY_OUTLINE_PATHS[this.bodyGender][view];
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
            this.isApplyingHistoricalPayload ||
            this.isSavingZone
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

        this.persistedCurrentPayload = cloneConsultationExamPayload(this.payload);
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
    const patientSexChanged = !!changes['patientSex'];

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
      } else {
        this.historyPageNumber = 1;
        this.loadHistoryTimeline(nextPatientId, this.historyPageNumber);
      }
    }

    if (patientSexChanged && this.patientSex) {
      this.applyPatientSexToPayload(this.patientSex, true);
    }
  }

  protected onBodyMapNotesChange(): void {
    this.payload = {
      bodyMap: {
        ...this.payload.bodyMap,
        notes: this.normalizeText(this.payload.bodyMap.notes),
      },
    };
    this.queueAutosave();
    this.emitPayloadChange();
  }

  protected regionId(
    view: BodyView,
    slug: RegionKeyPart | undefined,
    segment: RegionSegment,
    pathIndex: number,
  ): string {
    const safeView = view === 'back' ? 'back' : 'front';
    return `${safeView}|${slug ?? 'unknown'}|${segment}|${pathIndex}`;
  }

  protected regionLabel(regionId: string): string {
    const [viewValue, slugValue, segmentValue, pathIndexValue] = regionId.split('|');
    const view: BodyView = viewValue === 'back' ? 'back' : 'front';
    const segment: RegionSegment =
      segmentValue === 'left' || segmentValue === 'right' ? segmentValue : 'common';
    const slug: RegionKeyPart = (this.normalizeText(slugValue) || 'unknown') as RegionKeyPart;
    const pathIndex = Number(pathIndexValue);
    const suffixParts: string[] = [];

    const baseLabel = this.translateBodyMapPart(slug, view, segment);
    const viewLabel = this.translateBodyMapView(view);
    if (viewLabel) {
      suffixParts.push(viewLabel);
    }

    if (segment !== 'common') {
      suffixParts.push(this.translateBodyMapSide(segment));
    }

    if (Number.isFinite(pathIndex) && pathIndex > 0) {
      suffixParts.push(String(pathIndex + 1));
    }

    return suffixParts.length > 0 ? `${baseLabel} (${suffixParts.join(' ')})` : baseLabel;
  }

  private translateBodyMapView(view: BodyView): string {
    const key = view === 'front'
      ? 'consultation.page.exam.bodyMap.front'
      : 'consultation.page.exam.bodyMap.back';
    const translated = this.i18n.t(key);
    if (translated !== key) {
      return translated;
    }

    return this.toTitleCase(view);
  }

  private translateBodyMapPart(slug: RegionKeyPart, view: BodyView, segment: RegionSegment): string {
    if (slug === 'head' && segment === 'common') {
      const viewKey = view === 'front'
        ? 'consultation.page.exam.bodyMap.parts.face'
        : 'consultation.page.exam.bodyMap.parts.rearHead';
      const translatedView = this.i18n.t(viewKey);
      if (translatedView !== viewKey) {
        return translatedView;
      }
    }

    const safeSlug = slug || 'unknown';
    const key = `consultation.page.exam.bodyMap.parts.${safeSlug}`;
    const translated = this.i18n.t(key);
    if (translated !== key) {
      return translated;
    }

    return this.toTitleCase(String(safeSlug).replace(/-/g, ' '));
  }

  private translateBodyMapSide(segment: RegionSegment): string {
    if (segment === 'common') {
      return '';
    }

    const key = `consultation.page.exam.bodyMap.side.${segment}`;
    const translated = this.i18n.t(key);
    if (translated !== key) {
      return translated;
    }

    return this.toTitleCase(segment);
  }

  protected pathFill(regionId: string): string {
    return this.zoneById(regionId) ? '#d94b5f' : this.baseRegionColor(regionId);
  }

  protected pathClass(regionId: string): string {
    return this.zoneById(regionId) ? 'muscle-path is-documented' : 'muscle-path';
  }

  protected onRegionClick(regionId: string): void {
    this.openZoneModal(regionId);
  }

  protected onRegionKeydown(event: KeyboardEvent, regionId: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openZoneModal(regionId);
  }

  protected reopenZone(zone: DermatologyExamZone): void {
    this.openZoneModal(zone.regionId);
  }

  protected onZoneFileSelected(event: Event): void {
    if (!this.modalState) {
      return;
    }

    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.modalState = {
      ...this.modalState,
      nextFile: file,
      removeExistingImage: file ? false : this.modalState.removeExistingImage,
    };
  }

  protected removeZoneImage(): void {
    if (!this.modalState) {
      return;
    }

    this.modalState = {
      ...this.modalState,
      nextFile: null,
      removeExistingImage: true,
    };
  }

  protected clearZoneDraft(): void {
    if (!this.modalState) {
      return;
    }

    this.modalState = {
      ...this.modalState,
      description: '',
      nextFile: null,
      removeExistingImage: !!this.modalState.existingImage,
    };
  }

  protected closeZoneModal(): void {
    if (this.isSavingZone) {
      return;
    }

    this.modalState = null;
  }

  protected saveZoneModal(): void {
    if (!this.modalState || !this.consultationId?.trim() || this.isSavingZone) {
      return;
    }

    const description = this.normalizeMultilineText(this.modalState.description);
    const previousImage = this.modalState.existingImage;
    const shouldRemoveExistingImage = !!previousImage && this.modalState.removeExistingImage && !this.modalState.nextFile;

    this.isSavingZone = true;

    const upload$: Observable<ConsultationExplorationDocumentResponse | null> = this.modalState.nextFile
      ? this.documentsService.createExplorationDocument(this.consultationId, {
          typeLabels: ['Dermatology lesion'],
          clinic: '',
          forfait: '',
          operator: '',
          precaution: '',
          additionalInformation: `${this.modalState.label}${description ? ` - ${description}` : ''}`,
          file: this.modalState.nextFile,
        })
      : of(null);

    upload$
      .pipe(
        switchMap((documentResponse) => {
          const nextImage = documentResponse
            ? this.mapDocumentToExamImage(documentResponse)
            : shouldRemoveExistingImage
              ? null
              : previousImage;

          const currentZones = { ...(this.payload.bodyMap.zones ?? {}) };
          const nextZone = createDefaultDermatologyExamZone({
            regionId: this.modalState!.regionId,
            label: this.modalState!.label,
            slug: this.modalState!.slug,
            segment: this.modalState!.segment,
            pathIndex: this.modalState!.pathIndex,
            view: this.modalState!.view,
            description,
            image: nextImage,
            updatedAt: new Date().toISOString(),
          });

          if (this.hasZoneData(nextZone)) {
            currentZones[nextZone.regionId] = nextZone;
          } else {
            delete currentZones[nextZone.regionId];
          }

          const nextPayload: ConsultationExamPayload = {
            bodyMap: {
              ...this.payload.bodyMap,
              zones: currentZones,
            },
          };

          return this.examService.updateConsultationExam(this.consultationId!, { payload: nextPayload }).pipe(
            map((response) => ({
              response,
              shouldDeletePreviousImage:
                !!previousImage?.documentId && (shouldRemoveExistingImage || !!documentResponse),
            })),
          );
        }),
        switchMap(({ response, shouldDeletePreviousImage }) => {
          const previousDocumentId = previousImage?.documentId?.trim() ?? '';
          if (!shouldDeletePreviousImage || !previousDocumentId) {
            return of(response);
          }

          return this.documentsService.deleteExplorationDocument(this.consultationId!, previousDocumentId).pipe(
            map(() => response),
            catchError(() => of(response)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response: { consultationId: string; payload: ConsultationExamPayload }) => {
          this.isHydratingFromBackend = true;
          this.payload = this.normalizePayload(response?.payload);
          this.persistedCurrentPayload = cloneConsultationExamPayload(this.payload);
          this.isHydratingFromBackend = false;
          this.emitPayloadChange();
          this.isSavingZone = false;
          this.modalState = null;
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
        },
        error: () => {
          this.isSavingZone = false;
          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
        },
      });
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
    if (!hasHorizontalOverflow || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
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
    if (
      this.suppressNextTimelineClick ||
      this.isCurrentConsultation(consultation) ||
      this.isHistoryExamLoading ||
      this.isApplyingHistoricalPayload
    ) {
      this.suppressNextTimelineClick = false;
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
    this.payload = cloneConsultationExamPayload(this.persistedCurrentPayload);
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
          this.persistedCurrentPayload = cloneConsultationExamPayload(this.payload);
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

  protected resolveImageUrl(image: DermatologyExamImage | null | undefined): string {
    return image?.fileUrl ? this.documentsService.resolveAssetUrl(image.fileUrl) : '';
  }

  protected goToConduite(): void {
    this.navigateToConduite.emit();
  }

  private loadExamSection(consultationId: string): void {
    this.isLoading = true;
    this.loadError = '';

    forkJoin({
      exam: this.examService.getConsultationExam(consultationId),
      patient: this.resolvePatientSexSource(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exam, patient }) => {
          if ((this.consultationId?.trim() ?? '') !== consultationId) {
            return;
          }

          this.clearHistoryPreview();
          this.isHydratingFromBackend = true;
          this.payload = this.normalizePayload(exam?.payload, patient?.sex ?? this.patientSex ?? undefined);
          this.persistedCurrentPayload = cloneConsultationExamPayload(this.payload);
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

  private resolvePatientSexSource() {
    const patientId = this.patientId?.trim() ?? '';
    if (!patientId) {
      return of(null);
    }

    return this.patientService.getPatientById(patientId).pipe(catchError(() => of(null)));
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

  private normalizePayload(
    incoming: ConsultationExamPayload | null | undefined,
    patientSex?: string,
  ): ConsultationExamPayload {
    const normalizedPatientGender = this.normalizeBodyGender(patientSex ?? this.patientSex ?? '');
    const defaults = createDefaultConsultationExamPayload(normalizedPatientGender);
    const bodyMap = incoming?.bodyMap;
    const zones: Record<string, DermatologyExamZone> = {};

    for (const [regionId, rawZone] of Object.entries(bodyMap?.zones ?? {})) {
      const view = rawZone?.view === 'back' ? 'back' : 'front';
      const segment = rawZone?.segment === 'left' || rawZone?.segment === 'right' ? rawZone.segment : 'common';
      const zone = createDefaultDermatologyExamZone({
        regionId: this.normalizeText(rawZone?.regionId || regionId),
        label: this.normalizeText(rawZone?.label || this.regionLabel(regionId)),
        slug: this.normalizeText(rawZone?.slug || 'unknown'),
        segment,
        pathIndex: Number.isFinite(Number(rawZone?.pathIndex)) ? Number(rawZone?.pathIndex) : 0,
        view,
        description: this.normalizeMultilineText(rawZone?.description ?? ''),
        image: this.normalizeImage(rawZone?.image),
        updatedAt: this.normalizeText(rawZone?.updatedAt ?? '') || null,
      });

      if (this.hasZoneData(zone)) {
        zones[zone.regionId] = zone;
      }
    }

    return {
      bodyMap: {
        gender: normalizedPatientGender || this.normalizeBodyGender(bodyMap?.gender ?? defaults.bodyMap.gender),
        zones,
        notes: this.normalizeMultilineText(bodyMap?.notes ?? ''),
      },
    };
  }

  private normalizeImage(image: DermatologyExamZone['image'] | null | undefined): DermatologyExamImage | null {
    if (!image?.fileUrl && !image?.documentId) {
      return null;
    }

    return {
      documentId: this.normalizeText(image?.documentId ?? ''),
      fileUrl: this.normalizeText(image?.fileUrl ?? ''),
      originalFileName: this.normalizeText(image?.originalFileName ?? ''),
      contentType: this.normalizeText(image?.contentType ?? ''),
      fileSizeBytes: Number(image?.fileSizeBytes ?? 0) || 0,
      createdAt: this.normalizeText(image?.createdAt ?? ''),
    };
  }

  private openZoneModal(regionId: string): void {
    const [viewValue, slugValue, segmentValue, pathIndexValue] = regionId.split('|');
    const existingZone = this.zoneById(regionId);

    this.modalState = {
      regionId,
      label: this.regionLabel(regionId),
      slug: this.normalizeText(slugValue || 'unknown'),
      segment: segmentValue === 'left' || segmentValue === 'right' ? segmentValue : 'common',
      pathIndex: Number.isFinite(Number(pathIndexValue)) ? Number(pathIndexValue) : 0,
      view: viewValue === 'back' ? 'back' : 'front',
      description: existingZone?.description ?? '',
      existingImage: existingZone?.image ?? null,
      nextFile: null,
      removeExistingImage: false,
    };
  }

  private zoneById(regionId: string): DermatologyExamZone | null {
    const zone = this.payload.bodyMap.zones?.[regionId];
    return zone && this.hasZoneData(zone) ? zone : null;
  }

  private hasZoneData(zone: DermatologyExamZone | null | undefined): boolean {
    return !!zone && (!!this.normalizeMultilineText(zone.description) || !!zone.image?.fileUrl);
  }

  private applyPatientSexToPayload(patientSex: string, allowAutosave: boolean): void {
    const nextGender = this.normalizeBodyGender(patientSex);
    if (this.payload.bodyMap.gender === nextGender) {
      return;
    }

    this.payload = {
      bodyMap: {
        ...this.payload.bodyMap,
        gender: nextGender,
      },
    };

    if (allowAutosave && !this.isHydratingFromBackend) {
      this.queueAutosave();
      this.emitPayloadChange();
    }
  }

  private mapDocumentToExamImage(documentResponse: {
    id: string;
    fileUrl: string;
    originalFileName: string;
    contentType: string;
    fileSizeBytes: number;
    createdAt: string;
  }): DermatologyExamImage {
    return {
      documentId: documentResponse.id,
      fileUrl: documentResponse.fileUrl,
      originalFileName: documentResponse.originalFileName,
      contentType: documentResponse.contentType,
      fileSizeBytes: documentResponse.fileSizeBytes,
      createdAt: documentResponse.createdAt,
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

    this.autosaveTrigger.next(JSON.stringify(this.payload));
  }

  private emitPayloadChange(): void {
    if (this.isHydratingFromBackend || this.isPreviewingHistory) {
      return;
    }

    this.payloadChange.emit(cloneConsultationExamPayload(this.payload));
  }

  private normalizeBodyGender(value: string): BodyGender {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return 'male';
    }

    const plain = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = plain.split(/[^a-z]+/).filter(Boolean);

    const isFemale =
      tokens.some((token) => ['f', 'femme', 'female', 'feminin', 'feminine', 'fem', 'woman', 'girl', 'fille'].includes(token)) ||
      ['f', 'femme', 'female', 'feminin', 'feminine', 'fem', 'woman', 'girl', 'fille'].includes(plain);
    if (isFemale) {
      return 'female';
    }

    const isMale =
      tokens.some((token) => ['m', 'homme', 'male', 'masculin', 'masculine', 'man', 'boy', 'garcon'].includes(token)) ||
      ['m', 'homme', 'male', 'masculin', 'masculine', 'man', 'boy', 'garcon'].includes(plain);
    if (isMale) {
      return 'male';
    }

    return 'male';
  }

  private normalizeText(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeMultilineText(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/\r\n/g, '\n').trim();
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

  private resetCurrentExamState(): void {
    this.payload = createDefaultConsultationExamPayload(this.normalizeBodyGender(this.patientSex ?? ''));
    this.persistedCurrentPayload = cloneConsultationExamPayload(this.payload);
    this.loadError = '';
    this.clearHistoryPreview();
    this.modalState = null;
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

  private toTitleCase(value: string): string {
    return value.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private baseRegionColor(regionId: string): string {
    let hash = 0;

    for (const character of regionId) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }

    const hue = 22 + (hash % 10);
    const saturation = 48 + (hash % 10);
    const lightness = 58 + (hash % 8);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }
}
