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

type LesionShapeTemplateKey = 'round' | 'oval' | 'plaque' | 'annular' | 'linear' | 'triangle' | 'square' | 'acne' | 'psoriasis';
type LesionResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

type LesionShapeTemplate = {
  key: LesionShapeTemplateKey;
  label: string;
  previewPath: string;
};

type DrawingBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LesionResizeState = {
  lesionId: string;
  handle: LesionResizeHandle;
  startPoint: DrawingPoint;
  originalPath: string;
  originalBounds: DrawingBounds;
};

type LesionDragState = {
  lesionId: string;
  startPoint: DrawingPoint;
  originalPath: string;
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
const LESION_SHAPE_PREVIEW_VIEW_BOX = '0 0 40 40';
const LESION_SHAPE_TEMPLATES: LesionShapeTemplate[] = [
  {
    key: 'round',
    label: 'consultation.page.exam.bodyMap.shapes.round',
    previewPath: 'M 20 7 L 26.5 8.8 L 31.2 13.5 L 33 20 L 31.2 26.5 L 26.5 31.2 L 20 33 L 13.5 31.2 L 8.8 26.5 L 7 20 L 8.8 13.5 L 13.5 8.8 Z',
  },
  {
    key: 'oval',
    label: 'consultation.page.exam.bodyMap.shapes.oval',
    previewPath: 'M 20 9 L 28 11 L 33 16 L 35 20 L 33 24 L 28 29 L 20 31 L 12 29 L 7 24 L 5 20 L 7 16 L 12 11 Z',
  },
  {
    key: 'plaque',
    label: 'consultation.page.exam.bodyMap.shapes.plaque',
    previewPath: 'M 11 12 L 20 8 L 29 10 L 34 17 L 31 27 L 23 33 L 13 31 L 7 24 L 8 16 Z',
  },
  {
    key: 'annular',
    label: 'consultation.page.exam.bodyMap.shapes.annular',
    previewPath: 'M 20 7 L 27 9 L 32 14 L 34 21 L 31 28 L 25 32 L 17 33 L 10 29 L 6 22 L 8 14 L 13 9 Z M 20 15 L 16 16 L 14 20 L 16 24 L 21 25 L 25 23 L 26 19 L 24 16 Z',
  },
  {
    key: 'linear',
    label: 'consultation.page.exam.bodyMap.shapes.linear',
    previewPath: 'M 8 17 L 31 10 L 34 18 L 11 30 Z',
  },
  {
    key: 'triangle',
    label: 'consultation.page.exam.bodyMap.shapes.triangle',
    previewPath: 'M 20 7 L 34 32 L 6 32 Z',
  },
  {
    key: 'square',
    label: 'consultation.page.exam.bodyMap.shapes.square',
    previewPath: 'M 9 9 L 31 9 L 31 31 L 9 31 Z',
  },
  {
    key: 'acne',
    label: 'consultation.page.exam.bodyMap.shapes.acne',
    previewPath: 'M 33.6 26.9 C 33.2 27.4 31.9 26.5 31.4 26.9 C 30.8 27.4 30.3 28 30.3 28.9 C 30.3 29.1 30.3 29.4 30.3 29.6 C 30.6 30.3 34.9 31.1 35.6 30.6 C 36 30.2 36 28.6 35.6 28.2 C 34.9 27.8 34.3 27.3 33.6 26.9 Z M 32 16.5 C 31.4 16.6 30.9 16.6 30.3 16.8 C 30 17 29.6 17.2 29.2 17.5 C 28.7 18 27.8 21.3 28.7 21.9 C 29.2 22.2 30.7 21.9 31.2 21.9 C 31.5 21.9 32.5 22 32.8 21.9 C 33.2 21.6 33.3 19.3 33.1 18.8 C 32.8 18 32.4 17.3 32 16.5 Z M 26.5 7.8 C 25.8 8.4 25 9 24.3 9.8 C 23.1 11.1 23.8 10.7 23.2 11.8 C 21.6 14.7 21.3 16.2 24.6 16.2 C 24.8 16.2 26.3 16.4 26.5 16.2 C 27 15.5 27.8 12.3 27.3 11.1 C 27.3 11 27.1 11.1 27 11.1 C 27 11 26.8 10.9 26.8 10.8 C 26.6 10.3 27.1 10.5 26.5 10.1 C 26.4 10.1 26.2 10.2 26.2 10.1 C 26.2 9.3 26.4 8.5 26.5 7.8 Z M 13.6 18.2 C 11.8 19.7 9.6 20.6 7.8 22.2 C 7.4 22.6 7.1 23.2 6.7 23.5 C 6.4 23.8 5.9 23.9 5.6 24.2 C 5 24.9 4 27.5 4.5 28.6 C 5.7 31 12.3 32.2 14.4 31.6 C 15.1 31.4 15.2 30.5 15.5 29.9 C 15.6 29.7 16 29.8 16.1 29.6 C 16.9 27.9 16.1 28.7 16.3 27.6 C 16.8 25.2 16.6 24.8 16.1 22.5 C 16 22.3 16.1 22.1 16.1 21.9 C 15.9 21.3 15.6 21.6 15.2 21.5 C 12.9 21 15.2 21.5 14.1 20.8 C 14 20.7 13.7 21 13.6 20.8 C 13.5 20.8 13.7 20.6 13.6 20.5 C 13.5 20.4 13.4 20.5 13.3 20.5 C 13.4 19.7 13.5 18.9 13.6 18.2 Z',
  },
  {
    key: 'psoriasis',
    label: 'consultation.page.exam.bodyMap.shapes.psoriasis',
    previewPath: 'M 20.7 9.5 C 20.7 9.7 20.4 10.2 20.7 10.2 C 20.9 10.2 20.7 9.3 20.7 9.5 C 20.7 10.3 20.7 11.1 20.7 11.8 C 20.7 12 20.6 12.8 20.7 12.9 C 20.7 13 21.3 13.1 21.3 13.1 C 21.3 13.1 21.2 13.2 21.3 13.3 C 21.5 13.4 21.9 13.4 22.1 13.6 C 22.2 13.7 22.3 14.1 22.9 14.3 C 23.5 14.5 24.1 14.3 24.7 14.7 C 24.8 14.7 24.7 14.8 24.7 14.9 C 24.8 14.9 24.8 15 24.9 15 C 25 15.1 25.2 15 25.3 15 C 25.8 15.3 26.1 15.8 26.5 16.1 C 26.6 16.2 27.1 16.2 27.1 16.3 C 27.2 16.3 27.1 16.4 27.1 16.5 C 27.2 16.5 27.8 16.8 27.9 16.8 C 28.4 17 29.1 16.8 29.5 17 C 29.8 17.1 29.9 17.5 30.1 17.5 C 30.5 17.6 31.3 17.6 31.6 17.7 C 31.9 17.9 32.2 18.1 32.6 18.2 C 32.7 18.3 35.2 18.2 35.2 18.2 C 35.4 18.6 35.5 19.1 35.6 19.5 C 35.6 19.5 35.5 20.2 35.6 20.2 C 35.6 20.3 35.7 20.2 35.8 20.2 C 35.8 20.3 35.8 23 35.8 23.4 C 35.8 25.3 36 27.5 35.4 29.1 C 35.4 29.2 35.4 29.2 35.4 29.3 C 35.4 29.4 35.4 29.6 35.4 29.7 C 35.3 29.8 34.4 30.7 34.4 30.7 C 34.2 31 34.2 31.3 34 31.4 C 33.9 31.5 33.8 31.4 33.8 31.4 C 33.4 31.8 33.2 32.6 32.8 32.7 C 32.3 32.8 31.6 32.7 31.1 32.7 C 29.4 32.7 27.7 32.7 25.9 32.7 C 25.2 32.7 24.4 32.6 23.7 32.7 C 23.5 32.7 23.3 32.8 23.1 32.9 C 22.8 32.9 22.3 32.8 22.1 32.9 C 22 32.9 22 33 21.9 33.1 C 21.4 33.2 20.5 32.9 20.1 33.1 C 20 33.1 20 33.2 19.9 33.2 C 19.5 33.4 17.4 33.3 17 33.2 C 17 33.2 16.9 33.1 16.8 33.1 C 16.6 32.9 16.3 33.1 16 33.1 C 16 33 16.1 32.9 16 32.9 C 15.9 32.7 15.5 32.9 15.2 32.9 C 15.1 32.8 15 32.7 14.8 32.7 C 14.3 32.6 13.5 32.7 13 32.5 C 13 32.5 13.1 32.4 13 32.3 C 12.9 32.3 12.3 32.4 12.2 32.3 C 12.1 32.2 12.3 32 12.2 31.8 C 12.1 31.6 11.7 31.5 11.6 31.3 C 11.5 31.1 11.8 30.9 11.6 30.7 C 11.5 30.6 11.3 30.8 11.2 30.7 C 11.1 30.6 11.4 30.3 11.2 30.2 C 11.2 30.2 11 30.3 11 30.2 C 10.9 30.1 11.1 29.4 11 29.3 C 11 29.3 10.9 29.3 10.8 29.3 C 10.8 29.3 10.8 26 10.8 25.6 C 10.8 22.9 10.8 20.3 10.8 17.7 C 10.8 17.4 11 16.6 10.8 16.3 C 10.8 16.2 10.7 16.3 10.6 16.3 C 10.4 16.1 10.4 15.8 10.2 15.6 C 10 15.3 9.6 15.1 9.4 14.9 C 8.9 14.3 9.5 14.8 9.2 14 C 9.2 13.9 9 14 9 14 C 8.9 13.9 8.7 13.4 8.6 13.3 C 8.5 13.2 8.5 11.9 8.6 11.8 C 8.6 11.8 8.7 11.9 8.8 11.8 C 9.1 11.5 9.1 11.2 9.6 10.9 C 10.3 10.5 11.4 10 12 9.5 C 12.1 9.5 12 9.4 12 9.3 C 12.1 9.2 12.3 9.4 12.4 9.3 C 12.6 9.3 12.6 9 12.8 9 C 13 8.9 13.3 8.9 13.4 8.8 C 14.3 8.4 13.2 8.8 13.6 8.4 C 13.7 8.4 13.8 8.5 13.8 8.4 C 14 8.4 14.1 8.2 14.2 8.1 C 14.4 8 14.9 8.2 15 8.1 C 15.1 8 15 7.9 15 7.9 C 15.3 7.8 15.6 8 15.8 7.9 C 16.5 7.8 17 7.7 17.7 7.7 C 18.3 7.7 19.3 7.6 19.9 7.9 C 20.3 8.1 20 8 20.1 8.3 C 20.2 8.7 20.5 9.1 20.7 9.5 Z M 7.2 8.1 C 7.2 7.8 7.4 7.4 7.2 7.4 C 6.9 7.4 7.2 8.3 7.2 8.1 C 7 7.6 7.1 7.1 7 6.7 C 7 6.6 5.6 6.7 5.6 6.7 C 5.4 6.7 4.4 7.5 4.4 7.7 C 4.3 7.9 4 9.9 4.2 10 C 4.3 10.1 4.6 10 4.8 10 C 5 10.2 6.6 10.8 7 10.6 C 7.3 10.4 7.3 9.8 7.4 9.5 C 7.5 9.1 8.1 9.6 8 9.3 C 7.8 8.9 7.4 8.5 7.2 8.1 Z',
  },
];

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
  protected readonly lesionShapeTemplates = LESION_SHAPE_TEMPLATES;
  protected readonly lesionShapePreviewViewBox = LESION_SHAPE_PREVIEW_VIEW_BOX;
  protected drawingZoom = 1;
  protected isDrawingPanning = false;
  protected selectedLesionShapeTemplateKey: LesionShapeTemplateKey | 'freehand' | null = null;

  protected selectFreehandTool(): void {
    if (this.isSavingZone) {
      return;
    }
    this.selectedLesionShapeTemplateKey =
      this.selectedLesionShapeTemplateKey === 'freehand' ? null : 'freehand';
    this.activeDrawingPoints = [];
    this.lesionResizeState = null;
    this.lesionDragState = null;
    if (this.modalState) {
      this.modalState = {
        ...this.modalState,
        draftDrawingPath: '',
      };
    }
  }

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
  private draggingLesionShapeTemplateKey: LesionShapeTemplateKey | null = null;
  private lesionResizeState: LesionResizeState | null = null;
  private lesionDragState: LesionDragState | null = null;
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

  protected get truncatedPhoneModeUrl(): string {
    const url = this.phoneModeQrUrl;
    if (!url) {
      return '';
    }
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      return url.substring(0, hashIndex) + '...';
    }
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
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

  protected selectLesionShapeTemplate(templateKey: LesionShapeTemplateKey): void {
    if (this.isSavingZone) {
      return;
    }

    this.selectedLesionShapeTemplateKey =
      this.selectedLesionShapeTemplateKey === templateKey ? null : templateKey;
    this.activeDrawingPoints = [];
    this.lesionResizeState = null;
    this.lesionDragState = null;
    if (this.modalState) {
      this.modalState = {
        ...this.modalState,
        draftDrawingPath: '',
      };
    }
  }

  protected startLesionShapeDrag(templateKey: LesionShapeTemplateKey, event: DragEvent): void {
    if (this.isSavingZone) {
      event.preventDefault();
      return;
    }

    this.draggingLesionShapeTemplateKey = templateKey;
    this.selectedLesionShapeTemplateKey = templateKey;
    event.dataTransfer?.setData('text/plain', templateKey);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  protected finishLesionShapeDrag(): void {
    this.draggingLesionShapeTemplateKey = null;
  }

  protected allowLesionShapeDrop(event: DragEvent): void {
    if (!this.isSavingZone && this.isDrawingModal) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    }
  }

  protected dropLesionShape(event: DragEvent): void {
    if (!this.modalState || this.isSavingZone || !this.isDrawingModal) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const templateKey = this.readDroppedLesionShapeKey(event);
    if (!templateKey) {
      return;
    }

    this.addLesionShapeAtPoint(templateKey, this.clientEventToSvgPoint(event));
    this.draggingLesionShapeTemplateKey = null;
  }

  private readDroppedLesionShapeKey(event: DragEvent): LesionShapeTemplateKey | null {
    const key = event.dataTransfer?.getData('text/plain');
    if (key && this.lesionShapeTemplates.some((t) => t.key === key)) {
      return key as LesionShapeTemplateKey;
    }
    return null;
  }

  protected addLesionShapeAtPoint(templateKey: LesionShapeTemplateKey, point: DrawingPoint): void {
    if (!this.modalState || this.isSavingZone) {
      return;
    }

    const template = this.lesionShapeTemplates.find((t) => t.key === templateKey);
    if (!template) {
      return;
    }

    // Default size is 16x16 units, centered on target point.
    // Original template preview bounds are 0 0 40 40, so original center is 20, 20.
    // SX = SY = 16 / 40 = 0.4
    const scale = 0.4;
    const newPath = this.transformPath(template.previewPath, point.x, point.y, scale, scale, 20, 20);
    const newLesion = this.createDrawingLesionState(newPath);

    this.modalState = {
      ...this.modalState,
      drawingLesions: [...this.modalState.drawingLesions, newLesion],
      selectedDrawingLesionId: newLesion.id,
      draftDrawingPath: '',
    };
    this.selectedLesionShapeTemplateKey = null;
  }

  private clientEventToSvgPoint(event: DragEvent): DrawingPoint {
    const svg = (event.currentTarget as Element).closest('svg') as SVGSVGElement;
    return this.clientPointToSvgPoint(svg, event.clientX, event.clientY);
  }

  protected resizeSelectedLesion(event: PointerEvent): void {
    if (!this.lesionResizeState || !this.modalState) {
      return;
    }

    const orig = this.lesionResizeState.originalBounds;
    const currentPoint = this.pointerEventToSvgPoint(event);
    const dx = currentPoint.x - this.lesionResizeState.startPoint.x;
    const dy = currentPoint.y - this.lesionResizeState.startPoint.y;

    let newX = orig.x;
    let newY = orig.y;
    let newWidth = orig.width;
    let newHeight = orig.height;

    const handle = this.lesionResizeState.handle;

    if (handle.includes('e')) {
      newWidth = orig.width + dx;
    } else if (handle.includes('w')) {
      newX = orig.x + dx;
      newWidth = orig.width - dx;
    }

    if (handle.includes('s')) {
      newHeight = orig.height + dy;
    } else if (handle.includes('n')) {
      newY = orig.y + dy;
      newHeight = orig.height - dy;
    }

    // Prevent exactly zero dimensions so the shape can still be resized later
    if (Math.abs(newWidth) < 1) {
      newWidth = newWidth < 0 ? -1 : 1;
    }
    if (Math.abs(newHeight) < 1) {
      newHeight = newHeight < 0 ? -1 : 1;
    }

    const targetBounds: DrawingBounds = {
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    };

    const newPath = this.resizePath(this.lesionResizeState.originalPath, orig, targetBounds);
    const lesionId = this.lesionResizeState.lesionId;

    this.modalState = {
      ...this.modalState,
      drawingLesions: this.modalState.drawingLesions.map((l) =>
        l.id === lesionId ? { ...l, path: newPath } : l
      ),
    };
  }

  protected finishLesionResize(event: PointerEvent): void {
    if (!this.lesionResizeState) {
      return;
    }
    try {
      (event.target as Element).releasePointerCapture?.(event.pointerId);
    } catch (e) {
      // Ignore
    }
    this.lesionResizeState = null;
    event.preventDefault();
    event.stopPropagation();
  }

  private moveSelectedLesion(event: PointerEvent): void {
    if (!this.lesionDragState || !this.modalState) {
      return;
    }

    const currentPoint = this.pointerEventToSvgPoint(event);
    const dx = currentPoint.x - this.lesionDragState.startPoint.x;
    const dy = currentPoint.y - this.lesionDragState.startPoint.y;
    const bounds = this.pathBounds(this.lesionDragState.originalPath);
    if (!bounds) {
      return;
    }

    // Translate: move to new position by shifting the center
    const targetBounds: DrawingBounds = {
      x: bounds.x + dx,
      y: bounds.y + dy,
      width: bounds.width,
      height: bounds.height,
    };
    const newPath = this.resizePath(this.lesionDragState.originalPath, bounds, targetBounds);
    const lesionId = this.lesionDragState.lesionId;

    this.modalState = {
      ...this.modalState,
      drawingLesions: this.modalState.drawingLesions.map((l) =>
        l.id === lesionId ? { ...l, path: newPath } : l
      ),
    };
  }

  private finishLesionDrag(event: PointerEvent): void {
    if (!this.lesionDragState) {
      return;
    }
    try {
      (event.target as Element).releasePointerCapture?.(event.pointerId);
    } catch (e) {
      // Ignore
    }
    this.lesionDragState = null;
    event.preventDefault();
    event.stopPropagation();
  }

  private pathBounds(path: string): DrawingBounds | null {
    if (!path) {
      return null;
    }
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
    if (!numbers || numbers.length < 2) {
      return null;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < numbers.length; i += 2) {
      if (i + 1 >= numbers.length) {
        break;
      }
      const x = numbers[i];
      const y = numbers[i + 1];
      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }
    }

    if (minX === Infinity || minY === Infinity) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private transformPath(
    path: string,
    dx: number,
    dy: number,
    sx: number,
    sy: number,
    cx: number,
    cy: number
  ): string {
    const regex = /([a-df-z]+)|(-?\d+(?:\.\d+)?)/gi;
    let match;
    let result = '';
    let isX = true;

    while ((match = regex.exec(path)) !== null) {
      const token = match[0];
      if (/[a-df-z]/i.test(token)) {
        result += token + ' ';
        isX = true;
      } else {
        const num = parseFloat(token);
        if (isX) {
          const val = dx + (num - cx) * sx;
          result += this.formatDrawingNumber(val) + ' ';
          isX = false;
        } else {
          const val = dy + (num - cy) * sy;
          result += this.formatDrawingNumber(val) + ' ';
          isX = true;
        }
      }
    }
    return result.trim();
  }

  private resizePath(path: string, orig: DrawingBounds, target: DrawingBounds): string {
    const regex = /([a-df-z]+)|(-?\d+(?:\.\d+)?)/gi;
    let match;
    let result = '';
    let isX = true;

    while ((match = regex.exec(path)) !== null) {
      const token = match[0];
      if (/[a-df-z]/i.test(token)) {
        result += token + ' ';
        isX = true;
      } else {
        const num = parseFloat(token);
        if (isX) {
          const nx = orig.width > 0 ? (num - orig.x) / orig.width : 0;
          const val = target.x + nx * target.width;
          result += this.formatDrawingNumber(val) + ' ';
          isX = false;
        } else {
          const ny = orig.height > 0 ? (num - orig.y) / orig.height : 0;
          const val = target.y + ny * target.height;
          result += this.formatDrawingNumber(val) + ' ';
          isX = true;
        }
      }
    }
    return result.trim();
  }

  protected startHeadDrawing(event: PointerEvent): void {
    if (!this.modalState || !this.isDrawingModal || this.isSavingZone) {
      return;
    }

    // If a lesion resize or drag-to-move is in progress, do NOT start any new drawing.
    if (this.lesionResizeState || this.lesionDragState) {
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

    if (this.selectedLesionShapeTemplateKey === 'freehand') {
      const point = this.pointerEventToSvgPoint(event);
      this.activeDrawingPoints = [point];
      this.modalState = {
        ...this.modalState,
        draftDrawingPath: this.pointsToPath(this.activeDrawingPoints, false),
      };
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    if (this.selectedLesionShapeTemplateKey) {
      const placedPoint = this.pointerEventToSvgPoint(event);
      this.addLesionShapeAtPoint(this.selectedLesionShapeTemplateKey, placedPoint);

      // Immediately enter resize mode from the SE corner so the user can
      // hold the mouse down and drag to size the newly placed shape.
      const placedLesion = this.selectedDrawingLesion;
      const placedBounds = placedLesion ? this.pathBounds(placedLesion.path) : null;
      if (placedLesion && placedBounds) {
        this.lesionResizeState = {
          lesionId: placedLesion.id,
          handle: 'se',
          startPoint: placedPoint,
          originalPath: placedLesion.path,
          originalBounds: placedBounds,
        };
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  protected continueHeadDrawing(event: PointerEvent): void {
    if (this.lesionResizeState) {
      this.resizeSelectedLesion(event);
      return;
    }

    if (this.lesionDragState) {
      this.moveSelectedLesion(event);
      return;
    }

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
    if (this.lesionResizeState) {
      this.finishLesionResize(event);
      return;
    }

    if (this.lesionDragState) {
      this.finishLesionDrag(event);
      return;
    }

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
    if (this.lesionResizeState) {
      this.finishLesionResize(event);
      return;
    }

    if (this.lesionDragState) {
      this.finishLesionDrag(event);
      return;
    }

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

  protected selectedLesionBounds(): DrawingBounds | null {
    const lesion = this.selectedDrawingLesion;
    return lesion ? this.pathBounds(lesion.path) : null;
  }

  protected lesionResizeHandlePoint(bounds: DrawingBounds, handle: LesionResizeHandle): DrawingPoint {
    const x = handle.includes('w') ? bounds.x : bounds.x + bounds.width;
    const y = handle.includes('n') ? bounds.y : bounds.y + bounds.height;
    return { x, y };
  }

  protected startLesionResize(handle: LesionResizeHandle, event: PointerEvent): void {
    const lesion = this.selectedDrawingLesion;
    const bounds = lesion ? this.pathBounds(lesion.path) : null;
    if (!this.modalState || !lesion || !bounds || this.isSavingZone || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    this.activeDrawingPoints = [];
    this.selectedLesionShapeTemplateKey = null;
    this.lesionResizeState = {
      lesionId: lesion.id,
      handle,
      startPoint: this.pointerEventToSvgPoint(event),
      originalPath: lesion.path,
      originalBounds: bounds,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
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

    // Initiate a drag-to-move gesture when no shape tool is selected
    if (event instanceof PointerEvent && !this.selectedLesionShapeTemplateKey) {
      const lesion = this.modalState.drawingLesions.find((l) => l.id === lesionId);
      if (lesion) {
        this.lesionDragState = {
          lesionId,
          startPoint: this.pointerEventToSvgPoint(event),
          originalPath: lesion.path,
        };
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      }
    }
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
    const target = event.currentTarget as Element;
    const svg = (target.tagName.toLowerCase() === 'svg' ? target : target.closest('svg')) as SVGSVGElement;
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
