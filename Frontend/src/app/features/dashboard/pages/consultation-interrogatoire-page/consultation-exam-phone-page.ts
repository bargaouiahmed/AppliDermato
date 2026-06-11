import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { AuthenticatedAccountResponse } from '../../../../core/models/auth.models';
import {
  ConsultationExamPayload,
  DermatologyExamDrawingLesion,
  DermatologyExamImage,
  DermatologyExamZone,
  cloneConsultationExamPayload,
  createDefaultConsultationExamPayload,
} from '../../../../core/models/exam.models';
import { ConsultationInterrogatoireResponse } from '../../../../core/models/interrogatoire.models';
import { Patient } from '../../../../core/models/patient.models';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ConsultationExamRealtimeEvent,
  ExamRealtimeService,
} from '../../../../core/services/exam-realtime.service';
import {
  ExamPhoneModeSessionService,
} from '../../../../core/services/exam-phone-mode-session.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import { ExamService } from '../../../../core/services/exam.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { PatientService } from '../../../../core/services/patient.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PhoneModeExitAware } from '../../../../core/guards/phone-mode-exit.guard';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { formatExamRegionLabel } from './sections/examen/consultation-exam-body-map.utils';

type PhoneZoneSummary = {
  zone: DermatologyExamZone;
  label: string;
  lesionCount: number;
  imageCount: number;
};

type PhoneZoneGroup = {
  view: 'front' | 'back';
  titleKey: string;
  zones: PhoneZoneSummary[];
};

@Component({
  selector: 'app-consultation-exam-phone-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './consultation-exam-phone-page.html',
  styleUrl: './consultation-exam-phone-page.css',
})
export class ConsultationExamPhonePage implements OnInit, PhoneModeExitAware {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly examRealtime = inject(ExamRealtimeService);
  private readonly phoneModeSession = inject(ExamPhoneModeSessionService);
  private readonly consultationService = inject(InterrogatoireService);
  private readonly patientService = inject(PatientService);
  private readonly examService = inject(ExamService);
  private readonly documentsService = inject(DocumentsService);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  protected consultationId = '';
  protected isLoading = true;
  protected loadError = '';
  protected isSavingPhoto = false;
  protected account: AuthenticatedAccountResponse | null = null;
  protected consultation: ConsultationInterrogatoireResponse | null = null;
  protected patient: Patient | null = null;
  protected payload: ConsultationExamPayload = createDefaultConsultationExamPayload();
  protected activeZoneId: string | null = null;
  protected activeDrawingLesionId: string | null = null;

  private requiredDoctorId: string | null = null;
  private hasPreparedExit = false;
  private isDestroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
    });
  }

  protected get patientDisplayName(): string {
    const lastname = this.patient?.lastname?.trim() ?? '';
    const firstname = this.patient?.firstname?.trim() ?? '';
    return `${lastname} ${firstname}`.trim() || this.i18n.t('consultation.page.none');
  }

  protected get canReturnToExam(): boolean {
    return !!this.auth.getAccessToken('cookie');
  }

  protected get zoneGroups(): PhoneZoneGroup[] {
    const summaries = this.documentedZones;
    const frontZones = summaries.filter((summary) => summary.zone.view === 'front');
    const backZones = summaries.filter((summary) => summary.zone.view === 'back');

    const groups: PhoneZoneGroup[] = [
      {
        view: 'front',
        titleKey: 'consultation.page.exam.bodyMap.front',
        zones: frontZones,
      },
      {
        view: 'back',
        titleKey: 'consultation.page.exam.bodyMap.back',
        zones: backZones,
      },
    ];

    return groups.filter((group) => group.zones.length > 0);
  }

  protected get documentedZones(): PhoneZoneSummary[] {
    const locale = this.i18n.lang();

    return Object.values(this.payload.bodyMap.zones ?? {})
      .filter((zone) => this.hasZoneData(zone))
      .map((zone) => ({
        zone,
        label: formatExamRegionLabel(zone.regionId, (key) => this.i18n.t(key)),
        lesionCount: zone.drawing?.lesions?.length ?? 1,
        imageCount: this.countZoneImages(zone),
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, locale, {
          sensitivity: 'base',
        }),
      );
  }

  protected get totalLesionCount(): number {
    return this.documentedZones.reduce((count, summary) => count + summary.lesionCount, 0);
  }

  protected get totalImageCount(): number {
    return this.documentedZones.reduce((count, summary) => count + summary.imageCount, 0);
  }

  protected get activeZone(): DermatologyExamZone | null {
    if (!this.activeZoneId) {
      return null;
    }

    return this.payload.bodyMap.zones?.[this.activeZoneId] ?? null;
  }

  protected get activeDrawingLesions(): DermatologyExamDrawingLesion[] {
    return this.activeZone?.drawing?.lesions ?? [];
  }

  protected get activeDrawingLesion(): DermatologyExamDrawingLesion | null {
    if (!this.activeDrawingLesionId) {
      return null;
    }

    return this.activeDrawingLesions.find((lesion) => lesion.id === this.activeDrawingLesionId) ?? null;
  }

  protected get activeSummary(): PhoneZoneSummary | null {
    const zoneId = this.activeZone?.regionId;
    return zoneId ? this.documentedZones.find((summary) => summary.zone.regionId === zoneId) ?? null : null;
  }

  protected get activeSelectionImage(): DermatologyExamImage | null {
    return this.activeDrawingLesion?.image ?? this.activeZone?.image ?? null;
  }

  protected get activeSelectionDescription(): string {
    return (
      this.activeDrawingLesion?.description?.trim() ||
      this.activeZone?.description?.trim() ||
      ''
    );
  }

  protected get activeSelectionTitle(): string {
    const label = this.activeSummary?.label ?? '';
    if (!label) {
      return '';
    }

    if (!this.activeDrawingLesion) {
      return label;
    }

    return `${label} • ${this.getLesionBadgeLabel(this.activeDrawingLesion, this.activeDrawingLesions.indexOf(this.activeDrawingLesion))}`;
  }

  protected get hasDrawingLesions(): boolean {
    return this.activeDrawingLesions.length > 0;
  }

  ngOnInit(): void {
    this.consultationId = this.route.snapshot.paramMap.get('consultationId')?.trim() ?? '';
    if (!this.consultationId) {
      this.loadError = 'consultation.page.loadError';
      this.isLoading = false;
      return;
    }

    if (!this.phoneModeSession.isMobileDevice()) {
      this.stripHashFromUrl();
      this.redirectToExam();
      return;
    }

    const session = this.phoneModeSession.prepareSession(this.phoneModeSession.consumeLaunchTokensFromHash());
    if (!session.ok) {
      this.loadError = session.errorKey ?? 'consultation.page.exam.phone.invalidSession';
      this.isLoading = false;
      return;
    }

    this.requiredDoctorId = session.requiredDoctorId;
    void this.examRealtime.connect();
    this.examRealtime.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.handleRealtimeUpdate(event);
      });

    this.loadPage();
  }

  @HostListener('window:beforeunload')
  protected onBeforeUnload(): void {
    this.preparePhoneModeExit();
  }

  preparePhoneModeExit(): void {
    if (this.hasPreparedExit) {
      return;
    }

    this.hasPreparedExit = true;
    this.phoneModeSession.cleanupSession();
  }

  protected selectZone(zoneId: string): void {
    if (this.activeZoneId === zoneId) {
      return;
    }

    this.activeZoneId = zoneId;
    this.activeDrawingLesionId = this.activeDrawingLesions[0]?.id ?? null;
  }

  protected selectDrawingLesion(lesionId: string): void {
    this.activeDrawingLesionId = lesionId;
  }

  protected getLesionBadgeLabel(lesion: DermatologyExamDrawingLesion, index: number): string {
    const shortId = lesion.id.slice(-6).toUpperCase();
    return `#${index + 1} · ${shortId}`;
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    this.uploadSelectedPhoto(file);
    if (input) {
      input.value = '';
    }
  }

  protected removeCurrentPhoto(): void {
    const previousImage = this.activeSelectionImage;
    if (!previousImage?.documentId) {
      return;
    }

    const nextPayload = this.buildNextPayloadWithImage(null);
    if (!nextPayload) {
      return;
    }

    this.isSavingPhoto = true;
    this.examService
      .updateConsultationExam(this.consultationId, { payload: nextPayload })
      .pipe(
        switchMap((response) =>
          this.documentsService.deleteExplorationDocument(this.consultationId, previousImage.documentId).pipe(
            map(() => response),
            catchError(() => of(response)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.applyPayload(response.payload);
          this.isSavingPhoto = false;
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
          this.renderNow();
        },
        error: () => {
          this.isSavingPhoto = false;
          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
          this.renderNow();
        },
      });
  }

  protected resolveImageUrl(image: DermatologyExamImage | null | undefined): string {
    return image?.fileUrl ? this.documentsService.resolveAssetUrl(image.fileUrl) : '';
  }

  protected returnToExam(): void {
    this.auth.clearStorageMode();
    void this.router.navigate(['/consultations', this.consultationId], {
      queryParams: { tab: 'examen' },
    });
  }

  private loadPage(): void {
    this.isLoading = true;
    this.loadError = '';

    this.auth
      .getAuthenticatedAccount()
      .pipe(
        switchMap((account) => {
          this.validateDoctorAccess(account);
          this.account = account;

          return this.consultationService.getConsultationInterrogatoire(this.consultationId);
        }),
        switchMap((consultation) => {
          this.consultation = consultation;

          return forkJoin({
            consultation: of(consultation),
            patient: this.patientService.getPatientById(consultation.patientId).pipe(catchError(() => of(null))),
            exam: this.examService.getConsultationExam(this.consultationId),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ patient, exam }) => {
          this.patient = patient;
          this.applyPayload(exam.payload);
          this.isLoading = false;
          this.renderNow();
        },
        error: (error) => {
          this.loadError = this.resolveLoadErrorKey(error);
          if (
            this.loadError === 'consultation.page.exam.phone.invalidSession' ||
            this.loadError === 'consultation.page.exam.phone.doctorMismatch' ||
            this.loadError === 'consultation.page.exam.phone.accessDenied'
          ) {
            this.preparePhoneModeExit();
          }
          this.isLoading = false;
          this.renderNow();
        },
      });
  }

  private uploadSelectedPhoto(file: File): void {
    const zone = this.activeZone;
    if (!zone) {
      return;
    }

    const previousImage = this.activeSelectionImage;
    this.isSavingPhoto = true;

    this.documentsService
      .createExplorationDocument(this.consultationId, {
        typeLabels: ['Dermatology lesion'],
        clinic: '',
        forfait: '',
        operator: '',
        precaution: '',
        additionalInformation: this.buildPhotoAdditionalInformation(zone, this.activeDrawingLesion),
        file,
      })
      .pipe(
        switchMap((documentResponse) => {
          const nextPayload = this.buildNextPayloadWithImage(this.mapDocumentToExamImage(documentResponse));
          if (!nextPayload) {
            return throwError(() => new Error('Unable to prepare next payload.'));
          }

          return this.examService.updateConsultationExam(this.consultationId, { payload: nextPayload }).pipe(
            map((response) => ({
              response,
              previousDocumentId: previousImage?.documentId?.trim() ?? '',
            })),
          );
        }),
        switchMap(({ response, previousDocumentId }) => {
          if (!previousDocumentId) {
            return of(response);
          }

          return this.documentsService.deleteExplorationDocument(this.consultationId, previousDocumentId).pipe(
            map(() => response),
            catchError(() => of(response)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.applyPayload(response.payload);
          this.isSavingPhoto = false;
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
          this.renderNow();
        },
        error: () => {
          this.isSavingPhoto = false;
          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
          this.renderNow();
        },
      });
  }

  private buildNextPayloadWithImage(nextImage: DermatologyExamImage | null): ConsultationExamPayload | null {
    const zone = this.activeZone;
    if (!zone) {
      return null;
    }

    const nextPayload = cloneConsultationExamPayload(this.payload);
    const nextZone = nextPayload.bodyMap.zones?.[zone.regionId];
    if (!nextZone) {
      return null;
    }

    if (this.activeDrawingLesion) {
      nextZone.drawing = nextZone.drawing
        ? {
            ...nextZone.drawing,
            lesions: nextZone.drawing.lesions.map((lesion) =>
              lesion.id === this.activeDrawingLesion?.id
                ? {
                    ...lesion,
                    image: nextImage,
                  }
                : lesion,
            ),
          }
        : nextZone.drawing;
    } else {
      nextZone.image = nextImage;
    }

    nextZone.updatedAt = new Date().toISOString();

    if (!this.hasZoneData(nextZone)) {
      delete nextPayload.bodyMap.zones[nextZone.regionId];
    }

    return nextPayload;
  }

  private applyPayload(payload: ConsultationExamPayload | null | undefined): void {
    this.payload = cloneConsultationExamPayload(payload ?? createDefaultConsultationExamPayload());
    this.ensureActiveSelection();
  }

  private ensureActiveSelection(): void {
    const summaries = this.documentedZones;
    if (summaries.length === 0) {
      this.activeZoneId = null;
      this.activeDrawingLesionId = null;
      return;
    }

    const selectedZone =
      summaries.find((summary) => summary.zone.regionId === this.activeZoneId)?.zone ?? summaries[0].zone;
    this.activeZoneId = selectedZone.regionId;

    const drawingLesions = selectedZone.drawing?.lesions ?? [];
    if (drawingLesions.length === 0) {
      this.activeDrawingLesionId = null;
      return;
    }

    this.activeDrawingLesionId =
      drawingLesions.find((lesion) => lesion.id === this.activeDrawingLesionId)?.id ?? drawingLesions[0].id;
  }

  private validateDoctorAccess(account: AuthenticatedAccountResponse): void {
    const role = this.auth.getTokenRole('localStorage');
    if (!role || !['doctor', 'admin', 'super_admin'].includes(role)) {
      throw new Error('access_denied');
    }

    if (this.requiredDoctorId && account.doctorId !== this.requiredDoctorId) {
      throw new Error('doctor_mismatch');
    }
  }

  private redirectToExam(): void {
    this.auth.clearStorageMode();
    void this.router.navigate(['/consultations', this.consultationId], {
      queryParams: { tab: 'examen' },
    });
  }

  private stripHashFromUrl(): void {
    if (typeof window === 'undefined' || !window.location.hash) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(window.history.state, document.title, cleanUrl);
  }

  private handleRealtimeUpdate(event: ConsultationExamRealtimeEvent): void {
    const eventConsultationId = event.consultationId?.trim().toLowerCase() ?? '';
    const currentConsultationId = this.consultationId.trim().toLowerCase();
    if (!currentConsultationId || currentConsultationId !== eventConsultationId) {
      return;
    }

    this.applyPayload(event.payload);
    this.renderNow();
  }

  private buildPhotoAdditionalInformation(
    zone: DermatologyExamZone,
    lesion: DermatologyExamDrawingLesion | null,
  ): string {
    const zoneLabel = formatExamRegionLabel(zone.regionId, (key) => this.i18n.t(key));
    if (!lesion) {
      return zoneLabel;
    }

    const lesionIndex = (zone.drawing?.lesions ?? []).findIndex((item) => item.id === lesion.id);
    const lesionLabel = this.getLesionBadgeLabel(lesion, Math.max(lesionIndex, 0));
    const description = lesion.description?.trim() ?? '';
    return `${zoneLabel} - ${lesionLabel}${description ? ` - ${description}` : ''}`;
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

  private hasZoneData(zone: DermatologyExamZone | null | undefined): boolean {
    return !!zone && (
      !!zone.description?.trim() ||
      !!zone.image?.fileUrl ||
      !!zone.drawing?.lesions?.length ||
      !!zone.drawing?.paths?.length
    );
  }

  private countZoneImages(zone: DermatologyExamZone): number {
    const zoneImageCount = zone.image?.fileUrl ? 1 : 0;
    const drawingImageCount = zone.drawing?.lesions?.filter((lesion) => !!lesion.image?.fileUrl).length ?? 0;
    return zoneImageCount + drawingImageCount;
  }

  private resolveLoadErrorKey(error: unknown): string {
    const message = this.extractErrorMessage(error);
    if (message.includes('doctor_mismatch')) {
      return 'consultation.page.exam.phone.doctorMismatch';
    }

    if (message.includes('access_denied')) {
      return 'consultation.page.exam.phone.accessDenied';
    }

    if (message.includes('consultation not found')) {
      return 'consultation.page.loadError';
    }

    if (message.includes('401') || message.includes('jwt')) {
      return 'consultation.page.exam.phone.invalidSession';
    }

    return 'consultation.page.exam.phone.loadError';
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message.toLowerCase();
    }

    if (!error || typeof error !== 'object') {
      return '';
    }

    if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
      const status = String((error as { status: number }).status);
      if (status === '401') {
        return '401';
      }
    }

    if ('error' in error) {
      const nested = (error as { error?: unknown }).error;
      if (typeof nested === 'string') {
        return nested.toLowerCase();
      }

      if (nested && typeof nested === 'object') {
        if ('message' in nested && typeof (nested as { message?: unknown }).message === 'string') {
          return ((nested as { message: string }).message).toLowerCase();
        }

        if ('Message' in nested && typeof (nested as { Message?: unknown }).Message === 'string') {
          return ((nested as { Message: string }).Message).toLowerCase();
        }
      }
    }

    return '';
  }

  private renderNow(): void {
    if (this.isDestroyed) {
      return;
    }

    this.cdr.detectChanges();
  }
}
