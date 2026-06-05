import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgLabelTemplateDirective, NgNotFoundTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { finalize, forkJoin } from 'rxjs';
import { findKnownDefaultTreatmentValueTranslationKey } from '../../../../../../../core/i18n/default-treatment-values';
import {
  ConduiteOrdonnanceTypeCatalogItemResponse,
  ConduiteOrdonnanceTypeDrugResponse,
} from '../../../../../../../core/models/conduite.models';
import {
  UpdateOngoingTreatmentMedicineRequest,
  TreatmentCatalogItem,
  TreatmentCatalogRelation,
} from '../../../../../../../core/models/interrogatoire.models';
import { ConduiteService } from '../../../../../../../core/services/conduite.service';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../../../../core/services/interrogatoire.service';
import { ToastService } from '../../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type OptionItem = {
  label: string;
  value: string;
};

type OrdonnanceTypeOption = {
  label: string;
  value: string;
};

type OrdonnanceDrugRow = {
  rowId: string;
  typeClass: string;
  category: string;
  nom: string;
  posology: string;
  duree: string;
  categoryItems: OptionItem[];
  medicineItems: OptionItem[];
};

@Component({
  selector: 'app-consultation-conduite-ordonnance-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgNotFoundTemplateDirective,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    TranslatePipe,
  ],
  templateUrl: './consultation-conduite-ordonnance-form.component.html',
  styleUrl: './consultation-conduite-ordonnance-form.component.css',
})
export class ConsultationConduiteOrdonnanceFormComponent implements OnInit, OnChanges {
  @Input() consultationId: string | null = null;
  @Input() payload: Record<string, unknown> | null = null;
  @Input() consigneCatalog: string[] = [];
  @Input() ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Input() isPrinting = false;
  @Output() payloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() treatmentsSync = new EventEmitter<UpdateOngoingTreatmentMedicineRequest[]>();
  @Output() printRequested = new EventEmitter<void>();

  private readonly conduiteService = inject(ConduiteService);
  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxRows = 10;
  protected classOptions: OptionItem[] = [];
  protected categoryOptions: OptionItem[] = [];
  protected medicineOptions: OptionItem[] = [];
  protected rows: OrdonnanceDrugRow[] = [this.createEmptyDrugRow()];
  protected ordonnanceTypeOptions: OrdonnanceTypeOption[] = [{ value: 'standard', label: 'Standard' }];
  protected selectedOrdonnanceTypeKey = 'standard';
  protected isTemplateReadonlyMode = false;
  protected isLoadingLatestOrdonnance = false;
  protected saveTypeName = '';
  protected showSaveTypeModal = false;
  protected isSavingOrdonnanceType = false;

  protected posologyOptions: OptionItem[] = [
    { value: '1 gtt * 3 jours', label: '1 gtt * 3 jours' },
    { value: '1 gtt * 5 jours', label: '1 gtt * 5 jours' },
    { value: '1 gtt * 7 jours', label: '1 gtt * 7 jours' },
    { value: '2 gtt * 5 jours', label: '2 gtt * 5 jours' },
    { value: '2 gtt * 7 jours', label: '2 gtt * 7 jours' },
    { value: '1 cp * 1/j', label: '1 cp * 1/j' },
    { value: '1 cp * 2/j', label: '1 cp * 2/j' },
    { value: '1 cp * 3/j', label: '1 cp * 3/j' },
    { value: '5 ml * 3/j', label: '5 ml * 3/j' },
    { value: 'Au besoin (PRN)', label: 'Au besoin (PRN)' },
  ];

  private readonly posologyGtKeywords = ['gtt', 'goutte'];
  private readonly posologyCpKeywords = ['cp'];
  private readonly posologyOptionsCache = new Map<string, OptionItem[]>();

  protected dureeOptions: OptionItem[] = [
    { value: '05 jours', label: '05 jours' },
    { value: '07 jours', label: '07 jours' },
    { value: '10 jours', label: '10 jours' },
    { value: '02 semaines', label: '02 semaines' },
    { value: '03 semaines', label: '03 semaines' },
    { value: '01 mois', label: '01 mois' },
  ];

  protected consigneOptions: string[] = [];
  protected consigne = '';
  protected informationAdditionnel = '';

  private readonly categoriesByClass = new Map<string, Set<string>>();
  private readonly therapeuticClassesByCategory = new Map<string, Set<string>>();
  private readonly medicinesByCategory = new Map<string, Set<string>>();
  private readonly medicinesByClassAndCategory = new Map<string, Set<string>>();
  private readonly classAndCategoryByMedicine = new Map<string, Set<string>>();
  private readonly ordonnanceTypesByKey = new Map<string, ConduiteOrdonnanceTypeCatalogItemResponse>();
  private hasLoadedOrdonnanceTypes = false;
  private lastEmittedPayloadSignature = '';

  ngOnInit(): void {
    this.loadOrdonnanceTypeCatalog();
    this.loadCatalogSnapshot();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['consigneCatalog']) {
      this.consigneOptions = this.mergeConsigneOptions(this.consigneCatalog ?? []);
    }

    if (!changes['payload']) {
      return;
    }

    const data = this.payload ?? {};
    const incomingSignature = this.buildPayloadSignature(data);
    if (incomingSignature === this.lastEmittedPayloadSignature) {
      return;
    }

    this.rows = this.readDrugRows(data);
    if (this.rows.length === 0) {
      this.rows = [this.createEmptyDrugRow()];
    }
    this.mergeDrugRowValuesIntoOptions(this.rows);
    this.refreshRowOptions();

    this.consigne = this.readString(data['consigne']);
    this.informationAdditionnel = this.readString(data['informationAdditionnel']);
    const selectedOrdonnanceTypeKey = this.normalizeOrdonnanceTypeKey(
      this.readString(data['ordonnanceTypeKey']),
    );

    this.selectedOrdonnanceTypeKey = selectedOrdonnanceTypeKey || 'standard';
    this.isTemplateReadonlyMode = this.selectedOrdonnanceTypeKey !== 'standard';
    if (this.isTemplateReadonlyMode) {
      this.applySelectedTemplateIfAvailable(false);
    }

    if (this.consigne && !this.consigneOptions.some((item) => this.normalizeKey(item) === this.normalizeKey(this.consigne))) {
      this.consigneOptions = [...this.consigneOptions, this.consigne];
    }

    this.lastEmittedPayloadSignature = incomingSignature;
  }

  protected loadOngoingTreatments(): void {
    const rows = this.mapOngoingTreatmentsToDrugRows(this.ongoingTreatments);
    if (rows.length === 0) {
      this.toastService.info(this.i18n.t('consultation.conduite.ordonnance.load.noCurrentTreatments'));
      return;
    }

    this.selectedOrdonnanceTypeKey = 'standard';
    this.isTemplateReadonlyMode = false;
    this.rows = rows.length > 0 ? rows : [this.createEmptyDrugRow()];
    this.mergeDrugRowValuesIntoOptions(this.rows);
    this.refreshRowOptions();
    this.emitPayload();
    this.toastService.success(this.i18n.t('consultation.conduite.ordonnance.load.currentTreatmentsLoaded'));
  }

  protected loadLatestOrdonnance(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId || this.isLoadingLatestOrdonnance) {
      return;
    }

    this.isLoadingLatestOrdonnance = true;
    this.conduiteService
      .getLatestPreviousOrdonnance(consultationId)
      .pipe(
        finalize(() => {
          this.isLoadingLatestOrdonnance = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (action) => {
          const payload = action?.payload;
          if (!payload || !this.applyLatestOrdonnancePayload(payload)) {
            this.toastService.info(this.i18n.t('consultation.conduite.ordonnance.load.noLatestOrdonnance'));
            return;
          }

          this.toastService.success(this.i18n.t('consultation.conduite.ordonnance.load.latestOrdonnanceLoaded'));
        },
        error: () => {
          this.toastService.error(this.i18n.t('consultation.conduite.ordonnance.load.latestOrdonnanceFailed'));
        },
      });
  }

  protected canSaveOrdonnanceType(): boolean {
    return !this.isSavingOrdonnanceType
      && this.normalizeLabel(this.saveTypeName).length > 0
      && this.buildOrdonnanceTypeDrugs().length > 0;
  }

  protected openSaveOrdonnanceTypeModal(): void {
    if (this.isTemplateReadonlyMode || this.isSavingOrdonnanceType || this.buildOrdonnanceTypeDrugs().length === 0) {
      return;
    }

    this.showSaveTypeModal = true;
  }

  protected closeSaveOrdonnanceTypeModal(): void {
    if (this.isSavingOrdonnanceType) {
      return;
    }

    this.showSaveTypeModal = false;
    this.saveTypeName = '';
  }

  protected saveCurrentOrdonnanceType(): void {
    if (!this.canSaveOrdonnanceType()) {
      return;
    }

    const label = this.normalizeLabel(this.saveTypeName);
    this.isSavingOrdonnanceType = true;
    this.conduiteService
      .saveOrdonnanceTypeCatalogItem({
        label,
        consigne: this.consigne.trim(),
        informationAdditionnel: this.informationAdditionnel.trim(),
        listDrugs: this.buildOrdonnanceTypeDrugs(),
      })
      .pipe(
        finalize(() => {
          this.isSavingOrdonnanceType = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (item) => {
          this.upsertOrdonnanceTypeCatalogItem(item);
          this.showSaveTypeModal = false;
          this.saveTypeName = '';
          this.toastService.success(this.i18n.t('consultation.conduite.ordonnance.saveType.success'));
        },
        error: () => {
          this.toastService.error(this.i18n.t('consultation.conduite.ordonnance.saveType.error'));
        },
      });
  }

  protected onOrdonnanceTypeChange(value: unknown): void {
    const nextTypeKey = this.normalizeOrdonnanceTypeKey(
      typeof value === 'string' ? value : '',
    );

    this.selectedOrdonnanceTypeKey = nextTypeKey || 'standard';
    this.applySelectedTemplateIfAvailable(true);
  }

  protected canAddRow(): boolean {
    return !this.isTemplateReadonlyMode && this.rows.length < this.maxRows;
  }

  protected addRow(): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    if (!this.canAddRow()) {
      return;
    }

    this.rows = [...this.rows, this.createEmptyDrugRow()];
    this.refreshRowOptions();
    this.emitPayload();
  }

  protected removeRow(rowId: string): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    this.rows = this.rows.filter((row) => row.rowId !== rowId);
    if (this.rows.length === 0) {
      this.rows = [this.createEmptyDrugRow()];
    }

    this.refreshRowOptions();
    this.emitPayload();
  }

  protected onClassChange(rowId: string, value: unknown): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    const row = this.findRow(rowId);
    if (!row) {
      return;
    }

    const normalized = this.normalizeLabel(value);
    row.typeClass = normalized;
    this.refreshRowOptions();

    if (!normalized) {
      this.emitPayload();
      return;
    }

    const updatedRow = this.findRow(rowId);
    if (!updatedRow) {
      this.emitPayload();
      return;
    }

    const allowedCategoryKeys = this.getAllowedCategoryKeysForClass(this.normalizeKey(normalized));
    if (updatedRow.category && allowedCategoryKeys.size > 0 && !allowedCategoryKeys.has(this.normalizeKey(updatedRow.category))) {
      updatedRow.category = '';
      this.refreshRowOptions();
    }

    const candidateRow = this.findRow(rowId);
    if (candidateRow?.nom) {
      const allowedMedicineKeys = candidateRow.medicineItems.map((item) => this.normalizeKey(item.value));
      if (!allowedMedicineKeys.includes(this.normalizeKey(candidateRow.nom))) {
        candidateRow.nom = '';
        this.refreshRowOptions();
      }
    }

    const finalRow = this.findRow(rowId);
    if (finalRow?.nom) {
      this.registerLinks(finalRow.typeClass, finalRow.category, finalRow.nom);
    }

    this.emitPayload();
  }

  protected onCategoryChange(rowId: string, value: unknown): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    const row = this.findRow(rowId);
    if (!row) {
      return;
    }

    const category = this.normalizeLabel(value);
    const inferredClass = category
      ? this.inferTherapeuticClassFromCategory(category, row.typeClass)
      : this.normalizeLabel(row.typeClass);

    row.category = category;
    row.typeClass = inferredClass;

    this.refreshRowOptions();

    const updatedRow = this.findRow(rowId);
    if (updatedRow?.nom) {
      const allowedMedicineKeys = updatedRow.medicineItems.map((item) => this.normalizeKey(item.value));
      if (!allowedMedicineKeys.includes(this.normalizeKey(updatedRow.nom))) {
        updatedRow.nom = '';
        this.refreshRowOptions();
      }
    }

    const finalRow = this.findRow(rowId);
    if (finalRow?.nom) {
      this.registerLinks(finalRow.typeClass, finalRow.category, finalRow.nom);
    }

    this.emitPayload();
  }

  protected onMedicineChange(rowId: string, value: unknown): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    const row = this.findRow(rowId);
    if (!row) {
      return;
    }

    const medicine = this.normalizeLabel(value);
    const inferred = this.inferContextFromMedicine(row.typeClass, row.category, medicine);

    row.nom = medicine;
    row.typeClass = inferred.therapeuticClass;
    row.category = inferred.category;

    this.refreshRowOptions();

    if (medicine) {
      this.registerLinks(inferred.therapeuticClass, inferred.category, medicine);
    }

    this.emitPayload();
  }

  protected onPosologyChange(rowId: string, value: unknown): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    const row = this.findRow(rowId);
    if (!row) {
      return;
    }

    row.posology = this.extractLabel(value);
    this.emitPayload();
  }

  protected onDureeChange(rowId: string, value: unknown): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    const row = this.findRow(rowId);
    if (!row) {
      return;
    }

    row.duree = this.normalizeLabel(value);
    this.emitPayload();
  }

  protected addClassTag(term: string): string {
    if (this.isTemplateReadonlyMode) {
      return '';
    }

    const value = this.normalizeLabel(term);
    if (!value) {
      return '';
    }

    this.classOptions = this.upsertOption(this.classOptions, value);

    this.interrogatoireService
      .addTherapeuticClassCatalogItem({ label: value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          const label = this.normalizeLabel(item?.label);
          if (!label) {
            return;
          }

          this.classOptions = this.upsertOption(this.classOptions, label);
          this.refreshRowOptions();
        },
      });

    return value;
  }

  protected addCategoryTag(rowId: string, term: string): string {
    if (this.isTemplateReadonlyMode) {
      return '';
    }

    const value = this.normalizeLabel(term);
    if (!value) {
      return '';
    }

    this.categoryOptions = this.upsertOption(this.categoryOptions, value);

    const row = this.findRow(rowId);
    const therapeuticClass = this.normalizeLabel(row?.typeClass ?? '');

    this.interrogatoireService
      .addTreatmentCategoryCatalogItem({
        label: value,
        therapeuticClass,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          const label = this.normalizeLabel(item?.label);
          if (!label) {
            return;
          }

          this.categoryOptions = this.upsertOption(this.categoryOptions, label);
          this.refreshRowOptions();
        },
      });

    if (row) {
      this.registerLinks(row.typeClass, value, '');
    }

    this.refreshRowOptions();
    return value;
  }

  protected addMedicineTag(rowId: string, term: string): string {
    if (this.isTemplateReadonlyMode) {
      return '';
    }

    const value = this.normalizeLabel(term);
    if (!value) {
      return '';
    }

    this.medicineOptions = this.upsertOption(this.medicineOptions, value);

    const row = this.findRow(rowId);
    const therapeuticClass = this.normalizeLabel(row?.typeClass ?? '');
    const category = this.normalizeLabel(row?.category ?? '');

    this.interrogatoireService
      .addTreatmentMedicineCatalogItem({
        label: value,
        therapeuticClass,
        category,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          const label = this.normalizeLabel(item?.label);
          if (!label) {
            return;
          }

          this.medicineOptions = this.upsertOption(this.medicineOptions, label);
          this.refreshRowOptions();
        },
      });

    if (row) {
      this.registerLinks(row.typeClass, row.category, value);
    }

    this.refreshRowOptions();
    return value;
  }

  protected addPosologyTag(term: string): string {
    if (this.isTemplateReadonlyMode) {
      return '';
    }

    const value = this.normalizeLabel(term);
    if (!value) {
      return '';
    }

    this.posologyOptions = this.upsertOption(this.posologyOptions, value);
    this.posologyOptionsCache.clear();
    return value;
  }

  protected addDureeTag(term: string): string {
    if (this.isTemplateReadonlyMode) {
      return '';
    }

    const value = this.normalizeLabel(term);
    if (!value) {
      return '';
    }

    this.dureeOptions = this.upsertOption(this.dureeOptions, value);
    return value;
  }

  protected addConsigneTag(term: string): string {
    if (this.isTemplateReadonlyMode) {
      return '';
    }

    const value = this.normalizeLabel(term);
    if (!value) {
      return '';
    }

    if (!this.consigneOptions.some((item) => this.normalizeKey(item) === this.normalizeKey(value))) {
      this.consigneOptions = [...this.consigneOptions, value];
    }

    this.consigne = value;
    this.emitPayload();
    return value;
  }

  protected onConsigneChange(value: unknown): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    this.consigne = this.normalizeLabel(value);
    this.emitPayload();
  }

  protected onInformationAdditionnelChange(value: string): void {
    if (this.isTemplateReadonlyMode) {
      return;
    }

    this.informationAdditionnel = value;
    this.emitPayload();
  }

  protected onPrintClick(): void {
    if (this.isPrinting) {
      return;
    }

    this.printRequested.emit();
  }

  protected displayKnownDefaultTreatmentValue(value: unknown): string {
    const rawValue = this.extractLabel(value);
    if (!rawValue) {
      return '';
    }

    const translationKey = findKnownDefaultTreatmentValueTranslationKey(rawValue);
    if (!translationKey) {
      return rawValue;
    }

    const translated = this.i18n.t(translationKey);
    return translated !== translationKey ? translated : rawValue;
  }

  protected trackRow(_: number, row: OrdonnanceDrugRow): string {
    return row.rowId;
  }

  protected posologyOptionsForRow(row: OrdonnanceDrugRow): OptionItem[] {
    const cacheKey = this.buildPosologyOptionsCacheKey(row.typeClass, row.posology);
    const cached = this.posologyOptionsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const isCollyre = this.normalizeKey(row.typeClass) === 'collyre';
    const gtOptions: OptionItem[] = [];
    const cpOptions: OptionItem[] = [];

    for (const option of this.posologyOptions) {
      const key = this.normalizeKey(option.value);
      if (this.posologyGtKeywords.some((item) => key.includes(item))) {
        gtOptions.push(option);
      } else if (this.posologyCpKeywords.some((item) => key.includes(item))) {
        cpOptions.push(option);
      }
    }

    const ordered = isCollyre
      ? (gtOptions.length > 0 ? gtOptions : this.posologyOptions)
      : (cpOptions.length > 0 ? cpOptions : this.posologyOptions);

    const result = row.posology && !ordered.some((item) => this.normalizeKey(item.value) === this.normalizeKey(row.posology))
      ? [...ordered, { value: row.posology, label: row.posology }]
      : ordered;

    this.posologyOptionsCache.set(cacheKey, result);
    return result;
  }

  private buildPosologyOptionsCacheKey(classRaw: unknown, selectedPosologyRaw: unknown): string {
    const classKey = this.normalizeKey(this.normalizeLabel(classRaw));
    const selectedPosologyKey = this.normalizeKey(this.normalizeLabel(selectedPosologyRaw));
    const catalogKey = this.posologyOptions.map((item) => this.normalizeKey(item.value)).join('|');
    return `${classKey}::${selectedPosologyKey}::${catalogKey}`;
  }

  private applyLatestOrdonnancePayload(payload: Record<string, unknown>): boolean {
    const importedRows = this.readDrugRows(payload);
    const importedConsigne = this.readString(payload['consigne']).trim();
    const importedInformationAdditionnel = this.readString(payload['informationAdditionnel']).trim();

    if (importedRows.length === 0 && !importedConsigne && !importedInformationAdditionnel) {
      return false;
    }

    this.selectedOrdonnanceTypeKey = 'standard';
    this.isTemplateReadonlyMode = false;
    this.rows = importedRows.length > 0 ? importedRows : [this.createEmptyDrugRow()];
    this.consigne = importedConsigne;
    this.informationAdditionnel = importedInformationAdditionnel;

    if (this.consigne && !this.consigneOptions.some((item) => this.normalizeKey(item) === this.normalizeKey(this.consigne))) {
      this.consigneOptions = [...this.consigneOptions, this.consigne];
    }

    this.mergeDrugRowValuesIntoOptions(this.rows);
    this.refreshRowOptions();
    this.emitPayload();
    return true;
  }

  private mapOngoingTreatmentsToDrugRows(
    treatments: UpdateOngoingTreatmentMedicineRequest[] | null | undefined,
  ): OrdonnanceDrugRow[] {
    return (treatments ?? [])
      .map((item) => {
        const therapeuticClass = this.normalizeLabel(item?.therapeuticClass);
        const category = this.normalizeLabel(item?.category);
        const medicine = this.normalizeLabel(item?.medicine);

        if (!therapeuticClass && !category && !medicine) {
          return null;
        }

        return this.createDrugRow(
          therapeuticClass,
          category,
          medicine,
          this.normalizeLabel(item?.posology),
          this.normalizeLabel(item?.duration),
        );
      })
      .filter((row): row is OrdonnanceDrugRow => row !== null);
  }

  private mergeImportedRows(importedRows: OrdonnanceDrugRow[], keepExistingRows: boolean): OrdonnanceDrugRow[] {
    const currentRows = keepExistingRows
      ? this.rows.filter((row) => this.hasMeaningfulDrugRow(row))
      : [];
    const merged = [...currentRows];
    const seen = new Set(merged.map((row) => this.buildDrugRowKey(row)));

    for (const row of importedRows) {
      const key = this.buildDrugRowKey(row);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(row);
    }

    return merged.length > 0 ? merged : [this.createEmptyDrugRow()];
  }

  private mergeDrugRowValuesIntoOptions(rows: OrdonnanceDrugRow[]): void {
    for (const row of rows) {
      if (row.typeClass) {
        this.classOptions = this.upsertOption(this.classOptions, row.typeClass);
      }

      if (row.category) {
        this.categoryOptions = this.upsertOption(this.categoryOptions, row.category);
      }

      if (row.nom) {
        this.medicineOptions = this.upsertOption(this.medicineOptions, row.nom);
      }

      if (row.posology) {
        this.posologyOptions = this.upsertOption(this.posologyOptions, row.posology);
      }

      if (row.duree) {
        this.dureeOptions = this.upsertOption(this.dureeOptions, row.duree);
      }

      this.registerLinks(row.typeClass, row.category, row.nom);
    }
    this.posologyOptionsCache.clear();
  }

  private hasMeaningfulDrugRow(row: OrdonnanceDrugRow): boolean {
    return !!(
      this.normalizeLabel(row.typeClass) ||
      this.normalizeLabel(row.category) ||
      this.normalizeLabel(row.nom) ||
      this.normalizeLabel(row.posology) ||
      this.normalizeLabel(row.duree)
    );
  }

  private buildDrugRowKey(row: OrdonnanceDrugRow): string {
    return [
      row.typeClass,
      row.category,
      row.nom,
      row.posology,
      row.duree,
    ]
      .map((value) => this.normalizeKey(this.normalizeLabel(value)))
      .join('|');
  }

  private emitPayload(): void {
    const listDrugs = this.rows
      .map((row) => ({
        typeClass: row.typeClass.trim(),
        category: row.category.trim(),
        nom: row.nom.trim(),
        posology: row.posology.trim(),
        duree: row.duree.trim(),
      }))
      .filter((row) =>
        !!(row.typeClass || row.category || row.nom || row.posology || row.duree),
      );

    const payload = {
      ordonnanceTypeKey: this.selectedOrdonnanceTypeKey,
      listDrugs,
      consigne: this.consigne.trim(),
      informationAdditionnel: this.informationAdditionnel.trim(),
    };

    this.lastEmittedPayloadSignature = this.buildPayloadSignature(payload);
    this.payloadChange.emit(payload);
  }

  private buildOrdonnanceTypeDrugs(): ConduiteOrdonnanceTypeDrugResponse[] {
    return this.rows
      .map((row) => ({
        therapeuticClass: row.typeClass.trim(),
        category: row.category.trim(),
        medicine: row.nom.trim(),
        posology: row.posology.trim(),
        duration: row.duree.trim(),
      }))
      .filter((row) =>
        !!(row.therapeuticClass || row.category || row.medicine || row.posology || row.duration),
      );
  }

  private loadOrdonnanceTypeCatalog(): void {
    this.conduiteService
      .getOrdonnanceTypeCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types) => {
          this.hasLoadedOrdonnanceTypes = true;
          this.ordonnanceTypesByKey.clear();

          const normalizedTypes = (types ?? [])
            .map((item) => ({
              ...item,
              typeKey: this.normalizeOrdonnanceTypeKey(item?.typeKey),
              label: this.normalizeLabel(item?.label),
            }))
            .filter((item) => !!item.typeKey);

          for (const type of normalizedTypes) {
            this.ordonnanceTypesByKey.set(type.typeKey, type);
          }

          this.ordonnanceTypeOptions = [
            {
              value: 'standard',
              label: this.resolveOrdonnanceTypeLabel('consultation.conduite.ordonnance.types.standard', 'Standard'),
            },
            ...normalizedTypes
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((item) => ({
                value: item.typeKey,
                label: this.resolveOrdonnanceTypeLabel(item.translationKey, item.label || item.typeKey),
              })),
          ];

          this.applySelectedTemplateIfAvailable(false);
        },
        error: () => {
          this.hasLoadedOrdonnanceTypes = true;
          this.ordonnanceTypeOptions = [{
            value: 'standard',
            label: this.resolveOrdonnanceTypeLabel('consultation.conduite.ordonnance.types.standard', 'Standard'),
          }];
          this.applySelectedTemplateIfAvailable(false);
        },
      });
  }

  private upsertOrdonnanceTypeCatalogItem(item: ConduiteOrdonnanceTypeCatalogItemResponse): void {
    const typeKey = this.normalizeOrdonnanceTypeKey(item?.typeKey);
    if (!typeKey) {
      return;
    }

    const normalized = {
      ...item,
      typeKey,
      label: this.normalizeLabel(item?.label),
      listDrugs: [...(item?.listDrugs ?? [])],
    };

    this.ordonnanceTypesByKey.set(typeKey, normalized);
    const option = {
      value: typeKey,
      label: this.resolveOrdonnanceTypeLabel(normalized.translationKey, normalized.label || typeKey),
    };
    const withoutExisting = this.ordonnanceTypeOptions.filter((entry) => entry.value !== typeKey);
    this.ordonnanceTypeOptions = [...withoutExisting, option];
  }

  private resolveOrdonnanceTypeLabel(translationKeyRaw: unknown, fallback: string): string {
    const translationKey = this.normalizeLabel(translationKeyRaw);
    if (translationKey) {
      const translated = this.i18n.t(translationKey);
      if (translated !== translationKey) {
        return translated;
      }
    }

    return fallback;
  }

  private applySelectedTemplateIfAvailable(emitPayload: boolean): void {
    const selectedKey = this.normalizeOrdonnanceTypeKey(this.selectedOrdonnanceTypeKey);
    if (!selectedKey || selectedKey === 'standard') {
      this.selectedOrdonnanceTypeKey = 'standard';
      this.isTemplateReadonlyMode = false;

      if (emitPayload) {
        this.emitPayload();
      }

      return;
    }

    const template = this.ordonnanceTypesByKey.get(selectedKey);
    if (!template) {
      if (this.hasLoadedOrdonnanceTypes) {
        this.selectedOrdonnanceTypeKey = 'standard';
        this.isTemplateReadonlyMode = false;
      } else {
        this.selectedOrdonnanceTypeKey = selectedKey;
        this.isTemplateReadonlyMode = true;
      }

      if (emitPayload) {
        this.emitPayload();
      }

      return;
    }

    this.selectedOrdonnanceTypeKey = selectedKey;
    this.isTemplateReadonlyMode = true;

    const templateRows = (template.listDrugs ?? [])
      .map((drug) =>
        this.createDrugRow(
          this.readString(drug?.therapeuticClass),
          this.readString(drug?.category),
          this.readString(drug?.medicine),
          this.readString(drug?.posology),
          this.readString(drug?.duration),
        ),
      )
      .filter((row) => !!(row.typeClass || row.category || row.nom || row.posology || row.duree));

    this.rows = templateRows.length > 0 ? templateRows : [this.createEmptyDrugRow()];
    this.consigne = this.normalizeLabel(template.consigne);
    this.informationAdditionnel = this.normalizeLabel(template.informationAdditionnel);

    if (this.consigne && !this.consigneOptions.some((item) => this.normalizeKey(item) === this.normalizeKey(this.consigne))) {
      this.consigneOptions = [...this.consigneOptions, this.consigne];
    }

    this.mergeDrugRowValuesIntoOptions(this.rows);
    this.refreshRowOptions();

    if (emitPayload) {
      this.emitPayload();
    }
  }

  private loadCatalogSnapshot(): void {
    forkJoin({
      classCatalog: this.interrogatoireService.getTherapeuticClassCatalog(),
      categoryCatalog: this.interrogatoireService.getTreatmentCategoryCatalog(),
      medicineCatalog: this.interrogatoireService.getTreatmentMedicineCatalog(),
      relationCatalog: this.interrogatoireService.getTreatmentCatalogRelations(),
    }).subscribe({
      next: ({ classCatalog, categoryCatalog, medicineCatalog, relationCatalog }) => {
        this.classOptions = this.mapCatalogItems(classCatalog);
        this.classOptions = this.upsertOption(this.classOptions, 'Collyre');
        this.categoryOptions = this.mapCatalogItems(categoryCatalog);
        this.medicineOptions = this.mapCatalogItems(medicineCatalog);
        this.rebuildRelations(relationCatalog);
        this.mergeDrugRowValuesIntoOptions(this.rows);
        this.refreshRowOptions();
      },
      error: () => {
        this.classOptions = this.upsertOption(this.classOptions, 'Collyre');
        this.refreshRowOptions();
      },
    });
  }

  private mapCatalogItems(items: TreatmentCatalogItem[]): OptionItem[] {
    const labels = (items ?? []).map((item) => this.normalizeLabel(item?.label)).filter((item) => !!item);

    const unique: string[] = [];
    for (const label of labels) {
      if (!unique.some((entry) => this.normalizeKey(entry) === this.normalizeKey(label))) {
        unique.push(label);
      }
    }

    return unique.map((label) => ({
      label,
      value: label,
    }));
  }

  private rebuildRelations(relations: TreatmentCatalogRelation[]): void {
    this.categoriesByClass.clear();
    this.therapeuticClassesByCategory.clear();
    this.medicinesByCategory.clear();
    this.medicinesByClassAndCategory.clear();
    this.classAndCategoryByMedicine.clear();

    for (const relation of relations ?? []) {
      this.registerLinks(relation?.therapeuticClass, relation?.category, relation?.medicine);
    }
  }

  private refreshRowOptions(): void {
    this.rows = this.rows.map((row) => {
      const classKey = this.normalizeKey(row.typeClass);
      const categoryKey = this.normalizeKey(row.category);

      const categoryItems = this.ensureOptionPresent(row.category, this.filterCategoriesForClass(classKey));
      const medicineItems = this.ensureOptionPresent(
        row.nom,
        this.filterMedicinesForContext(classKey, categoryKey),
      );

      return {
        ...row,
        categoryItems,
        medicineItems,
      };
    });
  }

  private inferTherapeuticClassFromCategory(categoryRaw: string, currentClassRaw: string): string {
    const categoryKey = this.normalizeKey(categoryRaw);
    const currentClass = this.normalizeLabel(currentClassRaw);
    const currentClassKey = this.normalizeKey(currentClass);

    if (!categoryKey) {
      return currentClass;
    }

    const classKeys = this.therapeuticClassesByCategory.get(categoryKey);
    if (!classKeys || classKeys.size === 0) {
      return currentClass;
    }

    const selectedClassKey = this.pickExistingOrFirstKey(classKeys, currentClassKey);
    return this.resolveClassLabel(selectedClassKey, currentClass);
  }

  private inferContextFromMedicine(
    currentClassRaw: string,
    currentCategoryRaw: string,
    medicineRaw: string,
  ): { therapeuticClass: string; category: string } {
    const therapeuticClass = this.normalizeLabel(currentClassRaw);
    const category = this.normalizeLabel(currentCategoryRaw);
    const medicineKey = this.normalizeKey(medicineRaw);

    if (!medicineKey) {
      return { therapeuticClass, category };
    }

    const relationKeys = this.classAndCategoryByMedicine.get(medicineKey);
    if (!relationKeys || relationKeys.size === 0) {
      return {
        therapeuticClass: this.inferTherapeuticClassFromCategory(category, therapeuticClass),
        category,
      };
    }

    const currentClassKey = this.normalizeKey(therapeuticClass);
    const currentCategoryKey = this.normalizeKey(category);
    const currentPairKey = this.buildClassAndCategoryContextKey(currentClassKey, currentCategoryKey);

    let selectedPairKey = '';

    if (currentClassKey && currentCategoryKey && relationKeys.has(currentPairKey)) {
      selectedPairKey = currentPairKey;
    }

    if (!selectedPairKey && currentCategoryKey) {
      const candidates = new Set(
        [...relationKeys].filter((pairKey) => this.splitClassAndCategoryContextKey(pairKey).categoryKey === currentCategoryKey),
      );
      selectedPairKey = this.getFirstSortedKey(candidates);
    }

    if (!selectedPairKey && currentClassKey) {
      const candidates = new Set(
        [...relationKeys].filter((pairKey) => this.splitClassAndCategoryContextKey(pairKey).classKey === currentClassKey),
      );
      selectedPairKey = this.getFirstSortedKey(candidates);
    }

    if (!selectedPairKey) {
      selectedPairKey = this.getFirstSortedKey(relationKeys);
    }

    const { classKey, categoryKey } = this.splitClassAndCategoryContextKey(selectedPairKey);
    const nextCategory = categoryKey
      ? this.resolveCategoryLabel(categoryKey, category)
      : category;
    const nextClass = classKey
      ? this.resolveClassLabel(classKey, therapeuticClass)
      : this.inferTherapeuticClassFromCategory(nextCategory, therapeuticClass);

    return {
      therapeuticClass: nextClass,
      category: nextCategory,
    };
  }

  private getAllowedCategoryKeysForClass(classKey: string): Set<string> {
    const categories = this.categoriesByClass.get(classKey);
    if (!categories || categories.size === 0) {
      return new Set<string>();
    }

    return new Set([...categories].map((item) => this.normalizeKey(item)).filter((item) => !!item));
  }

  private pickExistingOrFirstKey(keys: Set<string>, preferredKey: string): string {
    if (preferredKey && keys.has(preferredKey)) {
      return preferredKey;
    }

    return this.getFirstSortedKey(keys);
  }

  private getFirstSortedKey(keys: Set<string>): string {
    return [...keys]
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))[0] ?? '';
  }

  private resolveClassLabel(key: string, fallback: string): string {
    if (!key) {
      return fallback;
    }

    const option = this.classOptions.find((item) => this.normalizeKey(item.value) === key);
    return option?.value ?? fallback;
  }

  private resolveCategoryLabel(key: string, fallback: string): string {
    if (!key) {
      return fallback;
    }

    const option = this.categoryOptions.find((item) => this.normalizeKey(item.value) === key);
    return option?.value ?? fallback;
  }

  private registerLinks(classRaw: unknown, categoryRaw: unknown, medicineRaw: unknown): void {
    const therapeuticClass = this.normalizeLabel(classRaw);
    const category = this.normalizeLabel(categoryRaw);
    const medicine = this.normalizeLabel(medicineRaw);

    const classKey = this.normalizeKey(therapeuticClass);
    const categoryKey = this.normalizeKey(category);
    const medicineKey = this.normalizeKey(medicine);

    if (classKey && category) {
      this.addToMapSet(this.categoriesByClass, classKey, category);
    }

    if (categoryKey && classKey) {
      this.addToMapSet(this.therapeuticClassesByCategory, categoryKey, classKey);
    }

    if (categoryKey && medicine) {
      this.addToMapSet(this.medicinesByCategory, categoryKey, medicine);
    }

    const relationKey = this.buildRelationKey(classKey, categoryKey);
    if (relationKey && medicine) {
      this.addToMapSet(this.medicinesByClassAndCategory, relationKey, medicine);
    }

    if (medicineKey && (classKey || categoryKey)) {
      this.addToMapSet(
        this.classAndCategoryByMedicine,
        medicineKey,
        this.buildClassAndCategoryContextKey(classKey, categoryKey),
      );
    }
  }

  private addToMapSet(map: Map<string, Set<string>>, key: string, value: string): void {
    if (!key || !value) {
      return;
    }

    const set = map.get(key) ?? new Set<string>();
    set.add(value);
    map.set(key, set);
  }

  private filterCategoriesForClass(classKey: string): OptionItem[] {
    if (!classKey) {
      return [...this.categoryOptions];
    }

    const allowed = this.categoriesByClass.get(classKey);
    if (!allowed || allowed.size === 0) {
      return [];
    }

    const filtered = this.categoryOptions.filter((option) =>
      [...allowed].some((item) => this.normalizeKey(item) === this.normalizeKey(option.value)),
    );

    return filtered;
  }

  private filterMedicinesForContext(classKey: string, categoryKey: string): OptionItem[] {
    if (!categoryKey) {
      return [];
    }

    const relationKey = this.buildRelationKey(classKey, categoryKey);
    if (relationKey && this.medicinesByClassAndCategory.has(relationKey)) {
      const allowed = this.medicinesByClassAndCategory.get(relationKey) ?? new Set<string>();
      const filteredByRelation = this.medicineOptions.filter((option) =>
        [...allowed].some((item) => this.normalizeKey(item) === this.normalizeKey(option.value)),
      );

      if (filteredByRelation.length > 0) {
        return filteredByRelation;
      }
    }

    if (categoryKey && this.medicinesByCategory.has(categoryKey)) {
      const allowed = this.medicinesByCategory.get(categoryKey) ?? new Set<string>();
      const filteredByCategory = this.medicineOptions.filter((option) =>
        [...allowed].some((item) => this.normalizeKey(item) === this.normalizeKey(option.value)),
      );

      if (filteredByCategory.length > 0) {
        return filteredByCategory;
      }
    }

    return [];
  }

  private ensureOptionPresent(currentValue: string, options: OptionItem[]): OptionItem[] {
    const normalizedCurrent = this.normalizeLabel(currentValue);
    if (!normalizedCurrent) {
      return options;
    }

    if (options.some((item) => this.normalizeKey(item.value) === this.normalizeKey(normalizedCurrent))) {
      return options;
    }

    return [...options, { label: normalizedCurrent, value: normalizedCurrent }];
  }

  private findRow(rowId: string): OrdonnanceDrugRow | null {
    return this.rows.find((row) => row.rowId === rowId) ?? null;
  }

  private readDrugRows(payload: Record<string, unknown>): OrdonnanceDrugRow[] {
    const listDrugs = payload['listDrugs'];
    if (!Array.isArray(listDrugs)) {
      return [];
    }

    return listDrugs
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return this.createEmptyDrugRow();
        }

        const row = entry as Record<string, unknown>;
        return this.createDrugRow(
          this.readString(row['typeClass']),
          this.readString(row['category']),
          this.readString(row['nom']),
          this.readString(row['posology']),
          this.readString(row['duree']),
        );
      })
      .filter((row) => row.typeClass || row.category || row.nom || row.posology || row.duree);
  }

  private createEmptyDrugRow(): OrdonnanceDrugRow {
    return this.createDrugRow('', '', '', '', '');
  }

  private createDrugRow(
    typeClassRaw: string,
    categoryRaw: string,
    nomRaw: string,
    posologyRaw: string,
    dureeRaw: string,
  ): OrdonnanceDrugRow {
    const typeClass = this.normalizeLabel(typeClassRaw);
    const category = this.normalizeLabel(categoryRaw);
    const nom = this.normalizeLabel(nomRaw);
    const posology = this.normalizeLabel(posologyRaw);
    const duree = this.normalizeLabel(dureeRaw);

    const classKey = this.normalizeKey(typeClass);
    const categoryKey = this.normalizeKey(category);
    const categoryItems = this.ensureOptionPresent(category, this.filterCategoriesForClass(classKey));
    const medicineItems = this.ensureOptionPresent(nom, this.filterMedicinesForContext(classKey, categoryKey));

    return {
      rowId: this.generateRowId(),
      typeClass,
      category,
      nom,
      posology,
      duree,
      categoryItems,
      medicineItems,
    };
  }

  private upsertOption(options: OptionItem[], value: string): OptionItem[] {
    if (options.some((item) => this.normalizeKey(item.value) === this.normalizeKey(value))) {
      return options;
    }

    return [...options, { label: value, value }];
  }

  private extractLabel(raw: unknown): string {
    if (typeof raw === 'string') {
      return this.normalizeLabel(raw);
    }

    const candidate = raw as { label?: unknown; value?: unknown; nom?: unknown; name?: unknown } | null;
    if (!candidate) {
      return '';
    }

    if (typeof candidate.value === 'string') {
      return this.normalizeLabel(candidate.value);
    }

    if (typeof candidate.label === 'string') {
      return this.normalizeLabel(candidate.label);
    }

    if (typeof candidate.nom === 'string') {
      return this.normalizeLabel(candidate.nom);
    }

    if (typeof candidate.name === 'string') {
      return this.normalizeLabel(candidate.name);
    }

    return '';
  }

  private normalizeLabel(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeOrdonnanceTypeKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private buildRelationKey(classKey: string, categoryKey: string): string {
    if (!classKey || !categoryKey) {
      return '';
    }

    return `${classKey}::${categoryKey}`;
  }

  private buildClassAndCategoryContextKey(classKey: string, categoryKey: string): string {
    return `${classKey}::${categoryKey}`;
  }

  private splitClassAndCategoryContextKey(pairKey: string): { classKey: string; categoryKey: string } {
    const [classKey = '', categoryKey = ''] = pairKey.split('::', 2);
    return { classKey, categoryKey };
  }

  private generateRowId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private mergeConsigneOptions(options: string[]): string[] {
    const merged = [...this.consigneOptions];

    for (const item of options ?? []) {
      const normalized = this.normalizeLabel(item);
      if (!normalized) {
        continue;
      }

      if (!merged.some((existing) => this.normalizeKey(existing) === this.normalizeKey(normalized))) {
        merged.push(normalized);
      }
    }

    return merged.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  private buildPayloadSignature(payload: Record<string, unknown>): string {
    const listDrugsRaw = payload['listDrugs'];
    const listDrugs = Array.isArray(listDrugsRaw)
      ? listDrugsRaw
          .map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return {
                typeClass: '',
                category: '',
                nom: '',
                posology: '',
                duree: '',
              };
            }

            const row = entry as Record<string, unknown>;
            return {
              typeClass: this.readString(row['typeClass']).trim(),
              category: this.readString(row['category']).trim(),
              nom: this.readString(row['nom']).trim(),
              posology: this.readString(row['posology']).trim(),
              duree: this.readString(row['duree']).trim(),
            };
          })
          .filter((row) => !!(row.typeClass || row.category || row.nom || row.posology || row.duree))
      : [];

    return JSON.stringify({
      ordonnanceTypeKey: this.readString(payload['ordonnanceTypeKey']).trim() || 'standard',
      listDrugs,
      consigne: this.readString(payload['consigne']).trim(),
      informationAdditionnel: this.readString(payload['informationAdditionnel']).trim(),
    });
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
