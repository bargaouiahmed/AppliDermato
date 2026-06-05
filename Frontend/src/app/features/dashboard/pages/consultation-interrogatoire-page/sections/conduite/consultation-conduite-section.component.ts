import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import {
  NgMultiLabelTemplateDirective,
  NgNotFoundTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import {
  ConduiteDocumentType,
  ConduiteCatalogItemResponse,
  ConsultationConduiteResponse,
  UpsertConsultationConduiteRequest,
} from '../../../../../../core/models/conduite.models';
import { DoctorProfile } from '../../../../../../core/models/doctor.models';
import { UpdateOngoingTreatmentMedicineRequest } from '../../../../../../core/models/interrogatoire.models';
import { AgendaService, CalendarSettings, Leave, Rdv } from '../../../../../../core/services/agenda.service';
import { ConduiteService } from '../../../../../../core/services/conduite.service';
import { DoctorService } from '../../../../../../core/services/doctor.service';
import { DoctorMotifService } from '../../../../../../core/services/doctor-motif.service';
import { I18nService } from '../../../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../../../core/services/interrogatoire.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { ConsultationConduiteCertificatFormComponent } from './components/consultation-conduite-certificat-form.component';
import { ConsultationConduiteCnamFormComponent } from './components/consultation-conduite-cnam-form.component';
import { ConsultationConduiteLettreConfrereFormComponent } from './components/consultation-conduite-lettre-confrere-form.component';
import { ConsultationConduiteOrdonnanceFormComponent } from './components/consultation-conduite-ordonnance-form.component';
import { ConsultationConduiteParacliniqueFormComponent } from './components/consultation-conduite-paraclinique-form.component';

type ParacliniquePrintSection = 'chirurgie' | 'imagerie' | 'bilan_sanguin';

type ParacliniquePrintRequest = {
  mode: 'single' | 'all';
  sections: ParacliniquePrintSection[];
};

type NextConsultationOffsetUnit = 'days' | 'months' | 'years';

type NextConsultationFormState = {
  offsetValue: number;
  offsetUnit: NextConsultationOffsetUnit;
  date: string;
  time: string;
  motifs: string[];
  duration: number;
};

@Component({
  selector: 'app-consultation-conduite-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgNotFoundTemplateDirective,
    NgMultiLabelTemplateDirective,
    TranslatePipe,
    ConsultationConduiteOrdonnanceFormComponent,
    ConsultationConduiteCertificatFormComponent,
    ConsultationConduiteCnamFormComponent,
    ConsultationConduiteLettreConfrereFormComponent,
    ConsultationConduiteParacliniqueFormComponent,
  ],
  templateUrl: './consultation-conduite-section.component.html',
  styleUrl: './consultation-conduite-section.component.css',
})
export class ConsultationConduiteSectionComponent implements OnInit, OnChanges {
  private static readonly DEFAULT_CERTIFICATE_TYPE = 'Certificat medical de repos';
  private static readonly PARACLINIQUE_GROUP_ACTION_KEY = 'paraclinique';
  private static readonly PARACLINIQUE_ACTION_KEYS = [
    'paraclinique_chirurgie',
    'paraclinique_imagerie',
    'paraclinique_bilan_sanguin',
  ] as const;

  @Input() consultationId: string | null = null;
  @Input() consultationDate = '';
  @Input() diagnostics: string[] = [];
  @Input() motifs: string[] = [];
  @Input() ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Input() focusActionKey: string | null = null;
  @Input() focusRequestId = 0;
  @Output() diagnosticsChange = new EventEmitter<string[]>();
  @Output() navigateToConclusion = new EventEmitter<void>();
  @Output() ongoingTreatmentsChange = new EventEmitter<UpdateOngoingTreatmentMedicineRequest[]>();
  @Output() conduiteChange = new EventEmitter<ConsultationConduiteResponse>();

  private readonly conduiteService = inject(ConduiteService);
  private readonly agendaService = inject(AgendaService);
  private readonly doctorService = inject(DoctorService);
  private readonly motifService = inject(DoctorMotifService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected actionCatalog: ConduiteCatalogItemResponse[] = [];
  protected consigneCatalog: string[] = [];
  protected selectedActionKeys: string[] = [];
  protected payloadByActionKey: Record<string, Record<string, unknown>> = {};
  protected expandedActionKey: string | null = null;
  protected printingDocumentType: ConduiteDocumentType | null = null;
  protected clinicOptions: string[] = [];
  protected diagnosticCatalog: string[] = [];
  protected diagnosticSelection: string[] = [];
  protected additionalInformation = '';
  protected isLoadingDiagnosticCatalog = false;
  protected nextConsultationForm = this.createDefaultNextConsultationForm();
  protected nextConsultationMotifCatalog: string[] = [];
  protected nextConsultationTimeSlots: string[] = [];
  protected nextConsultationDurationOptions = [15, 30, 45, 60, 90, 120];
  protected isLoadingNextConsultationSlots = false;
  protected isSchedulingNextConsultation = false;
  protected isLoading = false;
  protected loadError = '';

  private readonly autosaveTrigger = new Subject<string>();
  private isHydrating = false;
  private lastAutosaveToastAt = 0;
  private lastSyncedOngoingTreatmentsSignature = '';
  private pendingFocusActionKey: string | null = null;
  private nextConsultationSettings: CalendarSettings = {
    startHour: 8,
    endHour: 17,
    timeSlotInterval: 15,
  };
  private nextConsultationSlotsRequestId = 0;

  ngOnInit(): void {
    this.autosaveTrigger
      .pipe(
        debounceTime(550),
        distinctUntilChanged(),
        switchMap(() => {
          const nextConsultationId = this.consultationId?.trim() ?? '';
          if (!nextConsultationId || this.isHydrating) {
            return of(null);
          }

          return this.conduiteService
            .upsertConsultationConduite(nextConsultationId, this.buildUpsertRequest())
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

        const now = Date.now();
        if (now - this.lastAutosaveToastAt > 2200) {
          this.lastAutosaveToastAt = now;
          this.toastService.success(this.i18n.t('consultation.page.toast.saved'));
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ongoingTreatments']) {
      const normalized = this.normalizeOngoingTreatments(this.ongoingTreatments);
      this.lastSyncedOngoingTreatmentsSignature = this.buildOngoingTreatmentsSignature(normalized);
    }

    if (changes['consultationId']) {
      const nextConsultationId = this.consultationId?.trim() ?? '';
      this.diagnosticCatalog = [];
      this.diagnosticSelection = [];
      this.resetNextConsultationForm();

      if (!nextConsultationId) {
        this.resetState();
      } else {
        this.loadSection(nextConsultationId);
        this.refreshDiagnosticCatalog(nextConsultationId);
        this.loadNextConsultationSettings();
      }
    }

    if (changes['consultationDate'] && !changes['consultationId']) {
      this.updateNextConsultationDate();
    }

    if (changes['diagnostics']) {
      this.applyDiagnostics(this.diagnostics);
    }

    if (changes['motifs']) {
      this.refreshNextConsultationMotifCatalog();
    }

    if (changes['focusRequestId'] && this.focusActionKey) {
      this.focusAction(this.focusActionKey, true);
    }
  }

  protected onSelectedActionKeysChange(nextKeys: string[]): void {
    const previousSelectedActionKeys = [...this.selectedActionKeys];
    const normalized = this.normalizeSelectedActionKeys(nextKeys);
    this.selectedActionKeys = normalized;

    const nextPayloadByActionKey: Record<string, Record<string, unknown>> = {};
    for (const actionKey of normalized) {
      if (this.isParacliniqueGroupAction(actionKey)) {
        for (const childActionKey of ConsultationConduiteSectionComponent.PARACLINIQUE_ACTION_KEYS) {
          nextPayloadByActionKey[childActionKey] = this.payloadByActionKey[childActionKey]
            ? this.clonePayload(this.payloadByActionKey[childActionKey])
            : this.createDefaultPayload(childActionKey);
        }
        continue;
      }

      nextPayloadByActionKey[actionKey] = this.payloadByActionKey[actionKey]
        ? this.clonePayload(this.payloadByActionKey[actionKey])
        : this.createDefaultPayload(actionKey);
    }

    this.payloadByActionKey = nextPayloadByActionKey;

    const addedActionKeys = normalized.filter((actionKey) => !previousSelectedActionKeys.includes(actionKey));
    if (normalized.length === 0) {
      this.expandedActionKey = null;
    } else if (addedActionKeys.length > 0) {
      this.expandedActionKey = addedActionKeys[addedActionKeys.length - 1];
    } else if (this.expandedActionKey && !normalized.includes(this.expandedActionKey)) {
      this.expandedActionKey = null;
    }

    this.queueAutosave();
  }

  protected onActionPayloadChange(actionKey: string, payload: Record<string, unknown>): void {
    const normalizedActionKey = this.normalizeActionKey(actionKey);
    if (!normalizedActionKey || !this.isActionSelectedForPayload(normalizedActionKey)) {
      return;
    }

    const nextPayload = this.clonePayload(payload);
    const previousPayload = this.payloadByActionKey[normalizedActionKey];
    const mergedPayload = {
      ...this.clonePayload(previousPayload),
      ...nextPayload,
    };

    if (this.arePayloadsEqual(previousPayload, mergedPayload)) {
      return;
    }

    this.payloadByActionKey = {
      ...this.payloadByActionKey,
      [normalizedActionKey]: mergedPayload,
    };

    this.queueAutosave();
  }

  protected onOrdonnanceTreatmentsSync(
    incoming: UpdateOngoingTreatmentMedicineRequest[],
  ): void {
    const fromOrdonnance = this.normalizeOngoingTreatments(incoming).filter((item) => !!item.medicine);
    if (fromOrdonnance.length === 0) {
      return;
    }

    const current = this.normalizeOngoingTreatments(this.ongoingTreatments);
    const existingKeys = new Set(current.map((item) => this.buildOngoingTreatmentKey(item)));
    const merged = [...current];

    for (const item of fromOrdonnance) {
      const key = this.buildOngoingTreatmentKey(item);
      if (existingKeys.has(key)) {
        continue;
      }

      existingKeys.add(key);
      merged.push(item);
    }

    const mergedSignature = this.buildOngoingTreatmentsSignature(merged);
    if (mergedSignature === this.lastSyncedOngoingTreatmentsSignature) {
      return;
    }

    this.lastSyncedOngoingTreatmentsSignature = mergedSignature;
    this.ongoingTreatmentsChange.emit(merged);
  }

  protected onDiagnosticsOpen(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId) {
      return;
    }

    this.refreshDiagnosticCatalog(consultationId);
  }

  protected onDiagnosticSelectionChange(nextValues: string[]): void {
    const normalized = this.normalizeDiagnostics(nextValues);
    if (this.areStringListsEqual(this.diagnosticSelection, normalized)) {
      return;
    }

    this.diagnosticSelection = normalized;
    this.mergeDiagnosticCatalog(normalized);
    this.diagnosticsChange.emit([...normalized]);
  }

  protected removeDiagnostic(value: string): void {
    const normalizedValue = this.normalizeDiagnosticLabel(value);
    if (!normalizedValue) {
      return;
    }

    this.onDiagnosticSelectionChange(
      this.diagnosticSelection.filter((item) => item.toLowerCase() !== normalizedValue.toLowerCase()),
    );
  }

  protected onAdditionalInformationChange(value: string): void {
    const normalized = this.normalizeAdditionalInformation(value);
    if (this.additionalInformation === normalized) {
      return;
    }

    this.additionalInformation = normalized;
    this.queueAutosave();
  }

  protected chooseNextConsultationOffsetUnit(unit: NextConsultationOffsetUnit): void {
    if (this.nextConsultationForm.offsetUnit === unit) {
      return;
    }

    this.nextConsultationForm = {
      ...this.nextConsultationForm,
      offsetUnit: unit,
    };
    this.updateNextConsultationDate();
  }

  protected onNextConsultationOffsetChange(value: number | string): void {
    this.nextConsultationForm = {
      ...this.nextConsultationForm,
      offsetValue: this.normalizeNextConsultationOffset(value),
    };
    this.updateNextConsultationDate();
  }

  protected onNextConsultationDurationChange(value: number | string): void {
    this.nextConsultationForm = {
      ...this.nextConsultationForm,
      duration: this.normalizeNextConsultationDuration(value),
    };
    this.refreshNextConsultationSlots();
  }

  protected onNextConsultationMotifsChange(nextValues: string[]): void {
    const normalized = this.normalizeMotifList(nextValues);
    if (this.areStringListsEqual(this.nextConsultationForm.motifs, normalized)) {
      return;
    }

    for (const motif of normalized) {
      this.motifService.addCustomMotif(motif);
    }

    this.nextConsultationForm = {
      ...this.nextConsultationForm,
      motifs: normalized,
    };
    this.refreshNextConsultationMotifCatalog();
  }

  protected onNextConsultationTimeChange(value: string | null): void {
    this.nextConsultationForm = {
      ...this.nextConsultationForm,
      time: this.normalizeText(value),
    };
  }

  protected removeNextConsultationMotif(value: string): void {
    const normalizedValue = this.normalizeText(value).toLowerCase();
    if (!normalizedValue) {
      return;
    }

    this.onNextConsultationMotifsChange(
      this.nextConsultationForm.motifs.filter(
        (motif) => this.normalizeText(motif).toLowerCase() !== normalizedValue,
      ),
    );
  }

  protected scheduleNextConsultation(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId || this.isSchedulingNextConsultation) {
      return;
    }

    const date = this.nextConsultationForm.date.trim();
    const time = this.nextConsultationForm.time.trim();
    const motifs = this.normalizeMotifList(this.nextConsultationForm.motifs);
    const duration = this.normalizeNextConsultationDuration(this.nextConsultationForm.duration);

    if (!date) {
      this.toastService.error(this.i18n.t('consultation.conduite.nextConsultation.errors.dateRequired'));
      return;
    }

    if (date < this.toDateInputValue(new Date())) {
      this.toastService.error(this.i18n.t('consultation.conduite.nextConsultation.errors.pastDate'));
      return;
    }

    if (!time) {
      this.toastService.error(this.i18n.t('consultation.conduite.nextConsultation.errors.timeRequired'));
      return;
    }

    if (motifs.length === 0) {
      this.toastService.error(this.i18n.t('consultation.conduite.nextConsultation.errors.motifRequired'));
      return;
    }

    this.isSchedulingNextConsultation = true;
    this.agendaService
      .createConsultationRdv(consultationId, {
        date,
        time,
        duration,
        motifs,
      })
      .pipe(
        finalize(() => {
          this.isSchedulingNextConsultation = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastService.success(this.i18n.t('consultation.conduite.nextConsultation.created'));
          this.nextConsultationForm = {
            ...this.nextConsultationForm,
            time: '',
          };
          this.refreshNextConsultationSlots();
        },
        error: (error) => {
          this.toastService.error(
            this.extractApiErrorMessage(error)
              || this.i18n.t('consultation.conduite.nextConsultation.errors.createFailed'),
          );
        },
      });
  }

  protected goToConclusion(): void {
    this.navigateToConclusion.emit();
  }

  protected hasAction(actionKey: string): boolean {
    const normalized = this.normalizeActionKey(actionKey);
    return this.selectedActionKeys.includes(normalized);
  }

  protected isActionExpanded(actionKey: string): boolean {
    const normalized = this.normalizeActionKey(actionKey);
    return this.expandedActionKey === normalized;
  }

  protected toggleAction(actionKey: string): void {
    const normalized = this.normalizeActionKey(actionKey);
    if (!normalized || !this.selectedActionKeys.includes(normalized)) {
      return;
    }

    this.expandedActionKey = this.expandedActionKey === normalized ? null : normalized;
  }

  protected printDocumentChip(actionKey: string): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId) {
      return;
    }

    const key = this.normalizeActionKey(actionKey);
    let documentType = '';

    if (key.includes('ordonnance')) {
      documentType = 'ordonnance';
    } else if (key.includes('certificat')) {
      documentType = 'certificat';
    } else if (key.includes('lettre')) {
      documentType = 'lettre_confrere';
    } else if (key.includes('cnam')) {
      documentType = 'cnam';
    } else if (key.includes('paraclinique') || key.includes('chirurgie') || key.includes('imagerie') || key.includes('bilan sanguin')) {
      documentType = 'paraclinique';
    }

    if (!documentType) {
      return;
    }

    const queryParams: Record<string, string> = {
      lang: this.i18n.lang(),
    };

    if (documentType === 'paraclinique') {
      if (key.includes('chirurgie')) queryParams['sections'] = 'chirurgie';
      else if (key.includes('imagerie')) queryParams['sections'] = 'imagerie';
      else if (key.includes('bilan sanguin')) queryParams['sections'] = 'bilan_sanguin';
    }

    const target = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', consultationId, 'print', documentType], {
        queryParams,
      }),
    );

    window.open(target, '_blank', 'noopener,noreferrer');
  }

  protected removeAction(actionKey: string): void {
    const normalized = this.normalizeActionKey(actionKey);
    if (!normalized || !this.selectedActionKeys.includes(normalized)) {
      return;
    }

    this.selectedActionKeys = this.selectedActionKeys.filter((item) => item !== normalized);

    const nextPayloadByActionKey = { ...this.payloadByActionKey };
    if (this.isParacliniqueGroupAction(normalized)) {
      for (const childActionKey of ConsultationConduiteSectionComponent.PARACLINIQUE_ACTION_KEYS) {
        delete nextPayloadByActionKey[childActionKey];
      }
    } else {
      delete nextPayloadByActionKey[normalized];
    }
    this.payloadByActionKey = nextPayloadByActionKey;

    if (this.expandedActionKey === normalized) {
      this.expandedActionKey = null;
    } else if (this.expandedActionKey && !this.selectedActionKeys.includes(this.expandedActionKey)) {
      this.expandedActionKey = null;
    }

    this.queueAutosave();
  }

  protected getActionLabel(actionKey: string, fallbackLabel = ''): string {
    const normalized = this.normalizeActionKey(actionKey);
    const translationKey = this.getActionTranslationKey(normalized);
    if (translationKey) {
      const translated = this.i18n.t(translationKey);
      if (translated !== translationKey) {
        return translated;
      }
    }

    const normalizedFallback = fallbackLabel.trim();
    if (normalizedFallback) {
      return normalizedFallback;
    }

    const item = this.actionCatalog.find(
      (catalogItem) => this.normalizeActionKey(catalogItem.actionKey) === normalized,
    );

    return item?.label ?? actionKey;
  }

  protected payloadFor(actionKey: string): Record<string, unknown> {
    const normalized = this.normalizeActionKey(actionKey);
    const payload = this.payloadByActionKey[normalized];
    return payload ?? {};
  }

  protected trackCatalogItem(_: number, item: ConduiteCatalogItemResponse): string {
    return item.actionKey;
  }

  protected isPrintingDocument(documentType: ConduiteDocumentType): boolean {
    return this.printingDocumentType === documentType;
  }

  protected onParacliniquePrintRequested(request: ParacliniquePrintRequest): void {
    const sections = this.normalizeParacliniquePrintSections(request.sections);
    if (sections.length === 0) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.printFailed'));
      return;
    }

    this.onPrintDocument('paraclinique', {
      sections: sections.join(','),
    });
  }

  protected onPrintDocument(
    documentType: ConduiteDocumentType,
    extraQueryParams?: Record<string, string>,
  ): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.consultationNotFound'));
      return;
    }

    if (this.isPrintingDocument(documentType)) {
      return;
    }

    this.printingDocumentType = documentType;
    this.conduiteService
      .upsertConsultationConduite(consultationId, this.buildUpsertRequest())
      .pipe(
        finalize(() => {
          this.printingDocumentType = null;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const target = this.router.serializeUrl(
            this.router.createUrlTree(['/consultations', consultationId, 'print', documentType], {
              queryParams: {
                lang: this.i18n.lang(),
                ...(extraQueryParams ?? {}),
              },
            }),
          );

          const popup = window.open(target, '_blank', 'noopener,noreferrer');
          if (!popup) {
            this.toastService.error(this.i18n.t('consultation.documents.toast.popupBlocked'));
          }
        },
        error: () => {
          this.toastService.error(this.i18n.t('consultation.page.toast.saveError'));
        },
      });
  }

  private normalizeParacliniquePrintSections(
    sections: ReadonlyArray<ParacliniquePrintSection | string> | null | undefined,
  ): ParacliniquePrintSection[] {
    if (!Array.isArray(sections) || sections.length === 0) {
      return [];
    }

    const normalized = sections
      .map((section) => this.normalizeActionKey(String(section)) as ParacliniquePrintSection)
      .filter((section): section is ParacliniquePrintSection => (
        section === 'chirurgie' || section === 'imagerie' || section === 'bilan_sanguin'
      ));

    return normalized.filter((section, index) => normalized.indexOf(section) === index);
  }

  private loadSection(consultationId: string, focusActionKey?: string | null): void {
    this.isLoading = true;
    this.loadError = '';

    forkJoin({
      catalog: this.conduiteService.getConduiteCatalog(),
      conduite: this.conduiteService.getConsultationConduite(consultationId),
      consignes: this.conduiteService.getConsigneCatalog().pipe(catchError(() => of([] as string[]))),
      doctorProfile: this.doctorService.getById('me').pipe(catchError(() => of(null as DoctorProfile | null))),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ catalog, conduite, consignes, doctorProfile }) => {
          this.actionCatalog = this.buildUiCatalog(catalog);
          this.consigneCatalog = [...(consignes ?? [])];
          this.clinicOptions = this.extractClinicOptions(doctorProfile);
          this.applyConduiteResponse(conduite);
          this.applyPendingFocus(focusActionKey);
        },
        error: () => {
          this.loadError = 'consultation.conduite.loadError';
          this.actionCatalog = [];
          this.consigneCatalog = [];
          this.clinicOptions = [];
          this.selectedActionKeys = [];
          this.payloadByActionKey = {};
          this.expandedActionKey = null;
        },
      });
  }

  private extractClinicOptions(profile: DoctorProfile | null): string[] {
    if (!profile?.clinics?.length) {
      return [];
    }

    const uniqueNames = new Set<string>();
    for (const clinic of profile.clinics) {
      const name = clinic.name.trim();
      if (!name) {
        continue;
      }

      uniqueNames.add(name);
    }

    return [...uniqueNames];
  }

  private applyConduiteResponse(response: ConsultationConduiteResponse): void {
    const allowedActionKeys = new Set(this.actionCatalog.map((item) => this.normalizeActionKey(item.actionKey)));
    const sortedActions = [...(response.actions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

    const selectedActionKeys: string[] = [];
    const payloadByActionKey: Record<string, Record<string, unknown>> = {};
    let hasParacliniquePayload = false;

    for (const action of sortedActions) {
      const normalizedActionKey = this.normalizeActionKey(action.actionKey);
      if (!normalizedActionKey) {
        continue;
      }

      if (this.isParacliniqueChildAction(normalizedActionKey)) {
        hasParacliniquePayload = true;
        payloadByActionKey[normalizedActionKey] = this.clonePayload(action.payload);
        continue;
      }

      if (selectedActionKeys.includes(normalizedActionKey)) {
        continue;
      }

      if (allowedActionKeys.size > 0 && !allowedActionKeys.has(normalizedActionKey)) {
        continue;
      }

      selectedActionKeys.push(normalizedActionKey);
      payloadByActionKey[normalizedActionKey] = this.clonePayload(action.payload);
    }

    if (hasParacliniquePayload && allowedActionKeys.has(ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY)) {
      selectedActionKeys.push(ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY);

      for (const actionKey of ConsultationConduiteSectionComponent.PARACLINIQUE_ACTION_KEYS) {
        if (!payloadByActionKey[actionKey]) {
          payloadByActionKey[actionKey] = this.createDefaultPayload(actionKey);
        }
      }
    }

    for (const actionKey of selectedActionKeys) {
      if (this.isParacliniqueGroupAction(actionKey)) {
        continue;
      }

      if (!payloadByActionKey[actionKey]) {
        payloadByActionKey[actionKey] = this.createDefaultPayload(actionKey);
      }
    }

    this.isHydrating = true;
    this.additionalInformation = this.normalizeAdditionalInformation(response.additionalInformation);
    this.selectedActionKeys = selectedActionKeys;
    this.payloadByActionKey = payloadByActionKey;
    this.expandedActionKey = null;
    this.isHydrating = false;
    this.emitConduiteChange();
  }

  private focusAction(actionKey: string, reload: boolean): void {
    const normalized = this.normalizeActionKey(actionKey);
    if (!normalized) {
      return;
    }

    this.pendingFocusActionKey = normalized;
    const consultationId = this.consultationId?.trim() ?? '';
    if (reload && consultationId) {
      this.loadSection(consultationId, normalized);
      return;
    }

    this.applyPendingFocus(normalized);
  }

  private applyPendingFocus(actionKey?: string | null): void {
    const normalized = this.normalizeActionKey(actionKey ?? this.pendingFocusActionKey ?? '');
    if (!normalized) {
      return;
    }

    const uiActionKey = this.isParacliniqueChildAction(normalized)
      ? ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY
      : normalized;

    if (!this.selectedActionKeys.includes(uiActionKey)) {
      this.selectedActionKeys = [...this.selectedActionKeys, uiActionKey];
    }

    if (!this.payloadByActionKey[normalized] && !this.isParacliniqueGroupAction(normalized)) {
      this.payloadByActionKey = {
        ...this.payloadByActionKey,
        [normalized]: this.createDefaultPayload(normalized),
      };
    }

    this.expandedActionKey = uiActionKey;
    this.pendingFocusActionKey = null;
  }

  private applyDiagnostics(values: string[] | null | undefined): void {
    const normalized = this.normalizeDiagnostics(values ?? []);
    this.diagnosticSelection = normalized;
    this.mergeDiagnosticCatalog(normalized);
  }

  private refreshDiagnosticCatalog(consultationId: string): void {
    this.isLoadingDiagnosticCatalog = true;

    this.interrogatoireService
      .getDiagnosticsCatalog(consultationId)
      .pipe(
        catchError(() => of([] as string[])),
        finalize(() => {
          this.isLoadingDiagnosticCatalog = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.mergeDiagnosticCatalog(items);
      });
  }

  private loadNextConsultationSettings(): void {
    this.agendaService
      .getSettings()
      .pipe(
        catchError(() => of(null as CalendarSettings | null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((settings) => {
        if (settings) {
          this.nextConsultationSettings = settings;
        }

        this.refreshNextConsultationSlots();
      });
  }

  private updateNextConsultationDate(options?: { loadSlots?: boolean }): void {
    if (!this.consultationId?.trim()) {
      this.nextConsultationForm = {
        ...this.nextConsultationForm,
        date: '',
        time: '',
      };
      this.nextConsultationTimeSlots = [];
      return;
    }

    const offsetValue = this.normalizeNextConsultationOffset(this.nextConsultationForm.offsetValue);
    if (offsetValue <= 0) {
      this.nextConsultationForm = {
        ...this.nextConsultationForm,
        offsetValue,
        date: '',
        time: '',
      };
      this.nextConsultationTimeSlots = [];
      return;
    }

    const baseDate = this.parseConsultationBaseDate();
    const nextDate = this.addDateOffset(
      baseDate,
      offsetValue,
      this.nextConsultationForm.offsetUnit,
    );

    this.nextConsultationForm = {
      ...this.nextConsultationForm,
      offsetValue,
      date: this.toDateInputValue(nextDate),
      time: '',
    };

    if (options?.loadSlots === false) {
      this.generateNextConsultationTimeSlots([], []);
      return;
    }

    this.refreshNextConsultationSlots();
  }

  private refreshNextConsultationSlots(): void {
    const date = this.nextConsultationForm.date.trim();
    if (!date) {
      this.nextConsultationSlotsRequestId++;
      this.nextConsultationTimeSlots = [];
      this.isLoadingNextConsultationSlots = false;
      return;
    }

    const requestId = ++this.nextConsultationSlotsRequestId;
    this.isLoadingNextConsultationSlots = true;

    forkJoin({
      rdvs: this.agendaService.getRdvsByMonth(date.slice(0, 7)).pipe(catchError(() => of([] as Rdv[]))),
      leaves: this.agendaService.getLeavesByYear(date.slice(0, 4)).pipe(catchError(() => of([] as Leave[]))),
    })
      .pipe(
        finalize(() => {
          if (requestId === this.nextConsultationSlotsRequestId) {
            this.isLoadingNextConsultationSlots = false;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ rdvs, leaves }) => {
        if (requestId !== this.nextConsultationSlotsRequestId) {
          return;
        }

        this.generateNextConsultationTimeSlots(rdvs, leaves);
      });
  }

  private generateNextConsultationTimeSlots(rdvs: Rdv[], leaves: Leave[]): void {
    const date = this.nextConsultationForm.date.trim();
    if (!date) {
      this.nextConsultationTimeSlots = [];
      return;
    }

    const duration = this.normalizeNextConsultationDuration(this.nextConsultationForm.duration);
    const interval = this.normalizeNextConsultationInterval(this.nextConsultationSettings.timeSlotInterval);
    const startMinutes = Math.max(0, this.nextConsultationSettings.startHour * 60);
    const endMinutes = Math.max(startMinutes, this.nextConsultationSettings.endHour * 60);
    const slots: string[] = [];

    for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += interval) {
      const slotEnd = minutes + duration;
      if (
        this.isNextConsultationRangeBlockedByRdv(date, minutes, slotEnd, rdvs)
        || this.isNextConsultationRangeBlockedByLeave(date, minutes, slotEnd, leaves)
      ) {
        continue;
      }

      slots.push(this.minutesToTime(minutes));
    }

    this.nextConsultationTimeSlots = slots;
    if (this.nextConsultationForm.time && !slots.includes(this.nextConsultationForm.time)) {
      this.nextConsultationForm = {
        ...this.nextConsultationForm,
        time: '',
      };
    }
  }

  private refreshNextConsultationMotifCatalog(): void {
    this.nextConsultationMotifCatalog = this.normalizeMotifList([
      ...this.motifService.getAllMotifs(),
      ...(this.motifs ?? []),
      ...this.nextConsultationForm.motifs,
    ]);
  }

  private mergeDiagnosticCatalog(values: string[] | null | undefined): void {
    this.diagnosticCatalog = this.normalizeDiagnostics([
      ...this.diagnosticCatalog,
      ...(values ?? []),
      ...this.diagnosticSelection,
    ]);
  }

  private queueAutosave(): void {
    if (!this.consultationId || this.isHydrating) {
      return;
    }

    this.autosaveTrigger.next(JSON.stringify(this.buildUpsertRequest()));
    this.emitConduiteChange();
  }

  private buildUpsertRequest(): UpsertConsultationConduiteRequest {
    const expandedActionKeys: string[] = [];

    for (const actionKey of this.selectedActionKeys) {
      if (this.isParacliniqueGroupAction(actionKey)) {
        expandedActionKeys.push(...ConsultationConduiteSectionComponent.PARACLINIQUE_ACTION_KEYS);
        continue;
      }

      expandedActionKeys.push(actionKey);
    }

    return {
      additionalInformation: this.additionalInformation,
      actions: expandedActionKeys.map((actionKey, sortOrder) => ({
        actionKey,
        sortOrder,
        payload: this.clonePayload(this.payloadByActionKey[actionKey]),
      })),
    };
  }

  private emitConduiteChange(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId || this.isHydrating) {
      return;
    }

    const request = this.buildUpsertRequest();
    this.conduiteChange.emit({
      consultationId,
      additionalInformation: request.additionalInformation,
      actions: request.actions.map((action, index) => ({
        id: `${consultationId}-${action.actionKey}-${index}`,
        actionKey: action.actionKey,
        sortOrder: action.sortOrder,
        payload: this.clonePayload(action.payload),
      })),
    });
  }

  private createDefaultNextConsultationForm(): NextConsultationFormState {
    return {
      offsetValue: 15,
      offsetUnit: 'days',
      date: '',
      time: '',
      motifs: [],
      duration: 15,
    };
  }

  private normalizeNextConsultationOffset(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }

    return Math.min(999, Math.floor(numeric));
  }

  private normalizeNextConsultationDuration(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 15;
    }

    return Math.min(480, Math.max(15, Math.round(numeric)));
  }

  private normalizeNextConsultationInterval(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 15;
    }

    return Math.min(120, Math.max(5, Math.round(numeric)));
  }

  private parseConsultationBaseDate(): Date {
    const rawValue = this.consultationDate?.trim();
    if (!rawValue) {
      return new Date();
    }

    const datePart = rawValue.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private addDateOffset(
    baseDate: Date,
    amount: number,
    unit: NextConsultationOffsetUnit,
  ): Date {
    if (unit === 'days') {
      const next = new Date(baseDate);
      next.setDate(next.getDate() + amount);
      return next;
    }

    return this.addMonthsClamped(baseDate, unit === 'years' ? amount * 12 : amount);
  }

  private addMonthsClamped(baseDate: Date, amount: number): Date {
    const day = baseDate.getDate();
    const next = new Date(baseDate);
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, maxDay));
    return next;
  }

  private isNextConsultationRangeBlockedByRdv(
    date: string,
    startMinutes: number,
    endMinutes: number,
    rdvs: Rdv[],
  ): boolean {
    return rdvs.some((rdv) => {
      if (rdv.date !== date || !rdv.time) {
        return false;
      }

      const rdvStart = this.timeToMinutes(rdv.time);
      const rdvEnd = rdvStart + this.normalizeNextConsultationDuration(rdv.duration ?? rdv.personnelDuration);
      return startMinutes < rdvEnd && endMinutes > rdvStart;
    });
  }

  private isNextConsultationRangeBlockedByLeave(
    date: string,
    startMinutes: number,
    endMinutes: number,
    leaves: Leave[],
  ): boolean {
    return leaves.some((leave) => {
      if (leave.date !== date) {
        return false;
      }

      if (leave.isFullDay) {
        return true;
      }

      if (!leave.startTime || !leave.endTime) {
        return false;
      }

      const leaveStart = this.timeToMinutes(leave.startTime);
      const leaveEnd = this.timeToMinutes(leave.endTime);
      return startMinutes < leaveEnd && endMinutes > leaveStart;
    });
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return 0;
    }

    return (hours * 60) + minutes;
  }

  private minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private normalizeMotifList(values: string[] | null | undefined): string[] {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = this.normalizeText(value);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(normalized);
    }

    return result;
  }

  private normalizeSelectedActionKeys(nextKeys: string[] | null | undefined): string[] {
    if (!Array.isArray(nextKeys) || nextKeys.length === 0) {
      return [];
    }

    const allowed = new Set(this.actionCatalog.map((item) => this.normalizeActionKey(item.actionKey)));
    const normalized: string[] = [];

    for (const key of nextKeys) {
      const normalizedKey = this.normalizeActionKey(key);
      if (!normalizedKey) {
        continue;
      }

      const normalizedUiKey = this.isParacliniqueChildAction(normalizedKey)
        ? ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY
        : normalizedKey;

      if (normalized.includes(normalizedUiKey)) {
        continue;
      }

      if (allowed.size > 0 && !allowed.has(normalizedUiKey)) {
        continue;
      }

      normalized.push(normalizedUiKey);
    }

    return normalized;
  }

  private normalizeActionKey(value: string): string {
    if (!value) {
      return '';
    }

    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  private getActionTranslationKey(actionKey: string): string | null {
    switch (actionKey) {
      case 'ordonnance':
        return 'consultation.documents.types.ordonnance';
      case 'certificat':
        return 'consultation.conduite.certificat.title';
      case 'lettre_confrere':
        return 'consultation.documents.types.lettreConfrere';
      case 'cnam':
        return 'consultation.documents.types.cnam';
      case 'paraclinique':
        return 'consultation.documents.types.paraclinique';
      case 'paraclinique_chirurgie':
        return 'consultation.conduite.actions.paracliniqueChirurgie';
      case 'paraclinique_imagerie':
        return 'consultation.conduite.actions.paracliniqueImagerie';
      case 'paraclinique_bilan_sanguin':
        return 'consultation.conduite.actions.paracliniqueBilanSanguin';
      default:
        return null;
    }
  }

  private createDefaultPayload(actionKey: string): Record<string, unknown> {
    switch (actionKey) {
      case 'ordonnance':
        return {
          ordonnanceTypeKey: 'standard',
          listDrugs: [
            {
              nom: '',
              posology: '',
              duree: '',
            },
          ],
          consigne: '',
          informationAdditionnel: '',
        };
      case 'certificat':
        return {
          types: ConsultationConduiteSectionComponent.DEFAULT_CERTIFICATE_TYPE,
          nombre: '',
          compterDe: '',
          dateCertificat: '',
          civiliteAccompagnant: '',
          nomPrenomAccompagnant: '',
          description: '',
        };
      case 'lettre_confrere':
        return {
          medecin: '',
          formalityKey: '',
          formulepolitesse: '',
          contenue: '',
        };
      case 'cnam':
        return {
          selectedFormType: 'ap1',
          ap1: {
            codeConventionnel: '',
            medicationLines: [],
            clinique: '',
            diagnostic: '',
            donneesCliniquesParacliniques: '',
          },
          ap2: {
            clinique: '',
            diagnostic: '',
            therapeutique: '',
            natureExamen: '',
            dateExamen: '',
          },
          ap3: {
            donneesCliniquesParacliniques: '',
            diagnostics: '',
          },
          ap4: {
            pathologieOrigine: '',
            traitement: '',
            etatSante: '',
            bilanFonctionnel: '',
            prolongation: '',
          },
          apci: {
            diagnostic: '',
            observation: '',
          },
        };
      case 'paraclinique':
        return {};
      case 'paraclinique_chirurgie':
        return {
          type: '',
          types: [],
          dateOperation: '',
          clinique: '',
          forfait: '',
          operateur: '',
          informationAdditionnel: '',
        };
      case 'paraclinique_imagerie':
        return {
          type: '',
          types: [],
          dateOperation: '',
          informationAdditionnel: '',
        };
      case 'paraclinique_bilan_sanguin':
        return {
          dateOperation: '',
          selectedBilanTypes: [],
          informationAdditionnel: '',
        };
      default:
        return {};
    }
  }

  private isParacliniqueGroupAction(actionKey: string): boolean {
    return this.normalizeActionKey(actionKey)
      === ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY;
  }

  private isParacliniqueChildAction(actionKey: string): boolean {
    const normalized = this.normalizeActionKey(actionKey);
    return ConsultationConduiteSectionComponent.PARACLINIQUE_ACTION_KEYS.includes(
      normalized as (typeof ConsultationConduiteSectionComponent.PARACLINIQUE_ACTION_KEYS)[number],
    );
  }

  private isActionSelectedForPayload(actionKey: string): boolean {
    if (this.selectedActionKeys.includes(actionKey)) {
      return true;
    }

    return this.isParacliniqueChildAction(actionKey)
      && this.selectedActionKeys.includes(ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY);
  }

  private buildUiCatalog(catalog: ConduiteCatalogItemResponse[]): ConduiteCatalogItemResponse[] {
    const items = [...catalog];
    const hasParacliniqueChild = items.some((item) => this.isParacliniqueChildAction(item.actionKey));

    const uiCatalog = items
      .filter((item) => !this.isParacliniqueChildAction(item.actionKey))
      .map((item) => ({ ...item }));

    if (!hasParacliniqueChild) {
      return uiCatalog;
    }

    const translatedLabel = this.i18n.t('consultation.documents.types.paraclinique');
    const fallbackLabel = translatedLabel === 'consultation.documents.types.paraclinique'
      ? 'Paraclinique'
      : translatedLabel;

    uiCatalog.push({
      actionKey: ConsultationConduiteSectionComponent.PARACLINIQUE_GROUP_ACTION_KEY,
      label: fallbackLabel,
      category: 'paraclinique',
      isParaclinique: true,
    });

    return uiCatalog;
  }

  private clonePayload(payload: Record<string, unknown> | null | undefined): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  }

  private arePayloadsEqual(
    left: Record<string, unknown> | null | undefined,
    right: Record<string, unknown> | null | undefined,
  ): boolean {
    return JSON.stringify(this.clonePayload(left)) === JSON.stringify(this.clonePayload(right));
  }

  private normalizeOngoingTreatments(
    treatments: UpdateOngoingTreatmentMedicineRequest[] | null | undefined,
  ): UpdateOngoingTreatmentMedicineRequest[] {
    const fallbackDate = this.toDateInputValue(new Date());

    return [...(treatments ?? [])].map((item) => ({
      medicine: this.normalizeText(item?.medicine),
      therapeuticClass: this.normalizeText(item?.therapeuticClass),
      category: this.normalizeText(item?.category),
      posology: this.normalizeText(item?.posology),
      duration: this.normalizeText(item?.duration),
      date: this.normalizeText(item?.date) || fallbackDate,
    }));
  }

  private buildOngoingTreatmentKey(item: UpdateOngoingTreatmentMedicineRequest): string {
    return [
      this.normalizeText(item.medicine).toLowerCase(),
      this.normalizeText(item.therapeuticClass).toLowerCase(),
      this.normalizeText(item.category).toLowerCase(),
      this.normalizeText(item.posology).toLowerCase(),
      this.normalizeText(item.duration).toLowerCase(),
    ].join('|');
  }

  private buildOngoingTreatmentsSignature(items: UpdateOngoingTreatmentMedicineRequest[]): string {
    return JSON.stringify(
      items.map((item) => ({
        medicine: this.normalizeText(item.medicine),
        therapeuticClass: this.normalizeText(item.therapeuticClass),
        category: this.normalizeText(item.category),
        posology: this.normalizeText(item.posology),
        duration: this.normalizeText(item.duration),
        date: this.normalizeText(item.date),
      })),
    );
  }

  private normalizeText(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeDiagnostics(values: string[] | null | undefined): string[] {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const normalized = this.normalizeDiagnosticLabel(value);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(normalized);
    }

    return result;
  }

  private normalizeDiagnosticLabel(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    let normalized = value.trim().replace(/\s+/g, ' ');
    normalized = normalized.replace(/^add item\s*/i, '').trim();

    if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith('\'') && normalized.endsWith('\''))) {
      normalized = normalized.slice(1, -1).trim();
    } else if (normalized.startsWith('"') || normalized.startsWith('\'')) {
      normalized = normalized.slice(1).trim();
    }

    return normalized;
  }

  private areStringListsEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => value === right[index]);
  }

  private toDateInputValue(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private normalizeAdditionalInformation(value: unknown): string {
    return String(value ?? '');
  }

  private extractApiErrorMessage(error: unknown): string {
    const unknownError = error as {
      error?: { message?: string; Message?: string } | string;
      message?: string;
    };

    if (typeof unknownError?.error === 'string' && unknownError.error.trim() !== '') {
      return unknownError.error;
    }

    const nestedMessage =
      unknownError?.error && typeof unknownError.error === 'object'
        ? unknownError.error.message ?? unknownError.error.Message
        : null;

    if (typeof nestedMessage === 'string' && nestedMessage.trim() !== '') {
      return nestedMessage;
    }

    if (typeof unknownError?.message === 'string' && unknownError.message.trim() !== '') {
      return unknownError.message;
    }

    return '';
  }

  private resetNextConsultationForm(): void {
    this.nextConsultationSlotsRequestId++;
    this.nextConsultationForm = this.createDefaultNextConsultationForm();
    this.nextConsultationTimeSlots = [];
    this.isLoadingNextConsultationSlots = false;
    this.refreshNextConsultationMotifCatalog();
    this.updateNextConsultationDate({ loadSlots: false });
  }

  private resetState(): void {
    this.isLoading = false;
    this.isLoadingDiagnosticCatalog = false;
    this.isLoadingNextConsultationSlots = false;
    this.isSchedulingNextConsultation = false;
    this.loadError = '';
    this.actionCatalog = [];
    this.consigneCatalog = [];
    this.diagnosticCatalog = [];
    this.diagnosticSelection = [];
    this.nextConsultationSlotsRequestId++;
    this.nextConsultationForm = this.createDefaultNextConsultationForm();
    this.nextConsultationMotifCatalog = [];
    this.nextConsultationTimeSlots = [];
    this.selectedActionKeys = [];
    this.payloadByActionKey = {};
    this.expandedActionKey = null;
  }
}
