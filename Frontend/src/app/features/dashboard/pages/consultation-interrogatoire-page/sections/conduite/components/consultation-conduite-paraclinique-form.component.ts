import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NgNotFoundTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';

type BilanCheckboxDefinition = {
  key: string;
  label: string;
};

type BilanTypeDefinition = {
  key: string;
  name: string;
  checkboxes: BilanCheckboxDefinition[];
};

type SelectedBilanType = {
  key: string;
  name: string;
  checkboxDefinitions: BilanCheckboxDefinition[];
  checkboxValues: Record<string, boolean>;
  isDefault: boolean;
};

type RowOperationType = 'Chirurgie' | 'Imagerie' | 'Bilan Sanguin';

type RowOperationOption = {
  label: string;
  value: RowOperationType;
};

export type ParacliniquePrintSection = 'chirurgie' | 'imagerie' | 'bilan_sanguin';

export type ParacliniquePrintRequest = {
  mode: 'single' | 'all';
  sections: ParacliniquePrintSection[];
};

type ParacliniqueFieldRules = {
  showClinique: boolean;
  showForfait: boolean;
  showOperateur: boolean;
};

type ParacliniqueRow = {
  id: string;
  operationType: RowOperationType | '';
  typeValue: string;
  typesValue: string[];
  date: string;
  time: string;
  clinique: string;
  forfait: string;
  operateur: string;
  information: string;
  selectedBilanTypeKey: string;
  bilanTypes: SelectedBilanType[];
};

const cloneBilanTypeDefinition = (value: BilanTypeDefinition): BilanTypeDefinition => ({
  key: value.key,
  name: value.name,
  checkboxes: value.checkboxes.map((checkbox) => ({ ...checkbox })),
});

const ALL_BILAN_TYPE_KEY = 'bilanSanguin';

const buildAllBilanType = (types: BilanTypeDefinition[]): BilanTypeDefinition => ({
  name: 'Bilan sanguin',
  key: ALL_BILAN_TYPE_KEY,
  checkboxes: types
    .filter((type) => type.key !== ALL_BILAN_TYPE_KEY)
    .flatMap((type) =>
      type.checkboxes.map((checkbox) => ({
        key: `${type.key}_${checkbox.key}`,
        label: checkbox.label,
      })),
    ),
});

const CHIRURGIE_SUGGESTIONS: string[] = [
  'Biopsie cutanée punch',
  'Biopsie-exérèse lésion pigmentée',
  'Exérèse naevus suspect',
  'Exérèse lésion cutanée bénigne',
  'Exérèse kyste épidermique',
  'Exérèse lipome superficiel',
  'Incision-drainage abcès cutané',
  'Curetage-électrocoagulation verrue/kératose',
  'Cryothérapie verrues/kératoses actiniques',
  'Chirurgie ongle incarné',
  'Parage et suture plaie cutanée simple',
  'Reprise cicatrice hypertrophique/chéloïde',
];

const IMAGERIE_SUGGESTIONS: string[] = [
  'Radiographie thorax',
  'Radiographie rachis lombaire',
  'Radiographie genou',
  'Échographie abdominale',
  'Échographie pelvienne',
  'Échographie thyroïde',
  'Scanner cérébral',
  'Scanner thoraco-abdominal',
  'IRM rachis',
  'IRM cérébrale',
  'Mammographie',
];

const CATEGORIZED_BILAN_TYPES: BilanTypeDefinition[] = [
  {
    name: 'Bilan préopératoire',
    key: 'bilanPreoperatoire',
    checkboxes: [
      { key: 'NFS', label: 'NFS' },
      { key: 'glycemieJeun', label: 'Glycémie à jeun' },
      { key: 'uree', label: 'Urée' },
      { key: 'creatinine', label: 'Créatinine' },
      { key: 'TP_TCA_INR', label: 'TP / TCA / INR' },
      { key: 'serologieVIH', label: 'Sérologie VIH' },
      { key: 'serologieVHB', label: 'Sérologie VHB' },
      { key: 'serologieVHC', label: 'Sérologie VHC' },
    ],
  },
  {
    name: 'Bilan métabolique',
    key: 'bilanMetabolique',
    checkboxes: [
      { key: 'ASAT', label: 'ASAT (TGO)' },
      { key: 'ALAT', label: 'ALAT (TGP)' },
      { key: 'PAL', label: 'PAL (phosphatases alcalines)' },
      { key: 'bilirubineTotale', label: 'Bilirubine totale / conjuguée' },
      { key: 'ionogramme', label: 'Ionogramme sanguin (Na, K, Cl, Ca)' },
      { key: 'cholesterolTotal', label: 'Cholestérol total' },
      { key: 'HDL', label: 'HDL' },
      { key: 'LDL', label: 'LDL' },
      { key: 'triglycerides', label: 'Triglycérides' },
      { key: 'HbA1c', label: 'HbA1c' },
    ],
  },
  {
    name: 'Bilan inflammatoire / auto-immun',
    key: 'bilanInflammatoireAutoImmune',
    checkboxes: [
      { key: 'CRP', label: 'CRP' },
      { key: 'VS', label: 'VS' },
      { key: 'HLA_B27', label: 'HLA-B27' },
      { key: 'ANA', label: 'ANA' },
      { key: 'ANCA', label: 'ANCA' },
      { key: 'facteurRhumatoide', label: 'Facteur rhumatoïde' },
      { key: 'anti_CCP', label: 'Anti-CCP' },
    ],
  },
  {
    name: 'Bilan infectieux',
    key: 'bilanInfectieux',
    checkboxes: [
      { key: 'TPHA_VDRL', label: 'TPHA-VDRL (syphilis)' },
      { key: 'quantiferon', label: 'Quantiferon (tuberculose)' },
      { key: 'toxoplasmose_IgG_IgM', label: 'Sérologie toxoplasmose IgG/IgM' },
      { key: 'serologieHSV_CMV_EBV', label: 'Sérologie HSV / CMV / EBV' },
    ],
  },
  {
    name: 'Bilan endocrinien',
    key: 'bilanEndocrinien',
    checkboxes: [
      { key: 'TSH', label: 'TSH' },
      { key: 'T4_libre', label: 'T4 libre' },
      { key: 'cortisol', label: 'Cortisol' },
    ],
  },
  {
    name: 'Bilan nutritionnel',
    key: 'bilanNutritionnel',
    checkboxes: [
      { key: 'vitamineD', label: 'Vitamine D' },
      { key: 'vitamineB12', label: 'Vitamine B12' },
      { key: 'folates', label: 'Folates' },
    ],
  },
  {
    name: 'Bilan rénal / diabétique',
    key: 'bilanRenalDiabetique',
    checkboxes: [
      { key: 'microalbuminurie', label: 'Microalbuminurie' },
      { key: 'proteinurie', label: 'Protéinurie' },
      { key: 'creatinine_urinaire', label: 'Créatinine urinaire' },
    ],
  },
];

const ALL_BILAN_TYPE: BilanTypeDefinition = {
  ...buildAllBilanType(CATEGORIZED_BILAN_TYPES),
};

const DEFAULT_BILAN_TYPES: BilanTypeDefinition[] = [
  ALL_BILAN_TYPE,
  ...CATEGORIZED_BILAN_TYPES,
];

const PARACLINIQUE_FIELD_RULES: Record<RowOperationType, ParacliniqueFieldRules> = {
  'Chirurgie': {
    showClinique: true,
    showForfait: true,
    showOperateur: true,
  },
  'Imagerie': {
    showClinique: true,
    showForfait: true,
    showOperateur: false,
  },
  'Bilan Sanguin': {
    showClinique: false,
    showForfait: false,
    showOperateur: false,
  },
};

const OPERATION_TYPE_TO_PRINT_SECTION: Record<RowOperationType, ParacliniquePrintSection> = {
  'Chirurgie': 'chirurgie',
  'Imagerie': 'imagerie',
  'Bilan Sanguin': 'bilan_sanguin',
};

const ROW_OPERATION_OPTIONS: RowOperationOption[] = [
  { label: 'Chirurgie', value: 'Chirurgie' },
  { label: 'Imagerie', value: 'Imagerie' },
  { label: 'Bilan sanguin', value: 'Bilan Sanguin' },
];

@Component({
  selector: 'app-consultation-conduite-paraclinique-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgNotFoundTemplateDirective,
  ],
  templateUrl: './consultation-conduite-paraclinique-form.component.html',
  styleUrls: ['./consultation-conduite-paraclinique-form.component.css'],
})
export class ConsultationConduiteParacliniqueFormComponent implements OnChanges {
  @Input() hasChirurgie = false;
  @Input() hasImagerie = false;
  @Input() hasBilanSanguin = false;
  @Input() clinicOptions: string[] = [];
  @Input() isPrinting = false;

  @Input() chirurgiePayload: Record<string, unknown> | null = null;
  @Input() imageriePayload: Record<string, unknown> | null = null;
  @Input() bilanSanguinPayload: Record<string, unknown> | null = null;

  @Output() chirurgiePayloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() imageriePayloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() bilanSanguinPayloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() printRequested = new EventEmitter<ParacliniquePrintRequest>();

  protected readonly chirurgieSuggestions = CHIRURGIE_SUGGESTIONS;
  protected readonly imagerieSuggestions = IMAGERIE_SUGGESTIONS;
  protected readonly operationTypes: RowOperationType[] = ['Chirurgie', 'Imagerie', 'Bilan Sanguin'];
  protected readonly operationTypeSelectOptions = ROW_OPERATION_OPTIONS;

  protected rows: ParacliniqueRow[] = [];
  protected bilanTypeOptions: BilanTypeDefinition[] = DEFAULT_BILAN_TYPES.map(cloneBilanTypeDefinition);

  protected showBilanTypeModal = false;
  protected activeRowId = '';
  protected activeBilanTypeKey = '';
  protected activeBilanTypeLabel = '';
  protected popupCheckboxState: Record<string, boolean> = {};

  protected showCreateOrEditBilanTypeModal = false;
  protected editingBilanTypeKey = '';
  protected editingBilanTypeName = '';
  protected editingBilanTypeCheckboxes: BilanCheckboxDefinition[] = [];
  protected newBilanCheckboxLabel = '';

  private rowSequence = 0;
  private isHydrating = false;
  private pendingBilanTypeModalKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (
      !changes['chirurgiePayload']
      && !changes['imageriePayload']
      && !changes['bilanSanguinPayload']
      && !changes['hasChirurgie']
      && !changes['hasImagerie']
      && !changes['hasBilanSanguin']
    ) {
      return;
    }

    this.hydrateRowsFromPayloads();
  }

  protected requestPrintAll(): void {
    const sections = this.collectPrintableSections();
    if (sections.length === 0) {
      return;
    }

    this.printRequested.emit({
      mode: 'all',
      sections,
    });
  }

  protected trackRow(_: number, row: ParacliniqueRow): string {
    return row.id;
  }

  protected acteColumnLabel(): string {
    const selectedTypes = this.rows
      .map((row) => row.operationType)
      .filter((type): type is RowOperationType => type !== '');

    if (selectedTypes.length === 1 && selectedTypes[0] === 'Bilan Sanguin') {
      return 'Type';
    }

    return 'Acte';
  }

  protected showCliniqueColumn(): boolean {
    return this.rows.some((row) => this.hasFieldRule(row.operationType, 'showClinique'));
  }

  protected showForfaitColumn(): boolean {
    return this.rows.some((row) => this.hasFieldRule(row.operationType, 'showForfait'));
  }

  protected showOperateurColumn(): boolean {
    return this.rows.some((row) => this.hasFieldRule(row.operationType, 'showOperateur'));
  }

  protected supportsClinique(row: ParacliniqueRow): boolean {
    return this.hasFieldRule(row.operationType, 'showClinique');
  }

  protected supportsForfait(row: ParacliniqueRow): boolean {
    return this.hasFieldRule(row.operationType, 'showForfait');
  }

  protected supportsOperateur(row: ParacliniqueRow): boolean {
    return this.hasFieldRule(row.operationType, 'showOperateur');
  }

  protected canPrintAll(): boolean {
    return !this.isPrinting && this.collectPrintableSections().length > 0;
  }

  protected canPrintRow(row: ParacliniqueRow): boolean {
    return !this.isPrinting && this.rowHasMeaningfulData(row) && this.toPrintSection(row.operationType) !== null;
  }

  protected requestRowPrint(row: ParacliniqueRow): void {
    const section = this.toPrintSection(row.operationType);
    if (!section || !this.rowHasMeaningfulData(row)) {
      return;
    }

    this.printRequested.emit({
      mode: 'single',
      sections: [section],
    });
  }

  protected canAddRow(): boolean {
    if (this.rows.length >= this.operationTypes.length) {
      return false;
    }

    const selectedTypes = new Set(
      this.rows
        .map((row) => row.operationType)
        .filter((value): value is RowOperationType => value !== ''),
    );

    return this.operationTypes.some((type) => !selectedTypes.has(type));
  }

  protected addRow(): void {
    if (!this.canAddRow()) {
      return;
    }

    this.rows = [...this.rows, this.createEmptyRow()];
  }

  protected removeRow(rowId: string): void {
    const nextRows = this.rows.filter((row) => row.id !== rowId);
    this.rows = nextRows.length > 0 ? nextRows : [this.createEmptyRow()];

    if (!this.rows.some((row) => row.id === this.activeRowId)) {
      this.closeBilanTypeModal();
    }

    this.emitPayloadsFromRows();
  }

  protected operationTypeOptions(row: ParacliniqueRow): RowOperationOption[] {
    const selectedInOtherRows = new Set(
      this.rows
        .filter((item) => item.id !== row.id)
        .map((item) => item.operationType)
        .filter((value): value is RowOperationType => value !== ''),
    );

    return this.operationTypeSelectOptions.filter((option) => !selectedInOtherRows.has(option.value));
  }

  protected onOperationTypeChange(row: ParacliniqueRow, value: unknown): void {
    const nextOperationType = this.normalizeOperationType(value);
    if (row.operationType === nextOperationType) {
      return;
    }

    const hadMeaningfulData = this.rowHasMeaningfulData(row);

    if (
      nextOperationType
      && this.rows.some((item) => item.id !== row.id && item.operationType === nextOperationType)
    ) {
      return;
    }

    const nextRow: ParacliniqueRow = {
      ...row,
      operationType: nextOperationType,
      typeValue: '',
      typesValue: [],
      date: '',
      time: '',
      clinique: '',
      forfait: '',
      operateur: '',
      information: '',
      selectedBilanTypeKey: '',
      bilanTypes: [],
    };

    this.rows = this.rows.map((item) => item.id === row.id ? nextRow : item);

    if (!nextOperationType && this.activeRowId === row.id) {
      this.closeBilanTypeModal();
    }

    if (hadMeaningfulData || !nextOperationType) {
      this.emitPayloadsFromRows();
    }
  }

  protected onChirurgieTypeChange(row: ParacliniqueRow, value: unknown): void {
    row.typeValue = this.readString(value).trim();
    this.emitPayloadsFromRows();
  }

  protected onImagerieTypesChange(row: ParacliniqueRow, value: unknown): void {
    const source = Array.isArray(value) ? value : [];
    const normalized = source
      .map((entry) => this.readString(entry).trim())
      .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);

    row.typesValue = normalized;
    this.emitPayloadsFromRows();
  }

  protected onRowDateChange(row: ParacliniqueRow, value: unknown): void {
    row.date = this.readString(value).trim();
    this.emitPayloadsFromRows();
  }

  protected onRowTimeChange(row: ParacliniqueRow, value: unknown): void {
    row.time = this.readString(value).trim();
    this.emitPayloadsFromRows();
  }

  protected onRowCliniqueChange(row: ParacliniqueRow, value: unknown): void {
    row.clinique = this.readString(value);
    this.emitPayloadsFromRows();
  }

  protected onRowForfaitChange(row: ParacliniqueRow, value: unknown): void {
    row.forfait = this.readString(value);
    this.emitPayloadsFromRows();
  }

  protected onRowOperateurChange(row: ParacliniqueRow, value: unknown): void {
    row.operateur = this.readString(value);
    this.emitPayloadsFromRows();
  }

  protected onBilanTypeSelected(row: ParacliniqueRow, typeKey: string | null): void {
    if (row.operationType !== 'Bilan Sanguin') {
      return;
    }

    if (!typeKey) {
      row.selectedBilanTypeKey = '';
      return;
    }

    const definition = this.bilanTypeOptions.find((item) => item.key === typeKey);
    if (!definition) {
      row.selectedBilanTypeKey = '';
      return;
    }

    const alreadySelected = row.bilanTypes.some((item) => item.key === definition.key);
    if (!alreadySelected) {
      const checkboxValues: Record<string, boolean> = {};
      for (const checkbox of definition.checkboxes) {
        checkboxValues[checkbox.key] = false;
      }

      row.bilanTypes = [
        ...row.bilanTypes,
        {
          key: definition.key,
          name: definition.name,
          checkboxDefinitions: definition.checkboxes.map((checkbox) => ({ ...checkbox })),
          checkboxValues,
          isDefault: this.isDefaultBilanTypeKey(definition.key),
        },
      ];

      this.emitPayloadsFromRows();
    }

    row.selectedBilanTypeKey = '';
    this.scheduleBilanTypeModalOpen(definition.key);
  }

  protected removeBilanType(row: ParacliniqueRow, typeKey: string): void {
    const nextTypes = row.bilanTypes.filter((item) => item.key !== typeKey);
    if (nextTypes.length === row.bilanTypes.length) {
      return;
    }

    row.bilanTypes = nextTypes;

    if (this.activeRowId === row.id && this.activeBilanTypeKey === typeKey) {
      this.closeBilanTypeModal();
    }

    this.emitPayloadsFromRows();
  }

  protected checkedCount(item: SelectedBilanType): number {
    let count = 0;
    for (const checkbox of item.checkboxDefinitions) {
      if (item.checkboxValues[checkbox.key] === true) {
        count += 1;
      }
    }
    return count;
  }

  protected openBilanTypeModal(rowId: string, typeKey: string): void {
    const row = this.rows.find((item) => item.id === rowId && item.operationType === 'Bilan Sanguin');
    if (!row) {
      return;
    }

    const selectedType = row.bilanTypes.find((item) => item.key === typeKey);
    if (!selectedType) {
      return;
    }

    this.activeRowId = row.id;
    this.activeBilanTypeKey = selectedType.key;
    this.activeBilanTypeLabel = selectedType.name;
    this.popupCheckboxState = { ...selectedType.checkboxValues };
    this.showBilanTypeModal = true;
  }

  private scheduleBilanTypeModalOpen(typeKey: string): void {
    this.pendingBilanTypeModalKey = typeKey;
    setTimeout(() => this.openPendingBilanTypeModal());
  }

  private openPendingBilanTypeModal(): void {
    const typeKey = this.pendingBilanTypeModalKey;
    if (!typeKey) {
      return;
    }

    const row = this.rows.find((item) => (
      item.operationType === 'Bilan Sanguin'
      && item.bilanTypes.some((bilanType) => bilanType.key === typeKey)
    ));

    if (!row) {
      return;
    }

    this.pendingBilanTypeModalKey = '';
    this.openBilanTypeModal(row.id, typeKey);
  }

  protected closeBilanTypeModal(): void {
    this.showBilanTypeModal = false;
    this.activeRowId = '';
    this.activeBilanTypeKey = '';
    this.activeBilanTypeLabel = '';
    this.popupCheckboxState = {};
  }

  protected activeBilanTypeDefinitions(): BilanCheckboxDefinition[] {
    const row = this.rows.find((item) => item.id === this.activeRowId && item.operationType === 'Bilan Sanguin');
    if (!row) {
      return [];
    }

    const selectedType = row.bilanTypes.find((item) => item.key === this.activeBilanTypeKey);
    return selectedType?.checkboxDefinitions ?? [];
  }

  protected onPopupCheckboxToggle(checkboxKey: string, checked: boolean): void {
    this.popupCheckboxState = {
      ...this.popupCheckboxState,
      [checkboxKey]: checked,
    };
  }

  protected saveBilanTypeModal(): void {
    const row = this.rows.find((item) => item.id === this.activeRowId && item.operationType === 'Bilan Sanguin');
    if (!row) {
      this.closeBilanTypeModal();
      return;
    }

    row.bilanTypes = row.bilanTypes.map((item) => {
      if (item.key !== this.activeBilanTypeKey) {
        return item;
      }

      return {
        ...item,
        checkboxValues: this.normalizeCheckboxValues(this.popupCheckboxState, item.checkboxDefinitions),
      };
    });

    this.emitPayloadsFromRows();
    this.closeBilanTypeModal();
  }

  protected onBilanTypeDropdownEdit(typeKey: string, event: Event): void {
    event.stopPropagation();
    this.openEditBilanTypeModal(typeKey);
  }

  protected openCreateBilanTypeModal(): void {
    this.showCreateOrEditBilanTypeModal = true;
    this.editingBilanTypeKey = '';
    this.editingBilanTypeName = '';
    this.editingBilanTypeCheckboxes = [];
    this.newBilanCheckboxLabel = '';
  }

  protected openEditBilanTypeModal(typeKey: string): void {
    const normalizedTypeKey = this.readString(typeKey).trim();
    if (!normalizedTypeKey) {
      return;
    }

    const fromOptions = this.bilanTypeOptions.find((item) => item.key === normalizedTypeKey);
    const fromRows = this.rows
      .flatMap((row) => row.bilanTypes)
      .find((item) => item.key === normalizedTypeKey);

    if (!fromOptions && !fromRows) {
      return;
    }

    const name = fromOptions?.name ?? fromRows?.name ?? normalizedTypeKey;
    const checkboxes = fromOptions?.checkboxes ?? fromRows?.checkboxDefinitions ?? [];

    this.showCreateOrEditBilanTypeModal = true;
    this.editingBilanTypeKey = normalizedTypeKey;
    this.editingBilanTypeName = name;
    this.editingBilanTypeCheckboxes = checkboxes.map((checkbox) => ({ ...checkbox }));
    this.newBilanCheckboxLabel = '';
  }

  protected closeCreateOrEditBilanTypeModal(): void {
    this.showCreateOrEditBilanTypeModal = false;
    this.editingBilanTypeKey = '';
    this.editingBilanTypeName = '';
    this.editingBilanTypeCheckboxes = [];
    this.newBilanCheckboxLabel = '';
  }

  protected addCheckboxToCustomType(): void {
    const label = this.newBilanCheckboxLabel.trim();
    if (!label) {
      return;
    }

    const existingKeys = new Set(this.editingBilanTypeCheckboxes.map((item) => item.key));
    const key = this.buildUniqueCheckboxKey(label, existingKeys);

    this.editingBilanTypeCheckboxes = [
      ...this.editingBilanTypeCheckboxes,
      { key, label },
    ];
    this.newBilanCheckboxLabel = '';
  }

  protected removeCheckboxFromCustomType(index: number): void {
    if (index < 0 || index >= this.editingBilanTypeCheckboxes.length) {
      return;
    }

    this.editingBilanTypeCheckboxes = this.editingBilanTypeCheckboxes.filter((_, itemIndex) => itemIndex !== index);
  }

  protected saveCustomBilanType(): void {
    const name = this.editingBilanTypeName.trim();
    const checkboxDefinitions = this.editingBilanTypeCheckboxes
      .map((checkbox) => ({
        key: checkbox.key.trim(),
        label: checkbox.label.trim(),
      }))
      .filter((checkbox) => checkbox.key.length > 0 && checkbox.label.length > 0);

    if (!name || checkboxDefinitions.length === 0) {
      return;
    }

    if (!this.editingBilanTypeKey) {
      const createdKey = this.buildUniqueBilanTypeKey(name);
      const createdType: BilanTypeDefinition = {
        key: createdKey,
        name,
        checkboxes: checkboxDefinitions,
      };

      this.bilanTypeOptions = [...this.bilanTypeOptions, cloneBilanTypeDefinition(createdType)];
      this.refreshAllBilanTypeOption();
      this.closeCreateOrEditBilanTypeModal();
      this.emitPayloadsFromRows();
      return;
    }

    const updatedType: BilanTypeDefinition = {
      key: this.editingBilanTypeKey,
      name,
      checkboxes: checkboxDefinitions,
    };

    this.bilanTypeOptions = this.bilanTypeOptions.map((item) => {
      if (item.key !== updatedType.key) {
        return item;
      }

      return cloneBilanTypeDefinition(updatedType);
    });

    this.rows = this.rows.map((row) => {
      if (row.operationType !== 'Bilan Sanguin') {
        return row;
      }

      return {
        ...row,
        bilanTypes: row.bilanTypes.map((item) => {
          if (item.key !== updatedType.key) {
            return item;
          }

          return {
            ...item,
            name: updatedType.name,
            checkboxDefinitions: updatedType.checkboxes.map((checkbox) => ({ ...checkbox })),
            checkboxValues: this.normalizeCheckboxValues(item.checkboxValues, updatedType.checkboxes),
          };
        }),
      };
    });

    this.refreshAllBilanTypeOption();

    if (this.activeBilanTypeKey === updatedType.key) {
      this.activeBilanTypeLabel = updatedType.name;
      this.popupCheckboxState = this.normalizeCheckboxValues(
        this.popupCheckboxState,
        updatedType.checkboxes,
      );
    }

    this.closeCreateOrEditBilanTypeModal();
    this.emitPayloadsFromRows();
  }

  private hydrateRowsFromPayloads(): void {
    const nextRows: ParacliniqueRow[] = [];

    const chirurgieRow = this.buildRowFromChirurgiePayload(this.chirurgiePayload ?? {});
    if (chirurgieRow) {
      nextRows.push(chirurgieRow);
    }

    const imagerieRow = this.buildRowFromImageriePayload(this.imageriePayload ?? {});
    if (imagerieRow) {
      nextRows.push(imagerieRow);
    }

    const bilanRow = this.buildRowFromBilanPayload(this.bilanSanguinPayload ?? {});
    if (bilanRow) {
      nextRows.push(bilanRow);
    }

    if (nextRows.length === 0) {
      nextRows.push(this.createEmptyRow());
    }

    this.isHydrating = true;
    this.rows = nextRows;
    this.isHydrating = false;

    if (!this.rows.some((row) => row.id === this.activeRowId)) {
      this.closeBilanTypeModal();
    }
  }

  private emitPayloadsFromRows(): void {
    if (this.isHydrating) {
      return;
    }

    const chirurgieRow = this.rows.find((row) => row.operationType === 'Chirurgie');
    const imagerieRow = this.rows.find((row) => row.operationType === 'Imagerie');
    const bilanRow = this.rows.find((row) => row.operationType === 'Bilan Sanguin');

    this.chirurgiePayloadChange.emit(
      chirurgieRow ? this.buildChirurgiePayload(chirurgieRow) : this.createEmptyChirurgiePayload(),
    );

    this.imageriePayloadChange.emit(
      imagerieRow ? this.buildImageriePayload(imagerieRow) : this.createEmptyImageriePayload(),
    );

    this.bilanSanguinPayloadChange.emit(
      bilanRow ? this.buildBilanPayload(bilanRow) : this.createEmptyBilanPayload(),
    );
  }

  private buildChirurgiePayload(row: ParacliniqueRow): Record<string, unknown> {
    const typeValue = row.typeValue.trim();

    return {
      type: typeValue,
      types: typeValue ? [{ name: typeValue }] : [],
      dateOperation: this.combineDateAndTime(row.date, row.time),
      clinique: row.clinique.trim(),
      forfait: row.forfait.trim(),
      operateur: row.operateur.trim(),
      informationAdditionnel: row.information.trim(),
    };
  }

  private buildImageriePayload(row: ParacliniqueRow): Record<string, unknown> {
    const normalizedTypes = row.typesValue
      .map((entry) => this.readString(entry).trim())
      .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);

    return {
      type: normalizedTypes[0] ?? '',
      types: normalizedTypes.map((name) => ({ name })),
      dateOperation: this.combineDateAndTime(row.date, row.time),
      clinique: row.clinique.trim(),
      forfait: row.forfait.trim(),
      informationAdditionnel: row.information.trim(),
    };
  }

  private buildBilanPayload(row: ParacliniqueRow): Record<string, unknown> {
    const selectedBilanTypes = row.bilanTypes.map((item) => ({
      name: item.name,
      key: item.key,
      isDefault: item.isDefault,
      checkboxDefinitions: item.checkboxDefinitions.map((checkbox) => ({
        key: checkbox.key,
        label: checkbox.label,
      })),
      checkboxValues: { ...item.checkboxValues },
    }));

    const legacyMap: Record<string, Record<string, boolean>> = {};
    for (const item of row.bilanTypes) {
      legacyMap[item.key] = { ...item.checkboxValues };
    }

    return {
      dateOperation: this.combineDateAndTime(row.date, row.time),
      informationAdditionnel: row.information.trim(),
      selectedBilanTypes,
      ...legacyMap,
    };
  }

  private createEmptyChirurgiePayload(): Record<string, unknown> {
    return {
      type: '',
      types: [],
      dateOperation: '',
      clinique: '',
      forfait: '',
      operateur: '',
      informationAdditionnel: '',
    };
  }

  private createEmptyImageriePayload(): Record<string, unknown> {
    return {
      type: '',
      types: [],
      dateOperation: '',
      clinique: '',
      forfait: '',
      informationAdditionnel: '',
    };
  }

  private createEmptyBilanPayload(): Record<string, unknown> {
    return {
      dateOperation: '',
      selectedBilanTypes: [],
      informationAdditionnel: '',
    };
  }

  private buildRowFromChirurgiePayload(payload: Record<string, unknown>): ParacliniqueRow | null {
    const type = this.readFirstTypeName(payload['types'], payload['type']);
    const dateTime = this.splitDateAndTime(this.readString(payload['dateOperation']));
    const clinique = this.readString(payload['clinique']);
    const forfait = this.readString(payload['forfait']);
    const operateur = this.readString(payload['operateur']);
    const information = this.readString(payload['informationAdditionnel']);

    const hasData = !!(
      type
      || dateTime.date
      || dateTime.time
      || clinique.trim()
      || forfait.trim()
      || operateur.trim()
      || information.trim()
    );

    if (!hasData) {
      return null;
    }

    const row = this.createEmptyRow();
    row.operationType = 'Chirurgie';
    row.typeValue = type;
    row.date = dateTime.date;
    row.time = dateTime.time;
    row.clinique = clinique;
    row.forfait = forfait;
    row.operateur = operateur;
    row.information = information;
    return row;
  }

  private buildRowFromImageriePayload(payload: Record<string, unknown>): ParacliniqueRow | null {
    const types = this.readTypeNames(payload['types']);
    const legacyType = this.readString(payload['type']);
    const normalizedTypes = types.length > 0
      ? types
      : (legacyType ? [legacyType] : []);

    const dateTime = this.splitDateAndTime(this.readString(payload['dateOperation']));
    const clinique = this.readString(payload['clinique']);
    const forfait = this.readString(payload['forfait']);
    const information = this.readString(payload['informationAdditionnel']);

    const hasData = !!(
      normalizedTypes.length > 0
      || dateTime.date
      || dateTime.time
      || clinique.trim()
      || forfait.trim()
      || information.trim()
    );

    if (!hasData) {
      return null;
    }

    const row = this.createEmptyRow();
    row.operationType = 'Imagerie';
    row.typesValue = normalizedTypes;
    row.date = dateTime.date;
    row.time = dateTime.time;
    row.clinique = clinique;
    row.forfait = forfait;
    row.information = information;
    return row;
  }

  private buildRowFromBilanPayload(payload: Record<string, unknown>): ParacliniqueRow | null {
    const dateTime = this.splitDateAndTime(this.readString(payload['dateOperation']));
    const information = this.readString(payload['informationAdditionnel']);
    const bilanTypes = this.readSelectedBilanTypes(payload);

    const hasData = !!(
      dateTime.date
      || dateTime.time
      || information.trim()
      || bilanTypes.length > 0
    );

    if (!hasData) {
      return null;
    }

    const row = this.createEmptyRow();
    row.operationType = 'Bilan Sanguin';
    row.date = dateTime.date;
    row.time = dateTime.time;
    row.information = information;
    row.bilanTypes = this.syncBilanTypeCollection(bilanTypes);
    row.selectedBilanTypeKey = '';
    return row;
  }

  private createEmptyRow(): ParacliniqueRow {
    this.rowSequence += 1;
    return {
      id: `paraclinique_row_${this.rowSequence}`,
      operationType: '',
      typeValue: '',
      typesValue: [],
      date: '',
      time: '',
      clinique: '',
      forfait: '',
      operateur: '',
      information: '',
      selectedBilanTypeKey: '',
      bilanTypes: [],
    };
  }

  private normalizeOperationType(value: unknown): RowOperationType | '' {
    const candidate = this.readOperationTypeCandidate(value);
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) {
      return '';
    }

    if (normalized.includes('chirurg')) {
      return 'Chirurgie';
    }

    if (normalized.includes('imagerie') || normalized.includes('imageri')) {
      return 'Imagerie';
    }

    if (normalized.includes('bilan')) {
      return 'Bilan Sanguin';
    }

    return '';
  }

  private readOperationTypeCandidate(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value !== 'object') {
      return String(value);
    }

    const source = value as Record<string, unknown>;
    const direct = this.readString(source['name'])
      || this.readString(source['label'])
      || this.readString(source['value'])
      || this.readString(source['operationType'])
      || this.readString(source['type'])
      || this.readString(source['$ngOptionLabel'])
      || this.readString(source['$ngOptionValue'])
      || this.readString(source['bindLabel'])
      || this.readString(source['bindValue']);

    if (direct) {
      return direct;
    }

    if (typeof source['toString'] === 'function') {
      const fallback = String(source);
      return fallback === '[object Object]' ? '' : fallback;
    }

    return '';
  }

  private rowHasMeaningfulData(row: ParacliniqueRow): boolean {
    if (row.operationType === 'Chirurgie') {
      return !!(
        row.typeValue.trim()
        || row.date.trim()
        || row.time.trim()
        || row.clinique.trim()
        || row.forfait.trim()
        || row.operateur.trim()
        || row.information.trim()
      );
    }

    if (row.operationType === 'Imagerie') {
      return !!(
        row.typesValue.length > 0
        || row.date.trim()
        || row.time.trim()
        || row.clinique.trim()
        || row.forfait.trim()
        || row.information.trim()
      );
    }

    if (row.operationType === 'Bilan Sanguin') {
      return !!(
        row.bilanTypes.length > 0
        || row.date.trim()
        || row.time.trim()
        || row.information.trim()
      );
    }

    return false;
  }

  private collectPrintableSections(): ParacliniquePrintSection[] {
    const sections = new Set<ParacliniquePrintSection>();

    for (const row of this.rows) {
      if (!this.rowHasMeaningfulData(row)) {
        continue;
      }

      const section = this.toPrintSection(row.operationType);
      if (!section) {
        continue;
      }

      sections.add(section);
    }

    return [...sections];
  }

  private hasFieldRule(
    operationType: RowOperationType | '',
    field: keyof ParacliniqueFieldRules,
  ): boolean {
    if (!operationType) {
      return false;
    }

    return PARACLINIQUE_FIELD_RULES[operationType][field] === true;
  }

  private toPrintSection(operationType: RowOperationType | ''): ParacliniquePrintSection | null {
    if (!operationType) {
      return null;
    }

    return OPERATION_TYPE_TO_PRINT_SECTION[operationType] ?? null;
  }

  private readSelectedBilanTypes(payload: Record<string, unknown>): SelectedBilanType[] {
    const selected = payload['selectedBilanTypes'];
    const fromSelected = this.parseSelectedBilanTypes(selected);
    if (fromSelected.length > 0) {
      return fromSelected;
    }

    return this.parseLegacyBilanTypes(payload);
  }

  private parseSelectedBilanTypes(value: unknown): SelectedBilanType[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const result: SelectedBilanType[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const row = entry as Record<string, unknown>;
      const key = this.readString(row['key']);
      const name = this.readString(row['name']) || key;
      if (!key || !name) {
        continue;
      }

      const definitionFromCatalog = this.bilanTypeOptions.find((item) => item.key === key);
      const checkboxDefinitions = this.readCheckboxDefinitions(row['checkboxDefinitions'], definitionFromCatalog);
      const checkboxValues = this.readCheckboxValues(row['checkboxValues'], checkboxDefinitions);
      const isDefault = row['isDefault'] === true
        || this.isDefaultBilanTypeKey(key);

      this.ensureBilanTypeOption({
        key,
        name,
        checkboxes: checkboxDefinitions.map((checkbox) => ({ ...checkbox })),
      });

      result.push({
        key,
        name,
        checkboxDefinitions,
        checkboxValues,
        isDefault,
      });
    }

    if (result.length > 0) {
      this.refreshAllBilanTypeOption();
    }

    return result;
  }

  private parseLegacyBilanTypes(payload: Record<string, unknown>): SelectedBilanType[] {
    const result: SelectedBilanType[] = [];
    for (const definition of this.bilanTypeOptions) {
      const rawGroup = payload[definition.key];
      if (!rawGroup || typeof rawGroup !== 'object' || Array.isArray(rawGroup)) {
        continue;
      }

      const checkboxValues = this.readCheckboxValues(rawGroup, definition.checkboxes);
      const hasSelected = Object.values(checkboxValues).some((isChecked) => isChecked);
      if (!hasSelected) {
        continue;
      }

      result.push({
        key: definition.key,
        name: definition.name,
        checkboxDefinitions: definition.checkboxes.map((checkbox) => ({ ...checkbox })),
        checkboxValues,
        isDefault: this.isDefaultBilanTypeKey(definition.key),
      });
    }

    return result;
  }

  private readCheckboxDefinitions(value: unknown, fallback?: BilanTypeDefinition): BilanCheckboxDefinition[] {
    if (!Array.isArray(value)) {
      return fallback ? fallback.checkboxes.map((checkbox) => ({ ...checkbox })) : [];
    }

    const result: BilanCheckboxDefinition[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const row = entry as Record<string, unknown>;
      const key = this.readString(row['key']);
      const label = this.readString(row['label']) || key;
      if (!key || !label) {
        continue;
      }

      result.push({ key, label });
    }

    if (result.length > 0) {
      return result;
    }

    return fallback ? fallback.checkboxes.map((checkbox) => ({ ...checkbox })) : [];
  }

  private readCheckboxValues(
    value: unknown,
    checkboxDefinitions: BilanCheckboxDefinition[],
  ): Record<string, boolean> {
    const source = value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

    const result: Record<string, boolean> = {};
    for (const checkbox of checkboxDefinitions) {
      const raw = source[checkbox.key];
      result[checkbox.key] = raw === true;
    }

    return result;
  }

  private normalizeCheckboxValues(
    checkboxValues: Record<string, boolean>,
    checkboxDefinitions: BilanCheckboxDefinition[],
  ): Record<string, boolean> {
    const normalized: Record<string, boolean> = {};

    for (const definition of checkboxDefinitions) {
      normalized[definition.key] = checkboxValues[definition.key] === true;
    }

    return normalized;
  }

  private refreshAllBilanTypeOption(): void {
    const allBilanType = buildAllBilanType(this.bilanTypeOptions);
    const nextAllBilanType = cloneBilanTypeDefinition(allBilanType);

    if (this.bilanTypeOptions.some((item) => this.isAllBilanTypeKey(item.key))) {
      this.bilanTypeOptions = this.bilanTypeOptions.map((item) => (
        this.isAllBilanTypeKey(item.key)
          ? nextAllBilanType
          : item
      ));
    } else {
      this.bilanTypeOptions = [nextAllBilanType, ...this.bilanTypeOptions];
    }

    this.rows = this.rows.map((row) => {
      if (row.operationType !== 'Bilan Sanguin') {
        return row;
      }

      return {
        ...row,
        bilanTypes: this.syncBilanTypeCollection(row.bilanTypes, allBilanType),
      };
    });

    if (this.isAllBilanTypeKey(this.activeBilanTypeKey)) {
      const activeType = this.rows
        .find((row) => row.id === this.activeRowId && row.operationType === 'Bilan Sanguin')
        ?.bilanTypes
        .find((item) => this.isAllBilanTypeKey(item.key));
      const activeDefinitions = activeType?.checkboxDefinitions ?? allBilanType.checkboxes;

      this.activeBilanTypeLabel = allBilanType.name;
      this.popupCheckboxState = this.normalizeCheckboxValues(
        this.popupCheckboxState,
        activeDefinitions,
      );
    }
  }

  private syncBilanTypeCollection(
    bilanTypes: SelectedBilanType[],
    allBilanType = this.resolveAllBilanType(),
  ): SelectedBilanType[] {
    return bilanTypes.map((item) => (
      this.isAllBilanTypeKey(item.key)
        ? this.syncAllBilanTypeSelection(item, allBilanType)
        : item
    ));
  }

  private syncAllBilanTypeSelection(
    item: SelectedBilanType,
    allBilanType: BilanTypeDefinition,
  ): SelectedBilanType {
    const checkboxDefinitions = this.mergeCheckboxDefinitions(
      allBilanType.checkboxes,
      item.checkboxDefinitions,
    );

    return {
      ...item,
      name: allBilanType.name,
      checkboxDefinitions,
      checkboxValues: this.normalizeCheckboxValues(item.checkboxValues, checkboxDefinitions),
      isDefault: true,
    };
  }

  private mergeCheckboxDefinitions(
    preferred: BilanCheckboxDefinition[],
    fallback: BilanCheckboxDefinition[],
  ): BilanCheckboxDefinition[] {
    const result: BilanCheckboxDefinition[] = [];
    const seenKeys = new Set<string>();

    for (const definition of [...preferred, ...fallback]) {
      if (!definition.key || seenKeys.has(definition.key)) {
        continue;
      }

      seenKeys.add(definition.key);
      result.push({ ...definition });
    }

    return result;
  }

  private resolveAllBilanType(): BilanTypeDefinition {
    const fromOptions = this.bilanTypeOptions.find((item) => this.isAllBilanTypeKey(item.key));
    return fromOptions ? cloneBilanTypeDefinition(fromOptions) : buildAllBilanType(this.bilanTypeOptions);
  }

  private isAllBilanTypeKey(key: string): boolean {
    return key === ALL_BILAN_TYPE_KEY;
  }

  private isDefaultBilanTypeKey(key: string): boolean {
    return this.isAllBilanTypeKey(key)
      || CATEGORIZED_BILAN_TYPES.some((item) => item.key === key);
  }

  private ensureBilanTypeOption(definition: BilanTypeDefinition): void {
    const index = this.bilanTypeOptions.findIndex((item) => item.key === definition.key);
    if (index < 0) {
      this.bilanTypeOptions = [...this.bilanTypeOptions, cloneBilanTypeDefinition(definition)];
      return;
    }

    this.bilanTypeOptions = this.bilanTypeOptions.map((item, itemIndex) => (
      itemIndex === index
        ? cloneBilanTypeDefinition(definition)
        : item
    ));
  }

  private readTypeNames(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const result: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        const normalized = entry.trim();
        if (normalized && !result.includes(normalized)) {
          result.push(normalized);
        }
        continue;
      }

      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const row = entry as Record<string, unknown>;
      const name = this.readString(row['name']) || this.readString(row['label']);
      if (name && !result.includes(name)) {
        result.push(name);
      }
    }

    return result;
  }

  private readFirstTypeName(typesValue: unknown, fallbackTypeValue: unknown): string {
    const names = this.readTypeNames(typesValue);
    if (names.length > 0) {
      return names[0];
    }

    return this.readString(fallbackTypeValue);
  }

  private splitDateAndTime(value: string): { date: string; time: string } {
    const normalized = value.trim();
    if (!normalized) {
      return { date: '', time: '' };
    }

    const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/);
    if (directMatch) {
      return {
        date: directMatch[1] ?? '',
        time: directMatch[2] ?? '',
      };
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return { date: '', time: '' };
    }

    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const hh = String(parsed.getHours()).padStart(2, '0');
    const min = String(parsed.getMinutes()).padStart(2, '0');

    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}`,
    };
  }

  private combineDateAndTime(date: string, time: string): string {
    const normalizedDate = date.trim();
    const normalizedTime = time.trim();

    if (!normalizedDate) {
      return '';
    }

    if (!normalizedTime) {
      return normalizedDate;
    }

    return `${normalizedDate}T${normalizedTime}`;
  }

  private buildUniqueBilanTypeKey(name: string): string {
    const base = this.toKey(name) || `bilan_type_${this.bilanTypeOptions.length + 1}`;
    const existingKeys = new Set(this.bilanTypeOptions.map((item) => item.key));

    if (!existingKeys.has(base)) {
      return base;
    }

    let index = 2;
    let candidate = `${base}_${index}`;
    while (existingKeys.has(candidate)) {
      index += 1;
      candidate = `${base}_${index}`;
    }

    return candidate;
  }

  private buildUniqueCheckboxKey(label: string, existingKeys: Set<string>): string {
    const base = this.toKey(label) || `item_${existingKeys.size + 1}`;
    if (!existingKeys.has(base)) {
      return base;
    }

    let index = 2;
    let candidate = `${base}_${index}`;
    while (existingKeys.has(candidate)) {
      index += 1;
      candidate = `${base}_${index}`;
    }

    return candidate;
  }

  private toKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
