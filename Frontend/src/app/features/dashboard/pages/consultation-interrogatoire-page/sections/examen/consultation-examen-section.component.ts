import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
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
import { Router } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import * as QRCode from 'qrcode';
import {
  BodyGender,
  BodyView,
  ConsultationExamPayload,
  DermatologyExamDrawing,
  DermatologyExamDrawingLesion,
  DermatologyExamImage,
  DermatologyExamZone,
  cloneConsultationExamPayload,
  createDefaultConsultationExamPayload,
  createDefaultDermatologyExamZone,
} from '../../../../../../core/models/exam.models';
import { ConsultationExplorationDocumentResponse } from '../../../../../../core/models/documents.models';
import { PatientConsultation } from '../../../../../../core/models/patient.models';
import { DocumentsService } from '../../../../../../core/services/documents.service';
import {
  ConsultationExamRealtimeEvent,
  ExamRealtimeService,
} from '../../../../../../core/services/exam-realtime.service';
import { ExamService } from '../../../../../../core/services/exam.service';
import { ExamPhoneModeSessionService } from '../../../../../../core/services/exam-phone-mode-session.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { PatientService } from '../../../../../../core/services/patient.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { bodyBack } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyBack';
import { bodyFemaleBack } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyFemaleBack';
import { bodyFemaleFront } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyFemaleFront';
import { bodyFront } from '../../../sketchfab-test-page/react-muscle-assets/assets/bodyFront';
import { BodyPart, BodyPartSide } from '../../../sketchfab-test-page/react-muscle-assets';
import { BODY_OUTLINE_PATHS } from '../../../sketchfab-test-page/sketchfab-test-page';
import {
  BODY_REGION_DEFINITIONS,
  BodyRegionBounds,
  BodyRegionDefinition,
} from './consultation-examen-body-regions';
import { buildExamRegionId, formatExamRegionLabel } from './consultation-exam-body-map.utils';

type RegionSegment = 'common' | BodyPartSide;
type RegionKeyPart = string;

type DrawingPoint = {
  x: number;
  y: number;
};

type ZoneDrawingLesionState = {
  id: string;
  path: string;
  description: string;
  dermoscopie: string;
  existingImage: DermatologyExamImage | null;
  nextFile: File | null;
  removeExistingImage: boolean;
};

type SavedDrawingLesion = DermatologyExamDrawingLesion & {
  previousDocumentIdToDelete: string | null;
};

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
  drawingLesions: ZoneDrawingLesionState[];
  selectedDrawingLesionId: string | null;
  removedDrawingDocumentIds: string[];
  draftDrawingPath: string;
};

type BodyDrawingSurface = {
  viewBox: string;
  parts: BodyPart[];
  region: BodyRegionDefinition | null;
};

const DRAWING_ZOOM_LEVELS = [1, 1.5, 2, 3] as const;

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
  private readonly examRealtime = inject(ExamRealtimeService);
  private readonly phoneModeSession = inject(ExamPhoneModeSessionService);
  private readonly patientService = inject(PatientService);
  private readonly documentsService = inject(DocumentsService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

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
  protected isPhoneModeQrOpen = false;
  protected phoneModeQrUrl = '';
  protected phoneModeQrImageUrl = '';
  protected isPhoneModeQrBusy = false;
  protected selectedHistoryConsultationId: string | null = null;
  protected previewSourceDate: string | null = null;
  protected isPreviewingHistory = false;
  protected timelineScrollProgress = 0;
  protected modalState: ZoneModalState | null = null;
  protected isSavingZone = false;
  protected readonly drawingZoomLevels = DRAWING_ZOOM_LEVELS;
  protected drawingZoom = 1;
  protected isDrawingPanning = false;

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
  private activeDrawingPoints: DrawingPoint[] = [];
  private drawingPanOffset: DrawingPoint = { x: 0, y: 0 };
  private drawingPanPointerId: number | null = null;
  private drawingPanLastClientPoint: DrawingPoint | null = null;
  private pendingRealtimePayload: ConsultationExamPayload | null = null;
  private isDestroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
    });
  }

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
    return this.documentedZones.reduce((count, zone) => {
      const drawingLesionCount = zone.drawing?.lesions?.length ?? 0;
      return count + (drawingLesionCount > 0 ? drawingLesionCount : 1);
    }, 0);
  }

  protected get imageCount(): number {
    return this.documentedZones.reduce((count, zone) => {
      const zoneImageCount = zone.image?.fileUrl ? 1 : 0;
      const drawingImageCount = zone.drawing?.lesions?.filter((lesion) => !!lesion.image?.fileUrl).length ?? 0;
      return count + zoneImageCount + drawingImageCount;
    }, 0);
  }

  protected get selectedDrawingLesion(): ZoneDrawingLesionState | null {
    if (!this.modalState?.selectedDrawingLesionId) {
      return null;
    }

    return (
      this.modalState.drawingLesions.find((lesion) => lesion.id === this.modalState?.selectedDrawingLesionId) ?? null
    );
  }

  protected get drawingZoomLabel(): string {
    return `${Math.round(this.drawingZoom * 100)}%`;
  }

  protected bodyPartsFor(view: BodyView): BodyPart[] {
    if (this.bodyGender === 'female') {
      return view === 'front' ? bodyFemaleFront : bodyFemaleBack;
    }

    return view === 'front' ? bodyFront : bodyBack;
  }

  protected bodySelectablePartsFor(view: BodyView): BodyPart[] {
    return this.bodyPartsFor(view);
  }

  protected get isDrawingModal(): boolean {
    return !!this.modalState && !!this.bodyRegionDefinitionFor(this.modalState);
  }

  protected viewBoxFor(view: BodyView): string {
    if (this.bodyGender === 'female') {
      return view === 'front' ? '-60 -10 760 1505' : '740 -10 810 1505';
    }

    return view === 'front' ? '0 0 724 1448' : '724 0 724 1448';
  }

  protected outlinePathFor(view: BodyView): string {
    return BODY_OUTLINE_PATHS[this.bodyGender][view];
  }

  protected bodyRegionsFor(view: BodyView): BodyRegionDefinition[] {
    return BODY_REGION_DEFINITIONS[this.bodyGender][view];
  }

  protected bodyRegionId(view: BodyView, region: BodyRegionDefinition): string {
    return this.regionId(view, region.slug, region.segment, region.pathIndex);
  }

  protected bodyRegionFill(view: BodyView, region: BodyRegionDefinition): string {
    return this.zoneById(this.bodyRegionId(view, region)) ? '#d94b5f' : region.color;
  }

  protected bodyRegionClass(view: BodyView, region: BodyRegionDefinition): string {
    return this.zoneById(this.bodyRegionId(view, region))
      ? 'body-region-path is-documented'
      : 'body-region-path';
  }

  protected drawingSurfaceFor(modalState: ZoneModalState): BodyDrawingSurface {
    const region = this.bodyRegionDefinitionFor(modalState);
    return {
      viewBox: this.drawingViewBoxForRegion(modalState.view, region, this.drawingZoom),
      parts: this.bodyPartsFor(modalState.view),
      region,
    };
  }

  private bodyRegionDefinitionFor(modalState: Pick<ZoneModalState, 'view' | 'slug' | 'segment' | 'pathIndex'>): BodyRegionDefinition | null {
    return (
      this.bodyRegionsFor(modalState.view).find(
        (region) =>
          region.slug === modalState.slug &&
          region.segment === modalState.segment &&
          region.pathIndex === modalState.pathIndex,
      ) ?? null
    );
  }

  private drawingViewBoxForRegion(view: BodyView, region: BodyRegionDefinition | null, zoom = 1): string {
    const bounds = this.drawingBoundsForRegion(view, region);
    return this.formatViewBox(this.zoomDrawingBounds(bounds, bounds, zoom, region?.bounds ?? bounds, this.drawingPanOffset));
  }

  private drawingBoundsForRegion(view: BodyView, region: BodyRegionDefinition | null): BodyRegionBounds {
    const fullViewBox = this.parseViewBox(this.viewBoxFor(view));
    if (!region) {
      return fullViewBox;
    }

    const paddingX = Math.max(region.bounds.width * 0.18, 24);
    const paddingY = Math.max(region.bounds.height * 0.18, 24);
    const left = Math.max(fullViewBox.x, region.bounds.x - paddingX);
    const top = Math.max(fullViewBox.y, region.bounds.y - paddingY);
    const right = Math.min(fullViewBox.x + fullViewBox.width, region.bounds.x + region.bounds.width + paddingX);
    const bottom = Math.min(fullViewBox.y + fullViewBox.height, region.bounds.y + region.bounds.height + paddingY);

    return {
      x: left,
      y: top,
      width: Math.max(80, right - left),
      height: Math.max(80, bottom - top),
    };
  }

  private zoomDrawingBounds(
    bounds: BodyRegionBounds,
    clampBounds: BodyRegionBounds,
    zoom: number,
    focusBounds = bounds,
    panOffset: DrawingPoint = { x: 0, y: 0 },
  ): BodyRegionBounds {
    const safeZoom = this.clampNumber(zoom, DRAWING_ZOOM_LEVELS[0], DRAWING_ZOOM_LEVELS[DRAWING_ZOOM_LEVELS.length - 1]);
    const width = Math.max(80, Math.min(bounds.width, bounds.width / safeZoom));
    const height = Math.max(80, Math.min(bounds.height, bounds.height / safeZoom));
    const centerX = focusBounds.x + focusBounds.width / 2 + (safeZoom > 1 ? panOffset.x : 0);
    const centerY = focusBounds.y + focusBounds.height / 2 + (safeZoom > 1 ? panOffset.y : 0);
    const maxX = clampBounds.x + clampBounds.width - width;
    const maxY = clampBounds.y + clampBounds.height - height;

    return {
      x: this.clampNumber(centerX - width / 2, clampBounds.x, maxX),
      y: this.clampNumber(centerY - height / 2, clampBounds.y, maxY),
      width,
      height,
    };
  }

  private formatViewBox(bounds: BodyRegionBounds): string {
    return [
      this.formatDrawingNumber(bounds.x),
      this.formatDrawingNumber(bounds.y),
      this.formatDrawingNumber(bounds.width),
      this.formatDrawingNumber(bounds.height),
    ].join(' ');
  }

  private parseViewBox(viewBox: string): BodyRegionBounds {
    const [x, y, width, height] = viewBox
      .split(/\s+/)
      .map((part) => Number(part))
      .filter((value) => Number.isFinite(value));

    return {
      x: x ?? 0,
      y: y ?? 0,
      width: width ?? 724,
      height: height ?? 1448,
    };
  }

  ngOnInit(): void {
    void this.examRealtime.connect();
    this.examRealtime.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.handleRealtimeUpdate(event);
      });

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
    return buildExamRegionId(view, slug, segment, pathIndex);
  }

  protected regionLabel(regionId: string): string {
    return formatExamRegionLabel(regionId, (key) => this.i18n.t(key));
  }

  protected pathFill(regionId: string): string {
    if (this.zoneById(regionId)) {
      return '#d94b5f';
    }

    if (this.bodyGender === 'female' && regionId === 'front|head|common|0') {
      return '#ffffff';
    }

    return this.baseRegionColor(regionId);
  }

  protected pathClass(regionId: string): string {
    return this.zoneById(regionId) ? 'muscle-path is-documented' : 'muscle-path';
  }

  protected onRegionClick(regionId: string): void {
    this.openZoneModal(regionId);
  }

  protected openPhoneMode(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId) {
      return;
    }

    if (this.phoneModeSession.isMobileDevice()) {
      void this.router.navigate(['/consultations', consultationId, 'phone-mode']);
      return;
    }

    this.isPhoneModeQrOpen = true;
    this.isPhoneModeQrBusy = true;
    this.phoneModeQrImageUrl = '';
    this.renderNow();

    try {
      const launchUrl = this.phoneModeSession.buildLaunchUrl(consultationId);
      this.phoneModeQrUrl = launchUrl;

      void QRCode.toDataURL(launchUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
      })
        .then((imageUrl: string) => {
          this.phoneModeQrImageUrl = imageUrl;
          this.renderNow();
        })
        .catch(() => {
          this.toastService.error(this.i18n.t('consultation.page.exam.phone.qrError'));
          this.renderNow();
        })
        .finally(() => {
          this.isPhoneModeQrBusy = false;
          this.renderNow();
        });
    } catch {
      this.isPhoneModeQrBusy = false;
      this.toastService.error(this.i18n.t('consultation.page.exam.phone.qrError'));
    }
  }

  protected closePhoneModeQr(): void {
    this.isPhoneModeQrOpen = false;
    this.phoneModeQrImageUrl = '';
  }

  protected async copyPhoneModeLink(): Promise<void> {
    if (!this.phoneModeQrUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.phoneModeQrUrl);
      this.toastService.success(this.i18n.t('consultation.page.exam.phone.copySuccess'));
    } catch {
      this.toastService.error(this.i18n.t('consultation.page.exam.phone.copyError'));
    }
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
    if (this.isDrawingModal) {
      this.updateSelectedDrawingLesion((lesion) => ({
        ...lesion,
        nextFile: file,
        removeExistingImage: file ? false : lesion.removeExistingImage,
      }));
      return;
    }

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

    if (this.isDrawingModal) {
      this.updateSelectedDrawingLesion((lesion) => ({
        ...lesion,
        nextFile: null,
        removeExistingImage: true,
      }));
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

    if (this.isDrawingModal) {
      this.clearHeadDrawing();
      return;
    }

    this.modalState = {
      ...this.modalState,
      description: '',
      nextFile: null,
      removeExistingImage: !!this.modalState.existingImage,
      drawingLesions: [],
      selectedDrawingLesionId: null,
      removedDrawingDocumentIds: [],
      draftDrawingPath: '',
    };
    this.activeDrawingPoints = [];
  }

  protected startHeadDrawing(event: PointerEvent): void {
    if (!this.modalState || !this.isDrawingModal || this.isSavingZone) {
      return;
    }

    if (this.shouldStartDrawingPan(event)) {
      this.startDrawingPan(event);
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const point = this.pointerEventToSvgPoint(event);
    this.activeDrawingPoints = [point];
    this.modalState = {
      ...this.modalState,
      draftDrawingPath: this.pointsToPath(this.activeDrawingPoints, false),
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected continueHeadDrawing(event: PointerEvent): void {
    if (this.isDrawingPanning) {
      this.continueDrawingPan(event);
      return;
    }

    if (!this.modalState || this.activeDrawingPoints.length === 0 || !this.isDrawingModal) {
      return;
    }

    const point = this.pointerEventToSvgPoint(event);
    const lastPoint = this.activeDrawingPoints[this.activeDrawingPoints.length - 1];
    if (this.distanceBetweenPoints(lastPoint, point) < 1.4) {
      return;
    }

    this.activeDrawingPoints = [...this.activeDrawingPoints, point];
    this.modalState = {
      ...this.modalState,
      draftDrawingPath: this.pointsToPath(this.activeDrawingPoints, false),
    };
    event.preventDefault();
  }

  protected finishHeadDrawing(event: PointerEvent): void {
    if (this.isDrawingPanning) {
      this.finishDrawingPan(event);
      return;
    }

    if (!this.modalState || this.activeDrawingPoints.length === 0) {
      return;
    }

    const nextLesions = [...this.modalState.drawingLesions];
    let selectedDrawingLesionId = this.modalState.selectedDrawingLesionId;
    if (this.activeDrawingPoints.length >= 3) {
      const lesion = this.createDrawingLesionState(this.pointsToPath(this.activeDrawingPoints, true));
      nextLesions.push(lesion);
      selectedDrawingLesionId = lesion.id;
    }

    this.activeDrawingPoints = [];
    this.modalState = {
      ...this.modalState,
      drawingLesions: nextLesions,
      selectedDrawingLesionId,
      draftDrawingPath: '',
    };
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected cancelHeadDrawing(event: PointerEvent): void {
    if (this.isDrawingPanning) {
      this.finishDrawingPan(event);
      return;
    }

    if (!this.modalState) {
      return;
    }

    this.activeDrawingPoints = [];
    this.modalState = {
      ...this.modalState,
      draftDrawingPath: '',
    };
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  }

  protected onDrawingContextMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected undoHeadDrawing(): void {
    if (!this.modalState || this.modalState.drawingLesions.length === 0) {
      return;
    }

    const removedLesion = this.modalState.drawingLesions[this.modalState.drawingLesions.length - 1];
    const removedDocumentIds = this.collectDrawingDocumentIds([removedLesion]);
    const nextLesions = this.modalState.drawingLesions.slice(0, -1);
    this.modalState = {
      ...this.modalState,
      drawingLesions: nextLesions,
      selectedDrawingLesionId:
        this.modalState.selectedDrawingLesionId === removedLesion.id
          ? nextLesions[nextLesions.length - 1]?.id ?? null
          : this.modalState.selectedDrawingLesionId,
      removedDrawingDocumentIds: [...this.modalState.removedDrawingDocumentIds, ...removedDocumentIds],
      draftDrawingPath: '',
    };
    this.activeDrawingPoints = [];
  }

  protected clearHeadDrawing(): void {
    if (!this.modalState) {
      return;
    }

    const removedDocumentIds = this.collectDrawingDocumentIds(this.modalState.drawingLesions);
    this.modalState = {
      ...this.modalState,
      drawingLesions: [],
      selectedDrawingLesionId: null,
      removedDrawingDocumentIds: [...this.modalState.removedDrawingDocumentIds, ...removedDocumentIds],
      draftDrawingPath: '',
    };
    this.activeDrawingPoints = [];
  }

  protected zoomDrawingIn(): void {
    this.setDrawingZoomByStep(1);
  }

  protected zoomDrawingOut(): void {
    this.setDrawingZoomByStep(-1);
  }

  protected resetDrawingZoom(): void {
    this.drawingZoom = DRAWING_ZOOM_LEVELS[0];
    this.resetDrawingPan();
  }

  private setDrawingZoomByStep(direction: 1 | -1): void {
    const currentIndex = DRAWING_ZOOM_LEVELS.findIndex((level) => level === this.drawingZoom);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = this.clampNumber(safeIndex + direction, 0, DRAWING_ZOOM_LEVELS.length - 1);
    this.drawingZoom = DRAWING_ZOOM_LEVELS[nextIndex];
    if (this.drawingZoom === DRAWING_ZOOM_LEVELS[0]) {
      this.resetDrawingPan();
    } else {
      this.normalizeDrawingPanOffset();
    }
  }

  private shouldStartDrawingPan(event: PointerEvent): boolean {
    return event.pointerType === 'mouse' && event.button === 2 && this.drawingZoom > DRAWING_ZOOM_LEVELS[0];
  }

  private startDrawingPan(event: PointerEvent): void {
    this.isDrawingPanning = true;
    this.drawingPanPointerId = event.pointerId;
    this.drawingPanLastClientPoint = { x: event.clientX, y: event.clientY };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  private continueDrawingPan(event: PointerEvent): void {
    if (this.drawingPanPointerId !== event.pointerId || !this.drawingPanLastClientPoint) {
      return;
    }

    const svg = event.currentTarget as SVGSVGElement;
    const previousPoint = this.clientPointToSvgPoint(svg, this.drawingPanLastClientPoint.x, this.drawingPanLastClientPoint.y);
    const currentPoint = this.clientPointToSvgPoint(svg, event.clientX, event.clientY);
    this.drawingPanOffset = {
      x: this.drawingPanOffset.x - (currentPoint.x - previousPoint.x),
      y: this.drawingPanOffset.y - (currentPoint.y - previousPoint.y),
    };
    this.drawingPanLastClientPoint = { x: event.clientX, y: event.clientY };
    this.normalizeDrawingPanOffset();
    event.preventDefault();
    event.stopPropagation();
  }

  private finishDrawingPan(event: PointerEvent): void {
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    this.isDrawingPanning = false;
    this.drawingPanPointerId = null;
    this.drawingPanLastClientPoint = null;
    event.preventDefault();
    event.stopPropagation();
  }

  private resetDrawingPan(): void {
    this.isDrawingPanning = false;
    this.drawingPanPointerId = null;
    this.drawingPanLastClientPoint = null;
    this.drawingPanOffset = { x: 0, y: 0 };
  }

  private normalizeDrawingPanOffset(): void {
    if (!this.modalState || this.drawingZoom <= DRAWING_ZOOM_LEVELS[0]) {
      this.drawingPanOffset = { x: 0, y: 0 };
      return;
    }

    const region = this.bodyRegionDefinitionFor(this.modalState);
    const bounds = this.drawingBoundsForRegion(this.modalState.view, region);
    const focusBounds = region?.bounds ?? bounds;
    const viewBox = this.zoomDrawingBounds(bounds, bounds, this.drawingZoom, focusBounds, this.drawingPanOffset);

    this.drawingPanOffset = {
      x: viewBox.x + viewBox.width / 2 - (focusBounds.x + focusBounds.width / 2),
      y: viewBox.y + viewBox.height / 2 - (focusBounds.y + focusBounds.height / 2),
    };
  }

  protected deleteSelectedHeadLesion(): void {
    if (!this.modalState?.selectedDrawingLesionId) {
      return;
    }

    const selectedId = this.modalState.selectedDrawingLesionId;
    const selectedIndex = this.modalState.drawingLesions.findIndex((lesion) => lesion.id === selectedId);
    if (selectedIndex < 0) {
      return;
    }

    const selectedLesion = this.modalState.drawingLesions[selectedIndex];
    const nextLesions = this.modalState.drawingLesions.filter((lesion) => lesion.id !== selectedId);
    const nextSelectedLesion = nextLesions[selectedIndex] ?? nextLesions[selectedIndex - 1] ?? null;
    this.modalState = {
      ...this.modalState,
      drawingLesions: nextLesions,
      selectedDrawingLesionId: nextSelectedLesion?.id ?? null,
      removedDrawingDocumentIds: [
        ...this.modalState.removedDrawingDocumentIds,
        ...this.collectDrawingDocumentIds([selectedLesion]),
      ],
      draftDrawingPath: '',
    };
    this.activeDrawingPoints = [];
  }

  protected selectHeadLesion(lesionId: string, event?: Event): void {
    if (!this.modalState) {
      return;
    }

    if (event instanceof PointerEvent && event.button !== 0) {
      return;
    }

    event?.stopPropagation();
    event?.preventDefault();
    this.activeDrawingPoints = [];
    this.modalState = {
      ...this.modalState,
      selectedDrawingLesionId: lesionId,
      draftDrawingPath: '',
    };
  }

  protected updateSelectedDrawingLesionDescription(description: string): void {
    this.updateSelectedDrawingLesion((lesion) => ({
      ...lesion,
      description,
    }));
  }

  protected updateSelectedDrawingLesionDermoscopie(dermoscopie: string): void {
    this.updateSelectedDrawingLesion((lesion) => ({
      ...lesion,
      dermoscopie,
    }));
  }

  protected closeZoneModal(): void {
    if (this.isSavingZone) {
      return;
    }

    this.activeDrawingPoints = [];
    this.drawingZoom = DRAWING_ZOOM_LEVELS[0];
    this.resetDrawingPan();
    this.modalState = null;
    this.flushPendingRealtimePayload();
  }

  protected saveZoneModal(): void {
    if (!this.modalState || !this.consultationId?.trim() || this.isSavingZone) {
      return;
    }

    const modalState = this.modalState;
    if (this.bodyRegionDefinitionFor(modalState)) {
      this.saveHeadDrawingZone(modalState);
      return;
    }

    const description = this.normalizeMultilineText(modalState.description);
    const previousImage = modalState.existingImage;
    const shouldRemoveExistingImage = !!previousImage && modalState.removeExistingImage && !modalState.nextFile;

    this.isSavingZone = true;

    const upload$: Observable<ConsultationExplorationDocumentResponse | null> = modalState.nextFile
      ? this.documentsService.createExplorationDocument(this.consultationId, {
          typeLabels: ['Dermatology lesion'],
          clinic: '',
          forfait: '',
          operator: '',
          precaution: '',
          additionalInformation: `${modalState.label}${description ? ` - ${description}` : ''}`,
          file: modalState.nextFile,
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
            regionId: modalState.regionId,
            label: modalState.label,
            slug: modalState.slug,
            segment: modalState.segment,
            pathIndex: modalState.pathIndex,
            view: modalState.view,
            description,
            image: nextImage,
            drawing: null,
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
          this.flushPendingRealtimePayload();
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
        },
        error: () => {
          this.isSavingZone = false;
          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
        },
      });
  }

  private saveHeadDrawingZone(modalState: ZoneModalState): void {
    this.isSavingZone = true;

    const drawableLesions = modalState.drawingLesions.filter((lesion) => this.normalizeText(lesion.path).length > 0);
    const uploadOperations: Observable<SavedDrawingLesion>[] = drawableLesions.map((lesion, index) => {
      const description = this.normalizeMultilineText(lesion.description);
      const dermoscopie = this.normalizeMultilineText(lesion.dermoscopie);
      const previousDocumentId = lesion.existingImage?.documentId?.trim() || null;
      const baseLesion = {
        id: this.normalizeText(lesion.id) || this.createDrawingLesionId(),
        path: this.normalizeText(lesion.path),
        description,
        dermoscopie,
      };

      if (!lesion.nextFile) {
        return of({
          ...baseLesion,
          image: lesion.removeExistingImage ? null : lesion.existingImage,
          previousDocumentIdToDelete: lesion.removeExistingImage ? previousDocumentId : null,
        });
      }

      return this.documentsService
        .createExplorationDocument(this.consultationId!, {
          typeLabels: ['Dermatology lesion'],
          clinic: '',
          forfait: '',
          operator: '',
          precaution: '',
          additionalInformation: `${modalState.label} - Lesion ${index + 1}${description ? ` - ${description}` : ''}`,
          file: lesion.nextFile,
        })
        .pipe(
          map((documentResponse) => ({
            ...baseLesion,
            image: this.mapDocumentToExamImage(documentResponse),
            previousDocumentIdToDelete: previousDocumentId,
          })),
        );
    });

    const uploads$ = uploadOperations.length > 0 ? forkJoin(uploadOperations) : of([] as SavedDrawingLesion[]);

    uploads$
      .pipe(
        switchMap((savedLesions) => {
          const drawing = this.createDrawingFromLesions(savedLesions, modalState.view);
          const currentZones = { ...(this.payload.bodyMap.zones ?? {}) };
          const nextZone = createDefaultDermatologyExamZone({
            regionId: modalState.regionId,
            label: modalState.label,
            slug: modalState.slug,
            segment: modalState.segment,
            pathIndex: modalState.pathIndex,
            view: modalState.view,
            description: '',
            image: null,
            drawing,
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
              documentIdsToDelete: [
                ...modalState.removedDrawingDocumentIds,
                ...savedLesions.map((lesion) => lesion.previousDocumentIdToDelete),
              ],
            })),
          );
        }),
        switchMap(({ response, documentIdsToDelete }) =>
          this.deleteExplorationDocumentsAfterSave(response, documentIdsToDelete),
        ),
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
          this.flushPendingRealtimePayload();
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
    return image?.fileUrl
      ? this.documentsService.resolveAssetUrl(image.fileUrl, this.buildImageCacheBuster(image))
      : '';
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
          this.flushPendingRealtimePayload();
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
      const slug = this.normalizeText(rawZone?.slug || 'unknown');
      const zone = createDefaultDermatologyExamZone({
        regionId: this.normalizeText(rawZone?.regionId || regionId),
        label: this.normalizeText(rawZone?.label || this.regionLabel(regionId)),
        slug,
        segment,
        pathIndex: Number.isFinite(Number(rawZone?.pathIndex)) ? Number(rawZone?.pathIndex) : 0,
        view,
        description: this.normalizeMultilineText(rawZone?.description ?? ''),
        image: this.normalizeImage(rawZone?.image),
        drawing: this.normalizeDrawing(rawZone?.drawing),
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

  private normalizeDrawing(drawing: DermatologyExamZone['drawing'] | null | undefined): DermatologyExamDrawing | null {
    const lesions: DermatologyExamDrawingLesion[] = Array.isArray(drawing?.lesions)
      ? drawing.lesions
          .map((lesion, index) => this.normalizeDrawingLesion(lesion, `lesion-${index + 1}`))
          .filter((lesion): lesion is DermatologyExamDrawingLesion => !!lesion)
      : [];

    if (lesions.length === 0 && Array.isArray(drawing?.paths)) {
      drawing.paths
        .map((path) => this.normalizeText(path))
        .filter((path) => path.length > 0)
        .forEach((path, index) => {
          lesions.push({
            id: `legacy-lesion-${index + 1}`,
            path,
            description: '',
            dermoscopie: '',
            image: null,
          });
        });
    }

    const normalizedLesions = lesions.slice(0, 24);
    if (normalizedLesions.length === 0) {
      return null;
    }

    return {
      viewBox: this.normalizeText(drawing?.viewBox ?? '') || '0 0 200 260',
      lesions: normalizedLesions,
    };
  }

  private normalizeDrawingLesion(
    lesion: DermatologyExamDrawingLesion | null | undefined,
    fallbackId: string,
  ): DermatologyExamDrawingLesion | null {
    const path = this.normalizeText(lesion?.path ?? '');
    if (!path) {
      return null;
    }

    return {
      id: this.normalizeText(lesion?.id ?? '') || fallbackId,
      path,
      description: this.normalizeMultilineText(lesion?.description ?? ''),
      dermoscopie: this.normalizeMultilineText(lesion?.dermoscopie ?? ''),
      image: this.normalizeImage(lesion?.image),
    };
  }

  private createDrawingFromLesions(lesions: SavedDrawingLesion[], view: BodyView): DermatologyExamDrawing | null {
    const normalizedLesions = lesions
      .map((lesion, index) => this.normalizeDrawingLesion(lesion, `lesion-${index + 1}`))
      .filter((lesion): lesion is DermatologyExamDrawingLesion => !!lesion)
      .slice(0, 24);

    if (
      normalizedLesions.length === 0 ||
      !this.modalState ||
      !this.bodyRegionDefinitionFor(this.modalState)
    ) {
      return null;
    }

    return {
      viewBox: this.drawingViewBoxForRegion(view, this.bodyRegionDefinitionFor(this.modalState)),
      lesions: normalizedLesions,
    };
  }

  private pointerEventToSvgPoint(event: PointerEvent): DrawingPoint {
    const svg = event.currentTarget as SVGSVGElement;
    return this.clientPointToSvgPoint(svg, event.clientX, event.clientY);
  }

  private clientPointToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): DrawingPoint {
    const viewBox = svg.viewBox.baseVal;
    const screenMatrix = svg.getScreenCTM();

    if (screenMatrix) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const svgPoint = point.matrixTransform(screenMatrix.inverse());

      return {
        x: this.clampNumber(svgPoint.x, viewBox.x, viewBox.x + viewBox.width),
        y: this.clampNumber(svgPoint.y, viewBox.y, viewBox.y + viewBox.height),
      };
    }

    const rect = svg.getBoundingClientRect();
    const xRatio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const yRatio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
    const x = viewBox.x + xRatio * viewBox.width;
    const y = viewBox.y + yRatio * viewBox.height;

    return {
      x: this.clampNumber(x, viewBox.x, viewBox.x + viewBox.width),
      y: this.clampNumber(y, viewBox.y, viewBox.y + viewBox.height),
    };
  }

  private pointsToPath(points: DrawingPoint[], closePath: boolean): string {
    if (points.length === 0) {
      return '';
    }

    const [firstPoint, ...remainingPoints] = points;
    const commands = [
      `M ${this.formatDrawingNumber(firstPoint.x)} ${this.formatDrawingNumber(firstPoint.y)}`,
      ...remainingPoints.map((point) => `L ${this.formatDrawingNumber(point.x)} ${this.formatDrawingNumber(point.y)}`),
    ];

    return closePath ? `${commands.join(' ')} Z` : commands.join(' ');
  }

  private distanceBetweenPoints(left: DrawingPoint, right: DrawingPoint): number {
    const deltaX = left.x - right.x;
    const deltaY = left.y - right.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  private clampNumber(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private formatDrawingNumber(value: number): string {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  private openZoneModal(regionId: string): void {
    const [viewValue, slugValue, segmentValue, pathIndexValue] = regionId.split('|');
    const existingZone = this.zoneById(regionId);
    const existingDrawing = this.normalizeDrawing(existingZone?.drawing);
    const drawingLesions = existingDrawing?.lesions.map((lesion) => this.toDrawingLesionState(lesion)) ?? [];

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
      drawingLesions,
      selectedDrawingLesionId: drawingLesions[0]?.id ?? null,
      removedDrawingDocumentIds: [],
      draftDrawingPath: '',
    };
    this.activeDrawingPoints = [];
    this.drawingZoom = DRAWING_ZOOM_LEVELS[0];
    this.resetDrawingPan();
  }

  private zoneById(regionId: string): DermatologyExamZone | null {
    const zone = this.payload.bodyMap.zones?.[regionId];
    return zone && this.hasZoneData(zone) ? zone : null;
  }

  private hasZoneData(zone: DermatologyExamZone | null | undefined): boolean {
    return !!zone && (
      !!this.normalizeMultilineText(zone.description) ||
      !!zone.image?.fileUrl ||
      !!zone.drawing?.lesions?.length ||
      !!zone.drawing?.paths?.length
    );
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

  private buildImageCacheBuster(image: DermatologyExamImage | null | undefined): string {
    if (!image) {
      return '';
    }

    return [
      image.documentId?.trim() ?? '',
      image.createdAt?.trim() ?? '',
      String(image.fileSizeBytes ?? ''),
    ].join(':');
  }

  private toDrawingLesionState(lesion: DermatologyExamDrawingLesion): ZoneDrawingLesionState {
    return {
      id: this.normalizeText(lesion.id) || this.createDrawingLesionId(),
      path: this.normalizeText(lesion.path),
      description: this.normalizeMultilineText(lesion.description),
      dermoscopie: this.normalizeMultilineText(lesion.dermoscopie ?? ''),
      existingImage: this.normalizeImage(lesion.image),
      nextFile: null,
      removeExistingImage: false,
    };
  }

  private createDrawingLesionState(path: string): ZoneDrawingLesionState {
    return {
      id: this.createDrawingLesionId(),
      path,
      description: '',
      dermoscopie: '',
      existingImage: null,
      nextFile: null,
      removeExistingImage: false,
    };
  }

  private updateSelectedDrawingLesion(
    update: (lesion: ZoneDrawingLesionState) => ZoneDrawingLesionState,
  ): void {
    if (!this.modalState?.selectedDrawingLesionId) {
      return;
    }

    const selectedId = this.modalState.selectedDrawingLesionId;
    this.modalState = {
      ...this.modalState,
      drawingLesions: this.modalState.drawingLesions.map((lesion) =>
        lesion.id === selectedId ? update(lesion) : lesion,
      ),
    };
  }

  private collectDrawingDocumentIds(lesions: ZoneDrawingLesionState[]): string[] {
    return lesions
      .map((lesion) => lesion.existingImage?.documentId?.trim() ?? '')
      .filter((documentId) => documentId.length > 0);
  }

  private createDrawingLesionId(): string {
    return `lesion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private deleteExplorationDocumentsAfterSave<T>(
    response: T,
    documentIds: Array<string | null | undefined>,
  ): Observable<T> {
    const uniqueDocumentIds = Array.from(
      new Set(documentIds.map((documentId) => documentId?.trim() ?? '').filter((documentId) => documentId.length > 0)),
    );

    if (!this.consultationId || uniqueDocumentIds.length === 0) {
      return of(response);
    }

    return forkJoin(
      uniqueDocumentIds.map((documentId) =>
        this.documentsService.deleteExplorationDocument(this.consultationId!, documentId).pipe(catchError(() => of(null))),
      ),
    ).pipe(map(() => response));
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

  private handleRealtimeUpdate(event: ConsultationExamRealtimeEvent): void {
    const currentConsultationId = this.consultationId?.trim().toLowerCase() ?? '';
    const eventConsultationId = event.consultationId?.trim().toLowerCase() ?? '';
    if (!currentConsultationId || currentConsultationId !== eventConsultationId) {
      return;
    }

    const normalizedPayload = this.normalizePayload(event.payload, this.patientSex ?? undefined);

    if (this.isPreviewingHistory || this.isApplyingHistoricalPayload) {
      this.persistedCurrentPayload = cloneConsultationExamPayload(normalizedPayload);
      return;
    }

    if (this.isSavingZone || this.isLoading) {
      this.pendingRealtimePayload = normalizedPayload;
      return;
    }

    this.applyRealtimePayload(normalizedPayload, !!this.modalState);
  }

  private flushPendingRealtimePayload(): void {
    if (!this.pendingRealtimePayload || this.modalState || this.isSavingZone || this.isLoading) {
      return;
    }

    const nextPayload = cloneConsultationExamPayload(this.pendingRealtimePayload);
    this.pendingRealtimePayload = null;
    this.applyRealtimePayload(nextPayload);
  }

  private applyRealtimePayload(payload: ConsultationExamPayload, syncModalState = false): void {
    this.isHydratingFromBackend = true;
    this.payload = cloneConsultationExamPayload(payload);
    this.persistedCurrentPayload = cloneConsultationExamPayload(payload);
    this.isHydratingFromBackend = false;

    if (syncModalState) {
      this.syncModalStateWithRealtimePayload(payload);
    }

    this.emitPayloadChange();
    this.renderNow();
  }

  private syncModalStateWithRealtimePayload(payload: ConsultationExamPayload): void {
    if (!this.modalState) {
      return;
    }

    const realtimeZone = payload.bodyMap.zones?.[this.modalState.regionId];
    const realtimeDrawing = this.normalizeDrawing(realtimeZone?.drawing);
    const realtimeLesionsById = new Map(
      (realtimeDrawing?.lesions ?? []).map((lesion) => [lesion.id, lesion] as const),
    );

    this.modalState = {
      ...this.modalState,
      existingImage:
        this.modalState.nextFile || this.modalState.removeExistingImage
          ? this.modalState.existingImage
          : this.normalizeImage(realtimeZone?.image),
      drawingLesions: this.modalState.drawingLesions.map((lesion) => {
        if (lesion.nextFile || lesion.removeExistingImage) {
          return lesion;
        }

        const realtimeLesion = realtimeLesionsById.get(lesion.id);
        return {
          ...lesion,
          existingImage: this.normalizeImage(realtimeLesion?.image),
        };
      }),
    };
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

  private renderNow(): void {
    if (this.isDestroyed) {
      return;
    }

    this.cdr.detectChanges();
  }
}
