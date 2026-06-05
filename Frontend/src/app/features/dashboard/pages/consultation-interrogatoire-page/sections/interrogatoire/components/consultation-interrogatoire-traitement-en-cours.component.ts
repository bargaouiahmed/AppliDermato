import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  NgLabelTemplateDirective,
  NgNotFoundTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { findKnownDefaultTreatmentValueTranslationKey } from '../../../../../../../core/i18n/default-treatment-values';
import {
  InterrogatoireOrdonnanceHistoryResponse,
  TreatmentCatalogRelation,
  TreatmentCatalogItem,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../../core/models/interrogatoire.models';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../../../../core/services/interrogatoire.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type OptionItem = {
  label: string;
  value: string;
};

type TreatmentRow = {
  rowId: string;
  medicine: string;
  therapeuticClass: string;
  category: string;
  posology: string;
  duration: string;
  date: Date;
  categoryItems: OptionItem[];
  medicineItems: OptionItem[];
};

@Component({
  selector: 'app-consultation-interrogatoire-traitement-en-cours',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    NgNotFoundTemplateDirective,
    TranslatePipe,
  ],
  templateUrl: './consultation-interrogatoire-traitement-en-cours.component.html',
  styleUrl: './consultation-interrogatoire-traitement-en-cours.component.css',
})
export class ConsultationInterrogatoireTraitementEnCoursComponent implements OnInit {
  @Input() consultationId: string | null = null;
  @Input() treatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Output() treatmentsChange = new EventEmitter<UpdateOngoingTreatmentMedicineRequest[]>();

  protected rows: TreatmentRow[] = [];
  protected treatmentSectionExpanded = false;
  protected treatmentDropdownOpen = false;
  protected medicineOptions: OptionItem[] = [];
  protected therapeuticClassOptions: OptionItem[] = [];
  protected categoryOptions: OptionItem[] = [];
  protected durationOptions: string[] = ['05 jours', '07 jours', '10 jours', '02 semaines', '03 semaines', '01 mois'];
  protected activeView: 'tec' | 'ordonnances' = 'tec';
  protected ordonnanceHistory: InterrogatoireOrdonnanceHistoryResponse[] = [];
  protected selectedOrdonnanceConsultationId = '';
  protected isLoadingOrdonnanceHistory = false;

  private readonly categoriesByClass = new Map<string, Set<string>>();
  private readonly therapeuticClassesByCategory = new Map<string, Set<string>>();
  private readonly medicinesByCategory = new Map<string, Set<string>>();
  private readonly medicinesByClassAndCategory = new Map<string, Set<string>>();
  private readonly classAndCategoryByMedicine = new Map<string, Set<string>>();
  private readonly uncategorizedMedicineKeys = new Set<string>();

  protected posologyOptions: OptionItem[] = [
    { value: '1 gtt x 3 jours', label: 'consultation.page.interrogatoire.treatments.posology.1x3' },
    { value: '1 gtt x 5 jours', label: 'consultation.page.interrogatoire.treatments.posology.1x5' },
    { value: '1 gtt x 7 jours', label: 'consultation.page.interrogatoire.treatments.posology.1x7' },
    { value: '2 gtt x 5 jours', label: 'consultation.page.interrogatoire.treatments.posology.2x5' },
    { value: '2 gtt x 7 jours', label: 'consultation.page.interrogatoire.treatments.posology.2x7' },
    { value: '1 cp * 1/j', label: '1 cp * 1/j' },
    { value: '1 cp * 2/j', label: '1 cp * 2/j' },
    { value: '1 cp * 3/j', label: '1 cp * 3/j' },
    { value: '5 ml * 3/j', label: '5 ml * 3/j' },
    { value: 'Au besoin (PRN)', label: 'Au besoin (PRN)' },
  ];
  private readonly posologyGtKeywords = ['gtt', 'goutte'];
  private readonly posologyCpKeywords = ['cp'];
  private readonly posologyOptionsCache = new Map<string, OptionItem[]>();

  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly destroyRef = inject(DestroyRef);
  private isHydratingFromInput = false;
  private isRowOptionRefreshScheduled = false;
  private isTreatmentWrapperHovered = false;
  private lastEmittedTreatmentsSignature = '';
  private catalogReloadTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected get isRtl(): boolean {
    return this.i18n.dir() === 'rtl';
  }

  protected get dir(): 'rtl' | 'ltr' {
    return this.isRtl ? 'rtl' : 'ltr';
  }

  protected get isSectionCollapsible(): boolean {
    return !this.rows.some((row) => this.hasMeaningfulTreatmentRow(row));
  }

  ngOnInit(): void {
    this.hydrateFromTreatments(this.treatments ?? []);

    this.reloadCatalogSnapshot();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['consultationId']) {
      this.activeView = 'tec';
      this.ordonnanceHistory = [];
      this.selectedOrdonnanceConsultationId = '';
    }

    if (changes['treatments']) {
      if (this.isOrdonnanceHistoryMode()) {
        return;
      }

      const incoming = (this.treatments ?? []).map((item) => this.normalizeTreatmentPayload(item));
      const incomingSignature = this.buildTreatmentsSignature(incoming);
      if (incomingSignature === this.lastEmittedTreatmentsSignature) {
        return;
      }

      this.hydrateFromTreatments(incoming);
      this.lastEmittedTreatmentsSignature = incomingSignature;
    }
  }

  protected addRow(): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    this.rows = [
      ...this.rows,
      {
        rowId: this.generateRowId(),
        medicine: '',
        therapeuticClass: '',
        category: '',
        posology: this.defaultPosologyForClass(''),
        duration: this.durationOptions[0] ?? '',
        date: new Date(),
        categoryItems: [],
        medicineItems: [],
      },
    ];
    this.refreshRowOptions();
    this.updateSectionExpansionState();
    this.emitTreatments();
  }

  protected removeRow(rowId: string): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    this.rows = this.rows.filter((row) => row.rowId !== rowId);
    this.updateSectionExpansionState();
    this.emitTreatments();
  }

  protected toggleTreatmentSection(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isSectionCollapsible) {
      this.treatmentSectionExpanded = true;
      return;
    }

    this.treatmentSectionExpanded = !this.treatmentSectionExpanded;
  }

  protected onTreatmentWrapperEnter(): void {
    this.isTreatmentWrapperHovered = true;
    if (this.isSectionCollapsible && !this.treatmentDropdownOpen) {
      this.treatmentSectionExpanded = true;
    }
  }

  protected onTreatmentWrapperLeave(): void {
    this.isTreatmentWrapperHovered = false;
    if (this.isSectionCollapsible && !this.treatmentDropdownOpen) {
      this.treatmentSectionExpanded = false;
    }
  }

  protected onTreatmentSelectOpen(): void {
    this.treatmentDropdownOpen = true;
    this.treatmentSectionExpanded = true;
  }

  protected onTreatmentSelectClose(): void {
    this.treatmentDropdownOpen = false;
    this.updateSectionExpansionState();
  }

  protected onMedicineChange(rowId: string, value: unknown): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    const medicine = this.normalizeLabel(value);
    const row = this.findRow(rowId);
    if (!row) {
      this.emitTreatments();
      return;
    }

    const currentTherapeuticClass = this.normalizeLabel(row.therapeuticClass);
    const currentCategory = this.normalizeLabel(row.category);
    const inferred = this.inferContextFromMedicine(currentTherapeuticClass, currentCategory, medicine);

    this.updateRow(rowId, {
      medicine,
      therapeuticClass: inferred.therapeuticClass,
      category: inferred.category,
    });

    if (medicine) {
      this.registerLinks(inferred.therapeuticClass, inferred.category, medicine);
    }

    this.emitTreatments();
  }

  protected onTherapeuticClassChange(rowId: string, value: unknown): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    const therapeuticClass = this.normalizeLabel(value);
    const row = this.findRow(rowId);
    if (!row) {
      this.emitTreatments();
      return;
    }

    const nextCategory = this.normalizeLabel(row.category);
    this.updateRow(rowId, {
      therapeuticClass,
      category: nextCategory,
    });

    const updatedRow = this.findRow(rowId);
    if (!updatedRow) {
      this.emitTreatments();
      return;
    }

    if (!therapeuticClass) {
      this.emitTreatments();
      return;
    }

    const allowedCategoryKeys = this.getAllowedCategoryKeysForClass(this.normalizeKey(therapeuticClass));
    if (updatedRow.category && allowedCategoryKeys.size > 0 && !allowedCategoryKeys.has(this.normalizeKey(updatedRow.category))) {
      this.updateRow(rowId, { category: '' });
    }

    const candidateRow = this.findRow(rowId) ?? updatedRow;
    const allowedMedicines = candidateRow.medicineItems.map((item) => this.normalizeKey(item.value));
    if (candidateRow.medicine && !allowedMedicines.includes(this.normalizeKey(candidateRow.medicine))) {
      this.updateRow(rowId, { medicine: '' });
    }

    this.emitTreatments();
  }

  protected onCategoryChange(rowId: string, value: unknown): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    const category = this.normalizeLabel(value);
    const row = this.findRow(rowId);
    if (!row) {
      this.emitTreatments();
      return;
    }

    const currentTherapeuticClass = this.normalizeLabel(row.therapeuticClass);
    const inferredTherapeuticClass = category
      ? this.inferTherapeuticClassFromCategory(category, currentTherapeuticClass)
      : currentTherapeuticClass;
    const nextCategory = category;

    this.updateRow(rowId, {
      category: nextCategory,
      therapeuticClass: inferredTherapeuticClass,
    });

    const updatedRow = this.findRow(rowId);
    if (!updatedRow) {
      this.emitTreatments();
      return;
    }

    const allowedMedicines = updatedRow.medicineItems.map((item) => this.normalizeKey(item.value));
    if (updatedRow.medicine && !allowedMedicines.includes(this.normalizeKey(updatedRow.medicine))) {
      this.updateRow(rowId, { medicine: '' });
    }

    this.emitTreatments();
  }

  protected onPosologyChange(rowId: string, value: unknown): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    const posology = this.extractLabel(value) || this.defaultPosologyForClass(this.findRow(rowId)?.therapeuticClass);
    this.ensurePosologyOption(posology);
    this.updateRow(rowId, { posology });
    this.emitTreatments();
  }

  protected onDurationChange(rowId: string, value: unknown): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    const duration = this.normalizeLabel(value) || (this.durationOptions[0] ?? '');
    this.updateRow(rowId, { duration });
    this.emitTreatments();
  }

  protected onDateChange(rowId: string, value: unknown): void {
    if (this.isOrdonnanceHistoryMode()) {
      return;
    }

    const parsed = this.parseDateInput(value);
    if (!parsed) {
      return;
    }

    this.updateRow(rowId, { date: parsed });
    this.emitTreatments();
  }

  protected toDateInputValue(date: Date): string {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) {
      return '';
    }

    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  protected addMedicineTag(rowId: string, raw: unknown): string {
    if (this.isOrdonnanceHistoryMode()) {
      return '';
    }

    const label = this.extractLabel(raw);
    if (!label) {
      return '';
    }

    this.onMedicineChange(rowId, label);

    this.medicineOptions = this.mergeOptions(this.medicineOptions, [{ id: '', label }]);
    this.scheduleRefreshRowOptions();
    this.interrogatoireService
      .addTreatmentMedicineCatalogItem({ label })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.medicineOptions = this.mergeOptions(this.medicineOptions, [item]);
          this.scheduleRefreshRowOptions();
          this.scheduleCatalogReload();
        },
        error: () => {
          // Keep optimistic local value and sync from server later.
          this.scheduleCatalogReload();
        },
      });

    return label;
  }

  protected addTherapeuticClassTag(rowId: string, raw: unknown): string {
    if (this.isOrdonnanceHistoryMode()) {
      return '';
    }

    const label = this.extractLabel(raw);
    if (!label) {
      return '';
    }

    this.onTherapeuticClassChange(rowId, label);
    this.therapeuticClassOptions = this.mergeOptions(this.therapeuticClassOptions, [{ id: '', label }]);
    this.scheduleRefreshRowOptions();
    this.interrogatoireService
      .addTherapeuticClassCatalogItem({ label })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.therapeuticClassOptions = this.mergeOptions(this.therapeuticClassOptions, [item]);
          this.scheduleRefreshRowOptions();
          this.scheduleCatalogReload();
        },
        error: () => {
          // Keep optimistic local value and sync from server later.
          this.scheduleCatalogReload();
        },
      });

    return label;
  }

  protected addCategoryTag(rowId: string, raw: unknown): string {
    if (this.isOrdonnanceHistoryMode()) {
      return '';
    }

    const label = this.extractLabel(raw);
    if (!label) {
      return '';
    }

    this.onCategoryChange(rowId, label);

    this.categoryOptions = this.mergeOptions(this.categoryOptions, [{ id: '', label }]);
    this.scheduleRefreshRowOptions();
    this.interrogatoireService
      .addTreatmentCategoryCatalogItem({ label })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.categoryOptions = this.mergeOptions(this.categoryOptions, [item]);
          this.scheduleRefreshRowOptions();
          this.scheduleCatalogReload();
        },
        error: () => {
          // Keep optimistic local value and sync from server later.
          this.scheduleCatalogReload();
        },
      });

    return label;
  }

  protected toSelectModel(value: unknown): string | null {
    const normalized = this.normalizeLabel(value);
    return normalized || null;
  }

  protected addDurationTag(raw: unknown): string {
    if (this.isOrdonnanceHistoryMode()) {
      return '';
    }

    const value = this.extractLabel(raw);
    if (!value) {
      return '';
    }

    if (!this.durationOptions.some((item) => this.normalizeKey(item) === this.normalizeKey(value))) {
      this.durationOptions = [...this.durationOptions, value];
    }

    return value;
  }

  protected addPosologyTag(raw: unknown): string {
    if (this.isOrdonnanceHistoryMode()) {
      return '';
    }

    const value = this.extractLabel(raw);
    if (!value) {
      return '';
    }

    this.ensurePosologyOption(value);
    return value;
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

  protected posologyOptionsForRow(row: TreatmentRow): OptionItem[] {
    const cacheKey = this.buildPosologyOptionsCacheKey(row.therapeuticClass, row.posology);
    const cached = this.posologyOptionsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const isCollyre = this.normalizeKey(row.therapeuticClass) === 'collyre';
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

  protected switchToTecView(): void {
    this.activeView = 'tec';
    this.hydrateFromTreatments(this.treatments ?? []);
  }

  protected switchToOrdonnancesView(): void {
    this.activeView = 'ordonnances';
    this.loadOrdonnanceHistory();
  }

  protected isOrdonnanceHistoryMode(): boolean {
    return this.activeView === 'ordonnances';
  }

  protected selectOrdonnanceHistory(consultationIdRaw: string): void {
    const consultationId = this.normalizeLabel(consultationIdRaw);
    if (!consultationId) {
      return;
    }

    const selected = this.ordonnanceHistory.find((item) => item.consultationId === consultationId);
    if (!selected) {
      return;
    }

    this.selectedOrdonnanceConsultationId = consultationId;
    this.applyOrdonnancePayloadToReadonlyRows(selected.payload);
  }

  private buildCategoryOptions(row: TreatmentRow): OptionItem[] {
    const therapeuticClassKey = this.normalizeKey(row.therapeuticClass);
    if (!therapeuticClassKey) {
      return this.withCurrentOption(this.categoryOptions, row.category);
    }

    const allowedCategoryKeys = this.getAllowedCategoryKeysForClass(therapeuticClassKey);

    if (allowedCategoryKeys.size === 0) {
      return this.withCurrentOption([], row.category);
    }

    const filtered = this.categoryOptions.filter((item) =>
      allowedCategoryKeys.has(this.normalizeKey(item.value)) || this.normalizeKey(item.value) === this.normalizeKey(row.category),
    );

    return this.withCurrentOption(filtered, row.category);
  }

  private buildMedicineOptions(row: TreatmentRow): OptionItem[] {
    const therapeuticClassKey = this.normalizeKey(row.therapeuticClass);
    const categoryKey = this.normalizeKey(row.category);

    if (!therapeuticClassKey && !categoryKey) {
      return this.withCurrentOption(this.medicineOptions, row.medicine);
    }

    if (!therapeuticClassKey && categoryKey) {
      const allowedMedicineKeys = this.getAllowedMedicineKeys('', categoryKey);
      if (allowedMedicineKeys.size === 0) {
        return this.withCurrentOption(this.medicineOptions, row.medicine);
      }

      const filteredByCategory = this.medicineOptions.filter((item) =>
        allowedMedicineKeys.has(this.normalizeKey(item.value)) || this.normalizeKey(item.value) === this.normalizeKey(row.medicine),
      );
      return this.withCurrentOption(filteredByCategory, row.medicine);
    }

    if (therapeuticClassKey && !categoryKey) {
      const classMedicineKeys = this.getAllowedMedicineKeysForClass(therapeuticClassKey);
      if (classMedicineKeys.size === 0) {
        return this.withCurrentOption(this.medicineOptions, row.medicine);
      }

      const filteredByClass = this.medicineOptions.filter((item) =>
        classMedicineKeys.has(this.normalizeKey(item.value)) || this.normalizeKey(item.value) === this.normalizeKey(row.medicine),
      );
      return this.withCurrentOption(filteredByClass, row.medicine);
    }

    const allowedMedicineKeys = this.getAllowedMedicineKeys(therapeuticClassKey, categoryKey);
    if (allowedMedicineKeys.size === 0) {
      return row.medicine
        ? [{ label: row.medicine, value: row.medicine }]
        : [];
    }

    const filtered = this.medicineOptions.filter((item) =>
      allowedMedicineKeys.has(this.normalizeKey(item.value)) || this.normalizeKey(item.value) === this.normalizeKey(row.medicine),
    );

    return this.withCurrentOption(filtered, row.medicine);
  }

  private getAllowedMedicineKeysForClass(therapeuticClassKey: string): Set<string> {
    const aggregated = new Set<string>();
    for (const [key, medicines] of this.medicinesByClassAndCategory.entries()) {
      const [classKey = ''] = key.split('::', 2);
      if (classKey !== therapeuticClassKey) {
        continue;
      }

      for (const medicine of medicines) {
        aggregated.add(medicine);
      }
    }

    return aggregated;
  }

  protected getRowDateLabel(row: TreatmentRow): string {
    const value = row.date instanceof Date ? row.date : new Date(row.date);
    if (Number.isNaN(value.getTime())) {
      return '';
    }

    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const yyyy = value.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private updateRow(rowId: string, changes: Partial<TreatmentRow>): void {
    this.rows = this.rows.map((row) =>
      row.rowId === rowId
        ? { ...row, ...changes }
        : row,
    );
    this.refreshRowOptions();
  }

  private hydrateFromTreatments(treatments: UpdateOngoingTreatmentMedicineRequest[]): void {
    this.isHydratingFromInput = true;

    const hydrated = (treatments ?? []).map((item) => ({
      rowId: this.generateRowId(),
      medicine: this.normalizeLabel(item.medicine),
      therapeuticClass: this.normalizeLabel(item.therapeuticClass),
      category: this.normalizeLabel(item.therapeuticClass) ? this.normalizeLabel(item.category) : '',
      posology: this.normalizeLabel(item.posology) || this.defaultPosologyForClass(item.therapeuticClass),
      duration: this.normalizeLabel(item.duration) || (this.durationOptions[0] ?? ''),
      date: this.parseTreatmentDate(item.date),
      categoryItems: [],
      medicineItems: [],
    }));

    for (const row of hydrated) {
      this.registerLinks(row.therapeuticClass, row.category, row.medicine);
      this.ensurePosologyOption(row.posology);
    }

    this.rows = hydrated.length > 0 ? hydrated : [this.createDefaultRow()];

    this.refreshRowOptions();

    this.medicineOptions = this.mergeOptions(this.medicineOptions, hydrated.map((row) => ({ id: '', label: row.medicine })));
    this.therapeuticClassOptions = this.mergeOptions(this.therapeuticClassOptions, hydrated.map((row) => ({ id: '', label: row.therapeuticClass })));
    this.categoryOptions = this.mergeOptions(this.categoryOptions, hydrated.map((row) => ({ id: '', label: row.category })));

    this.refreshRowOptions();

    this.isHydratingFromInput = false;
    this.updateSectionExpansionState();
  }

  private emitTreatments(): void {
    if (this.isHydratingFromInput || this.isOrdonnanceHistoryMode()) {
      return;
    }

    this.updateSectionExpansionState();

    const payload = this.rows
      .map((row) => {
        const normalized = this.normalizeTreatmentPayload({
          medicine: row.medicine,
          therapeuticClass: row.therapeuticClass,
          category: row.category,
          posology: row.posology,
          duration: row.duration,
          date: this.toDateInputValue(row.date),
        });

        const therapeuticClass = normalized.therapeuticClass;
        return {
          medicine: normalized.medicine,
          therapeuticClass,
          category: therapeuticClass ? normalized.category : '',
          posology: normalized.posology || this.defaultPosologyForClass(therapeuticClass),
          duration: normalized.duration || (this.durationOptions[0] ?? ''),
          date: normalized.date || this.toDateInputValue(row.date),
        };
      });

    for (const row of this.rows) {
      this.registerLinks(row.therapeuticClass, row.category, row.medicine);
    }

    this.lastEmittedTreatmentsSignature = this.buildTreatmentsSignature(payload);
    this.treatmentsChange.emit(payload);
    this.scheduleCatalogReload();
  }

  private scheduleCatalogReload(): void {
    if (this.catalogReloadTimeoutId !== null) {
      clearTimeout(this.catalogReloadTimeoutId);
    }

    // Wait for parent autosave debounce before reloading server-backed relations.
    this.catalogReloadTimeoutId = setTimeout(() => {
      this.catalogReloadTimeoutId = null;
      this.reloadCatalogSnapshot();
    }, 900);
  }

  private reloadCatalogSnapshot(): void {
    forkJoin({
      medicines: this.interrogatoireService.getTreatmentMedicineCatalog(),
      therapeuticClasses: this.interrogatoireService.getTherapeuticClassCatalog(),
      categories: this.interrogatoireService.getTreatmentCategoryCatalog(),
      relations: this.interrogatoireService.getTreatmentCatalogRelations(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ medicines, therapeuticClasses, categories, relations }) => {
          this.medicineOptions = this.mergeOptions(this.medicineOptions, medicines);
          this.therapeuticClassOptions = this.mergeOptions(this.therapeuticClassOptions, therapeuticClasses);
          this.therapeuticClassOptions = this.mergeOptions(this.therapeuticClassOptions, [{ id: '', label: 'Collyre' }]);
          this.categoryOptions = this.mergeOptions(this.categoryOptions, categories);
          this.applyCatalogRelations(relations);
          this.scheduleRefreshRowOptions();
        },
        error: () => {
          // Keep local options and links when catalog endpoints fail.
        },
      });
  }

  private loadOrdonnanceHistory(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    if (!consultationId) {
      this.ordonnanceHistory = [];
      this.selectedOrdonnanceConsultationId = '';
      return;
    }

    this.isLoadingOrdonnanceHistory = true;
    this.interrogatoireService
      .getOrdonnanceHistory(consultationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          this.isLoadingOrdonnanceHistory = false;
          this.ordonnanceHistory = history ?? [];
          if (this.ordonnanceHistory.length === 0) {
            this.selectedOrdonnanceConsultationId = '';
            this.rows = [this.createDefaultRow()];
            return;
          }

          const first = this.ordonnanceHistory[0];
          this.selectedOrdonnanceConsultationId = first.consultationId;
          this.applyOrdonnancePayloadToReadonlyRows(first.payload);
        },
        error: () => {
          this.isLoadingOrdonnanceHistory = false;
          this.ordonnanceHistory = [];
          this.selectedOrdonnanceConsultationId = '';
        },
      });
  }

  private applyOrdonnancePayloadToReadonlyRows(payload: Record<string, unknown>): void {
    const listRaw = payload['listDrugs'];
    const listDrugs = Array.isArray(listRaw) ? listRaw : [];

    const nextRows = listDrugs
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          rowId: this.generateRowId(),
          medicine: this.normalizeLabel(row['nom']),
          therapeuticClass: this.normalizeLabel(row['typeClass']),
          category: this.normalizeLabel(row['category']),
          posology: this.normalizeLabel(row['posology']),
          duration: this.normalizeLabel(row['duree']),
          date: new Date('1970-01-01'),
          categoryItems: [] as OptionItem[],
          medicineItems: [] as OptionItem[],
        };
      })
      .filter((row) => row.medicine || row.therapeuticClass || row.category || row.posology || row.duration);

    this.rows = nextRows.length > 0 ? nextRows : [this.createDefaultRow()];
    this.refreshRowOptions();
    this.treatmentSectionExpanded = true;
  }

  private registerLinks(therapeuticClassRaw: string, categoryRaw: string, medicineRaw: string): void {
    const therapeuticClass = this.normalizeLabel(therapeuticClassRaw);
    const medicine = this.normalizeLabel(medicineRaw);
    const category = therapeuticClass
      ? this.normalizeLabel(categoryRaw)
      : '';

    const therapeuticClassKey = this.normalizeKey(therapeuticClass);
    const categoryKey = this.normalizeKey(category);
    const medicineKey = this.normalizeKey(medicine);

    if (therapeuticClassKey && categoryKey) {
      this.addToMapSet(this.categoriesByClass, therapeuticClassKey, categoryKey);
      this.addToMapSet(this.therapeuticClassesByCategory, categoryKey, therapeuticClassKey);
    }

    if (categoryKey && medicineKey) {
      this.addToMapSet(this.medicinesByCategory, categoryKey, medicineKey);
    }

    if (therapeuticClassKey && categoryKey && medicineKey) {
      this.addToMapSet(this.medicinesByClassAndCategory, `${therapeuticClassKey}::${categoryKey}`, medicineKey);
    }

    if (medicineKey && (therapeuticClassKey || categoryKey)) {
      this.addToMapSet(
        this.classAndCategoryByMedicine,
        medicineKey,
        this.buildClassAndCategoryKey(therapeuticClassKey, categoryKey),
      );
    }

    if (!therapeuticClassKey && !categoryKey && medicineKey) {
      this.uncategorizedMedicineKeys.add(medicineKey);
    }
  }

  private applyCatalogRelations(relations: TreatmentCatalogRelation[]): void {
    if (!Array.isArray(relations) || relations.length === 0) {
      return;
    }

    this.therapeuticClassOptions = this.mergeOptions(
      this.therapeuticClassOptions,
      relations.map((item) => ({ id: '', label: item.therapeuticClass })),
    );
    this.categoryOptions = this.mergeOptions(
      this.categoryOptions,
      relations.map((item) => ({ id: '', label: item.category })),
    );
    this.medicineOptions = this.mergeOptions(
      this.medicineOptions,
      relations.map((item) => ({ id: '', label: item.medicine })),
    );

    for (const relation of relations) {
      this.registerLinks(relation.therapeuticClass, relation.category, relation.medicine);
    }

    this.scheduleRefreshRowOptions();
  }

  private getAllowedCategoryKeysForClass(therapeuticClassKey: string): Set<string> {
    return this.categoriesByClass.get(therapeuticClassKey) ?? new Set<string>();
  }

  private getAllowedMedicineKeys(therapeuticClassKey: string, categoryKey: string): Set<string> {
    if (therapeuticClassKey) {
      const linkedToClassAndCategory = this.medicinesByClassAndCategory.get(`${therapeuticClassKey}::${categoryKey}`);
      if (linkedToClassAndCategory && linkedToClassAndCategory.size > 0) {
        return linkedToClassAndCategory;
      }
    }

    return this.medicinesByCategory.get(categoryKey) ?? new Set<string>();
  }

  private withCurrentOption(options: OptionItem[], currentValueRaw: string): OptionItem[] {
    const currentValue = this.normalizeLabel(currentValueRaw);
    if (!currentValue) {
      return options;
    }

    const currentKey = this.normalizeKey(currentValue);
    if (options.some((item) => this.normalizeKey(item.value) === currentKey)) {
      return options;
    }

    return [...options, { label: currentValue, value: currentValue }]
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
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
    return this.resolveTherapeuticClassLabel(selectedClassKey, currentClass);
  }

  private inferContextFromMedicine(
    currentTherapeuticClassRaw: string,
    currentCategoryRaw: string,
    medicineRaw: string,
  ): { therapeuticClass: string; category: string } {
    const therapeuticClass = this.normalizeLabel(currentTherapeuticClassRaw);
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
    const currentPairKey = this.buildClassAndCategoryKey(currentClassKey, currentCategoryKey);

    let selectedPairKey = '';

    if (currentClassKey && currentCategoryKey && relationKeys.has(currentPairKey)) {
      selectedPairKey = currentPairKey;
    }

    if (!selectedPairKey && currentCategoryKey) {
      const candidates = new Set(
        [...relationKeys].filter((pairKey) => this.splitClassAndCategoryKey(pairKey).categoryKey === currentCategoryKey),
      );
      selectedPairKey = this.getFirstSortedKey(candidates);
    }

    if (!selectedPairKey && currentClassKey) {
      const candidates = new Set(
        [...relationKeys].filter((pairKey) => this.splitClassAndCategoryKey(pairKey).therapeuticClassKey === currentClassKey),
      );
      selectedPairKey = this.getFirstSortedKey(candidates);
    }

    if (!selectedPairKey) {
      selectedPairKey = this.getFirstSortedKey(relationKeys);
    }

    const { therapeuticClassKey, categoryKey } = this.splitClassAndCategoryKey(selectedPairKey);
    const nextCategory = categoryKey
      ? this.resolveCategoryLabel(categoryKey, category)
      : category;
    const nextTherapeuticClass = therapeuticClassKey
      ? this.resolveTherapeuticClassLabel(therapeuticClassKey, therapeuticClass)
      : this.inferTherapeuticClassFromCategory(nextCategory, therapeuticClass);

    return {
      therapeuticClass: nextTherapeuticClass,
      category: nextCategory,
    };
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

  private resolveTherapeuticClassLabel(key: string, fallback: string): string {
    if (!key) {
      return fallback;
    }

    const option = this.therapeuticClassOptions.find((item) => this.normalizeKey(item.value) === key);
    return option?.value ?? fallback;
  }

  private resolveCategoryLabel(key: string, fallback: string): string {
    if (!key) {
      return fallback;
    }

    const option = this.categoryOptions.find((item) => this.normalizeKey(item.value) === key);
    return option?.value ?? fallback;
  }

  private buildClassAndCategoryKey(therapeuticClassKey: string, categoryKey: string): string {
    return `${therapeuticClassKey}::${categoryKey}`;
  }

  private splitClassAndCategoryKey(pairKey: string): { therapeuticClassKey: string; categoryKey: string } {
    const [therapeuticClassKey = '', categoryKey = ''] = pairKey.split('::', 2);
    return { therapeuticClassKey, categoryKey };
  }

  private addToMapSet(map: Map<string, Set<string>>, key: string, value: string): void {
    if (!map.has(key)) {
      map.set(key, new Set<string>());
    }

    map.get(key)?.add(value);
  }

  private clearRelationIndexes(): void {
    this.categoriesByClass.clear();
    this.therapeuticClassesByCategory.clear();
    this.medicinesByCategory.clear();
    this.medicinesByClassAndCategory.clear();
    this.classAndCategoryByMedicine.clear();
    this.uncategorizedMedicineKeys.clear();
  }

  private refreshRowOptions(): void {
    this.rows = this.rows.map((row) => ({
      ...row,
      categoryItems: this.buildCategoryOptions(row),
      medicineItems: this.buildMedicineOptions(row),
    }));
  }

  private scheduleRefreshRowOptions(): void {
    if (this.isRowOptionRefreshScheduled) {
      return;
    }

    this.isRowOptionRefreshScheduled = true;
    queueMicrotask(() => {
      this.isRowOptionRefreshScheduled = false;
      this.refreshRowOptions();
    });
  }

  private mergeOptions(existing: OptionItem[], incoming: TreatmentCatalogItem[]): OptionItem[] {
    const byKey = new Map<string, OptionItem>();

    for (const item of existing) {
      const label = this.normalizeLabel(item.label);
      if (!label || byKey.has(label.toLowerCase())) {
        continue;
      }

      byKey.set(label.toLowerCase(), { label, value: label });
    }

    for (const item of incoming) {
      const label = this.normalizeLabel(item.label);
      if (!label || byKey.has(label.toLowerCase())) {
        continue;
      }

      byKey.set(label.toLowerCase(), { label, value: label });
    }

    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
  }

  private ensurePosologyOption(valueRaw: unknown): void {
    const value = this.normalizeLabel(valueRaw);
    if (!value) {
      return;
    }

    if (this.posologyOptions.some((item) => this.normalizeKey(item.value) === this.normalizeKey(value))) {
      return;
    }

    this.posologyOptions = [...this.posologyOptions, { label: value, value }];
    this.posologyOptionsCache.clear();
  }

  private buildPosologyOptionsCacheKey(therapeuticClassRaw: unknown, selectedPosologyRaw: unknown): string {
    const therapeuticClassKey = this.normalizeKey(this.normalizeLabel(therapeuticClassRaw));
    const selectedPosologyKey = this.normalizeKey(this.normalizeLabel(selectedPosologyRaw));
    const catalogKey = this.posologyOptions.map((item) => this.normalizeKey(item.value)).join('|');
    return `${therapeuticClassKey}::${selectedPosologyKey}::${catalogKey}`;
  }

  private defaultPosologyForClass(therapeuticClassRaw: unknown): string {
    const isCollyre = this.normalizeKey(this.normalizeLabel(therapeuticClassRaw)) === 'collyre';
    const filtered = this.posologyOptions.filter((option) => {
      const key = this.normalizeKey(option.value);
      return isCollyre
        ? this.posologyGtKeywords.some((item) => key.includes(item))
        : this.posologyCpKeywords.some((item) => key.includes(item));
    });

    return filtered[0]?.value ?? this.posologyOptions[0]?.value ?? '';
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
    if (typeof value === 'string') {
      return value.trim().replace(/\s+/g, ' ');
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim().replace(/\s+/g, ' ');
  }

  private normalizeKey(value: string): string {
    return this.normalizeLabel(value).toLowerCase();
  }

  private parseDateInput(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private findRow(rowId: string): TreatmentRow | undefined {
    return this.rows.find((row) => row.rowId === rowId);
  }

  private normalizeTreatmentPayload(item: UpdateOngoingTreatmentMedicineRequest): UpdateOngoingTreatmentMedicineRequest {
    const therapeuticClass = this.normalizeLabel(item.therapeuticClass);
    return {
      medicine: this.normalizeLabel(item.medicine),
      therapeuticClass,
      category: therapeuticClass ? this.normalizeLabel(item.category) : '',
      posology: this.normalizeLabel(item.posology),
      duration: this.normalizeLabel(item.duration),
      date: this.normalizeDateField(item.date),
    };
  }

  private buildTreatmentsSignature(items: UpdateOngoingTreatmentMedicineRequest[]): string {
    return JSON.stringify(items.map((item) => this.normalizeTreatmentPayload(item)));
  }

  private normalizeDateField(value: unknown): string {
    const raw = this.normalizeLabel(value);
    if (!raw) {
      return '';
    }

    const parsed = this.parseDateInput(raw);
    return parsed ? this.toDateInputValue(parsed) : '';
  }

  private parseTreatmentDate(value: unknown): Date {
    const normalized = this.normalizeDateField(value);
    if (!normalized) {
      return new Date();
    }

    return this.parseDateInput(normalized) ?? new Date();
  }

  private hasMeaningfulTreatmentRow(row: TreatmentRow): boolean {
    return !!(
      this.normalizeLabel(row.therapeuticClass) ||
      this.normalizeLabel(row.category) ||
      this.normalizeLabel(row.medicine)
    );
  }

  private updateSectionExpansionState(): void {
    if (!this.isSectionCollapsible) {
      this.treatmentSectionExpanded = true;
      return;
    }

    if (!this.treatmentDropdownOpen && !this.isTreatmentWrapperHovered) {
      this.treatmentSectionExpanded = false;
    }
  }

  private createDefaultRow(): TreatmentRow {
    return {
      rowId: this.generateRowId(),
      medicine: '',
      therapeuticClass: '',
      category: '',
      posology: this.defaultPosologyForClass(''),
      duration: this.durationOptions[0] ?? '',
      date: new Date(),
      categoryItems: [],
      medicineItems: [],
    };
  }

  private generateRowId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
