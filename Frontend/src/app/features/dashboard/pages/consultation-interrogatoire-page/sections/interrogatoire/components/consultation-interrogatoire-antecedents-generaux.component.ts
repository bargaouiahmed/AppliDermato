import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  NgMultiLabelTemplateDirective,
  NgNotFoundTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import {
  InterrogatoireAnomalyCatalogItem,
  UpdateInterrogatoireAnomalyRequest,
} from '../../../../../../../core/models/interrogatoire.models';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../../../../core/services/interrogatoire.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type AntecedentOption = {
  label: string;
  value: string;
  templateKey?: string | null;
  isCustom?: boolean;
};

type NamedValue = {
  name: string;
  date: string;
};

type AncienneteUnit = 'jours' | 'mois' | 'ans';

type CasParticulierKey =
  | 'consanguinite'
  | 'seroconversionpendantlagrossesse'
  | 'prematurite'
  | 'accouchementvoiebasse'
  | 'accouchementcesarienne'
  | 'faiblepoidsdelanaissance'
  | 'souffrancefoetaleaigue'
  | 'casderetinoblastornedanslafamille'
  | 'retardscolaire'
  | 'comportementdemalvoyance';

type CasParticulierTextField = 'type' | 'valeur';
type CasParticulierBoolField = 'voiebasse' | 'cesarienne';

type CasParticulierItem = {
  present: boolean;
  date: string;
  valeur: string;
  type: string;
  cesarienne: boolean;
  voiebasse: boolean;
};

type CasParticulierState = Record<CasParticulierKey, CasParticulierItem>;

type AntecedentFormState = {
  diagnosedSince: string;
  severity: '' | 'mild' | 'moderate' | 'severe';
  underTreatment: boolean;
  treatmentName: string;
  notes: string;

  description: string;
  valeurs: NamedValue[];

  diabeteType: string;
  diabeteTraitement: NamedValue[];
  diabeteAnciennete: string;
  diabeteAncienneteUnit: AncienneteUnit;
  diabeteDerniereHBAIC: string;
  diabeteMedecinTraitant: string;
  diabeteResultatHBAIC: string;

  htaType: string;
  htaTraitement: string;
  htaAnciennete: string;
  htaMedecinTraitant: string;

  date: string;
  type: string;

  casParticulier: CasParticulierState;
};

type StandardAntecedentKey =
  | 'grossesse-en-cours'
  | 'terrain-atopique'
  | 'diabete'
  | 'hta'
  | 'terrain-immunodepression'
  | 'maladie-dysimmunitaire'
  | 'maladie-neurologique'
  | 'notion-vaccination-recente'
  | 'notion-anesthesie-recente'
  | 'cas-particulier-nourrisson-enfant';

type StandardAntecedentFormKind =
  | 'grossesse'
  | 'list'
  | 'diabete'
  | 'hta'
  | 'date-type'
  | 'cas-particulier';

type StandardAntecedentDefinition = {
  key: StandardAntecedentKey;
  label: string;
  templateKey: string;
  i18nKey: string;
  formKind: StandardAntecedentFormKind;
  aliases?: string[];
  templateAliases?: string[];
};

const STANDARD_ANTECEDENTS: readonly StandardAntecedentDefinition[] = [
  {
    key: 'grossesse-en-cours',
    label: 'Grossesse en cours',
    templateKey: 'grossesse-en-cours',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.grossesseEnCours',
    aliases: ['Ongoing pregnancy'],
    templateAliases: ['grossesse'],
    formKind: 'grossesse',
  },
  {
    key: 'terrain-atopique',
    label: 'Terrain atopique',
    templateKey: 'terrain-atopique',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.terrainAtopique',
    aliases: ['Atopic background'],
    formKind: 'list',
  },
  {
    key: 'diabete',
    label: 'Diabete',
    templateKey: 'diabete',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.diabete',
    aliases: ['Diabete', 'Diabetes'],
    formKind: 'diabete',
  },
  {
    key: 'hta',
    label: 'HTA',
    templateKey: 'hta',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.hta',
    aliases: ['Arterial hypertension', 'Hypertension arterielle', 'Hypertension'],
    formKind: 'hta',
  },
  {
    key: 'terrain-immunodepression',
    label: 'Terrain d immunodepression',
    templateKey: 'terrain-immunodepression',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.terrainImmunodepression',
    aliases: ["Terrain d'immunodepression", 'Immunodepression background', 'Immunodepression'],
    formKind: 'list',
  },
  {
    key: 'maladie-dysimmunitaire',
    label: 'Maladie dysimmunitaire',
    templateKey: 'maladie-dysimmunitaire',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.maladieDysimmunitaire',
    aliases: ['Maladie dysimunitaire', 'Dysimmune disease', 'Autoimmune disease'],
    formKind: 'list',
  },
  {
    key: 'maladie-neurologique',
    label: 'Maladie neurologique',
    templateKey: 'maladie-neurologique',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.maladieNeurologique',
    aliases: ['Neurological disease', 'Neurologic disease'],
    formKind: 'list',
  },
  {
    key: 'notion-vaccination-recente',
    label: 'Notion de vaccination recente',
    templateKey: 'notion-vaccination-recente',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.notionVaccinationRecente',
    aliases: ['Notion de vaccination recente', 'Recent vaccination history'],
    formKind: 'date-type',
  },
  {
    key: 'notion-anesthesie-recente',
    label: 'Notion d anesthesie recente',
    templateKey: 'notion-anesthesie-recente',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.notionAnesthesieRecente',
    aliases: ["Notion d'anesthesie recente", 'Recent anesthesia history', 'Recent anaesthesia history'],
    formKind: 'date-type',
  },
  {
    key: 'cas-particulier-nourrisson-enfant',
    label: 'Cas particulier nourrisson enfant',
    templateKey: 'cas-particulier-nourrisson-enfant',
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.casParticulierNourrissonEnfant',
    aliases: ['Special infant/child case', 'Special infant child case'],
    formKind: 'cas-particulier',
  },
];

const CAS_PARTICULIER_OPTIONS: readonly { key: CasParticulierKey; i18nKey: string }[] = [
  {
    key: 'consanguinite',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.consanguinite',
  },
  {
    key: 'seroconversionpendantlagrossesse',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.seroconversionGrossesse',
  },
  {
    key: 'prematurite',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.prematurite',
  },
  {
    key: 'accouchementvoiebasse',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.accouchementVoieBasse',
  },
  {
    key: 'accouchementcesarienne',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.accouchementCesarienne',
  },
  {
    key: 'faiblepoidsdelanaissance',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.faiblePoidsNaissance',
  },
  {
    key: 'souffrancefoetaleaigue',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.souffranceFoetaleAigue',
  },
  {
    key: 'casderetinoblastornedanslafamille',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.retinoblastomeFamille',
  },
  {
    key: 'retardscolaire',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.retardScolaire',
  },
  {
    key: 'comportementdemalvoyance',
    i18nKey: 'consultation.page.interrogatoire.antecedents.casParticulier.options.comportementMalvoyance',
  },
];

const LIST_SUGGESTIONS: Partial<Record<StandardAntecedentKey, readonly string[]>> = {
  'terrain-atopique': ['Acariens', 'Humidité', "Poils d'animaux"],
  'terrain-immunodepression': ['Chimiothérapie', 'VIH', 'Tumeur'],
  'maladie-dysimmunitaire': ['SEP', 'SPA', 'Lupus'],
  'maladie-neurologique': ['AVC', 'NMO', 'SUSAC'],
};

const DIABETE_TREATEMENT_SUGGESTIONS: readonly string[] = ['Insuline', 'Comprime'];
const DIABETE_TYPES: readonly string[] = ['Type 1', 'Type 2'];
const REMOVED_ANTECEDENT_TEMPLATE_KEY = 'traitement-general-en-cours';
const REMOVED_ANTECEDENT_LABEL = 'Traitement general en cours';
const MEDICAL_ANTECEDENT_TEMPLATE_KEY_PREFIX = 'medical-antecedent-';

const KNOWN_ANTECEDENT_I18N_FALLBACKS: ReadonlyArray<{ aliases: readonly string[]; i18nKey: string }> = [
  {
    aliases: ['Asthme', 'Asthma'],
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.asthma',
  },
  {
    aliases: ['Allergie medicamenteuse', 'Allergie médicamenteuse', 'Medication allergy', 'Drug allergy'],
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.allergies',
  },
  {
    aliases: ['Hypothyroidie', 'Hypothyroidism', 'Hyperthyroidie', 'Hyperthyroidism'],
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.thyroidDisorder',
  },
  {
    aliases: ['Maladie cardiaque', 'Cardiac disease', 'Heart disease'],
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.heartDisease',
  },
  {
    aliases: ['Ulcere gastrique', 'Gastric ulcer', 'Peptic ulcer'],
    i18nKey: 'consultation.page.interrogatoire.antecedents.items.gastricUlcer',
  },
];

@Component({
  selector: 'app-consultation-interrogatoire-antecedents-generaux',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgMultiLabelTemplateDirective,
    NgNotFoundTemplateDirective,
    TranslatePipe,
  ],
  templateUrl: './consultation-interrogatoire-antecedents-generaux.component.html',
  styleUrl: './consultation-interrogatoire-antecedents-generaux.component.css',
})
export class ConsultationInterrogatoireAntecedentsGenerauxComponent {
  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Output() anomaliesChange = new EventEmitter<UpdateInterrogatoireAnomalyRequest[]>();

  protected antecedentsGenerauxExpanded = false;
  protected antecedentsDropdownOpen = false;
  protected selectedAntecedentsGenerauxList: string[] = [];
  protected activeAntecedentForm: string | null = null;
  protected antecedentForms: Record<string, AntecedentFormState> = {};
  protected combinedAntGenerauxList: AntecedentOption[] = [];
  protected antecedentsGenerauxList: AntecedentOption[] = STANDARD_ANTECEDENTS.map((item) => ({
    label: item.label,
    value: item.label,
    templateKey: item.templateKey,
    isCustom: false,
  }));
  protected activeNamedValueInput = '';
  protected activeNamedValueModel: string | null = null;
  protected activeListSuggestions: string[] = [];
  protected activeDiabeteTraitementInput = '';
  protected activeDiabeteTraitementModel: string | null = null;
  protected activeCasParticulierToAdd: CasParticulierKey | '' = '';
  protected readonly diabeteTypes = DIABETE_TYPES;
  protected readonly diabeteTraitementSuggestions = DIABETE_TREATEMENT_SUGGESTIONS;
  protected readonly casParticulierOptions = CAS_PARTICULIER_OPTIONS;
  @ViewChild('selAnteGeneraux') private antecedentsSelect?: NgSelectComponent;

  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultTemplateKeys = new Set(
    STANDARD_ANTECEDENTS
      .flatMap((item) => [item.templateKey, ...(item.templateAliases ?? [])])
      .map((item) => this.normalizeTemplateKey(item))
      .filter((item) => !!item),
  );

  private readonly defaultAntecedentLabelKeys = new Set(
    STANDARD_ANTECEDENTS
      .flatMap((item) => [item.label, ...(item.aliases ?? [])])
      .map((item) => this.normalizeValue(item))
      .filter((item) => !!item),
  );

  private readonly customAntecedentKeys = new Set<string>();
  private isHydratingFromInput = false;

  protected get isRtl(): boolean {
    return this.i18n.dir() === 'rtl';
  }

  protected get dir(): 'rtl' | 'ltr' {
    return this.isRtl ? 'rtl' : 'ltr';
  }

  protected get isSectionCollapsible(): boolean {
    return this.selectedAntecedentsGenerauxList.length === 0;
  }

  protected get activeFormState(): AntecedentFormState | null {
    if (!this.activeAntecedentForm) {
      return null;
    }

    const key = this.findAntecedentFormKey(this.activeAntecedentForm);
    if (!key) {
      return null;
    }

    return this.antecedentForms[key] ?? null;
  }

  protected get activeStandardDefinition(): StandardAntecedentDefinition | null {
    if (!this.activeAntecedentForm) {
      return null;
    }

    const matchingOption = this.antecedentsGenerauxList.find(
      (item) => this.normalizeValue(item.value) === this.normalizeValue(this.activeAntecedentForm ?? ''),
    );

    return (
      this.findStandardDefinitionByTemplateKey(matchingOption?.templateKey)
      ?? this.findStandardDefinitionByLabel(this.activeAntecedentForm)
    );
  }

  private setActiveAntecedentForm(value: string | null): void {
    this.activeAntecedentForm = value;
    this.refreshActiveListSuggestions();
  }

  private refreshActiveListSuggestions(): void {
    const definition = this.activeStandardDefinition;
    this.activeListSuggestions = definition
      ? [...(LIST_SUGGESTIONS[definition.key] ?? [])]
      : [];
  }

  private getOrCreateActiveFormState(): AntecedentFormState | null {
    if (!this.activeAntecedentForm) {
      return null;
    }

    this.ensureAntecedentForm(this.activeAntecedentForm);
    return this.activeFormState;
  }

  protected get activeAntecedentIsCustom(): boolean {
    if (!this.activeAntecedentForm) {
      return false;
    }

    return this.isCustomAntecedent(this.activeAntecedentForm);
  }

  protected isCustomOption(item: unknown): boolean {
    const option = this.toAntecedentOptionCandidate(item);

    if (option) {
      return this.resolveOptionIsCustom(option);
    }

    const value = this.extractValue(item);
    return !!value && this.isCustomAntecedent(value);
  }

  ngOnInit(): void {
    this.refreshCombinedOptions();

    this.interrogatoireService
      .getAnomalyCatalog('medical')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.mergeCatalogItems(items ?? []);
        },
        error: () => {
          // Keep defaults if catalog fetch fails.
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anomalies']) {
      this.hydrateFromAnomalies(this.anomalies ?? []);
    }
  }

  protected displayAntecedentLabel(value: string): string {
    const standardDefinition = this.findStandardDefinitionByLabel(value);
    if (standardDefinition) {
      return this.i18n.t(standardDefinition.i18nKey);
    }

    const fallback = this.translateKnownAntecedentLabel(value);
    return fallback ?? value;
  }

  protected displayOptionLabel(item: AntecedentOption): string {
    const standardDefinition =
      this.findStandardDefinitionByTemplateKey(item.templateKey)
      ?? this.findStandardDefinitionByLabel(item.label);

    if (standardDefinition) {
      return this.i18n.t(standardDefinition.i18nKey);
    }

    const fallback = this.translateKnownAntecedentLabel(item.value || item.label);
    return fallback ?? item.label;
  }

  private translateKnownAntecedentLabel(value: string | null | undefined): string | null {
    const i18nKey = this.findKnownAntecedentTranslationKey(value);
    if (!i18nKey) {
      return null;
    }

    const translated = this.i18n.t(i18nKey);
    return translated !== i18nKey ? translated : null;
  }

  private findKnownAntecedentTranslationKey(value: string | null | undefined): string | null {
    const normalized = this.normalizeValue(value ?? '');
    if (!normalized) {
      return null;
    }

    for (const entry of KNOWN_ANTECEDENT_I18N_FALLBACKS) {
      for (const alias of entry.aliases) {
        if (this.normalizeValue(alias) === normalized) {
          return entry.i18nKey;
        }
      }
    }

    return null;
  }

  protected addInputAntecedentGeneraux(event: unknown): string {
    const inputValue = this.extractValue(event);
    if (!inputValue) {
      return '';
    }

    if (this.isRemovedAntecedent(inputValue)) {
      return '';
    }

    const standardDefinition = this.findStandardDefinitionByLabel(inputValue);
    const value = standardDefinition?.label ?? inputValue;

    const normalized = this.normalizeValue(value);
    if (
      !this.selectedAntecedentsGenerauxList.some(
        (item) => this.normalizeValue(item) === normalized,
      )
    ) {
      this.selectedAntecedentsGenerauxList = [
        ...this.selectedAntecedentsGenerauxList,
        value,
      ];
    }

    this.ensureAntecedentForm(value);
    this.markCustomAntecedent(value, !standardDefinition);
    this.activeNamedValueInput = '';
    this.activeNamedValueModel = null;
    this.activeDiabeteTraitementInput = '';
    this.activeDiabeteTraitementModel = null;
    this.activeCasParticulierToAdd = '';

    if (
      !this.antecedentsGenerauxList.some(
        (item) => this.normalizeValue(item.value) === normalized,
      )
    ) {
      this.antecedentsGenerauxList = [
        ...this.antecedentsGenerauxList,
        {
          label: value,
          value,
          templateKey: standardDefinition?.templateKey ?? null,
          isCustom: !standardDefinition,
        },
      ];
    }

    this.refreshCombinedOptions();

    this.emitAnomaliesChange();
    if (!standardDefinition) {
      this.interrogatoireService
        .addCustomAnomalyToCatalog('medical', value, this.buildCustomTemplateKey(value))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }

    return value;
  }

  protected onAntecedentsModelChange(values: unknown[] | null): void {
    const incoming = Array.isArray(values) ? values : [];
    const previousSelected = [...this.selectedAntecedentsGenerauxList];
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const rawValue of incoming) {
      const value = this.extractValue(rawValue);
      if (!value) {
        continue;
      }

      const matchingOption = this.antecedentsGenerauxList.find(
        (item) => this.normalizeValue(item.value) === this.normalizeValue(value),
      );

      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(matchingOption?.templateKey)
        ?? this.findStandardDefinitionByLabel(value);
      const canonicalValue = standardDefinition?.label ?? value;

      if (this.isRemovedAntecedent(canonicalValue, standardDefinition?.templateKey ?? matchingOption?.templateKey)) {
        continue;
      }

      const normalized = this.normalizeValue(canonicalValue);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      unique.push(canonicalValue);
      this.ensureAntecedentForm(canonicalValue);

      this.markCustomAntecedent(
        canonicalValue,
        matchingOption ? this.resolveOptionIsCustom(matchingOption) : !standardDefinition,
      );
    }

    if (this.areSameSelection(previousSelected, unique)) {
      return;
    }

    this.selectedAntecedentsGenerauxList = unique;

    if (!this.isSectionCollapsible) {
      this.antecedentsGenerauxExpanded = true;
    } else if (!this.antecedentsDropdownOpen) {
      this.antecedentsGenerauxExpanded = false;
    }

    const selectedNormalized = new Set(unique.map((item) => this.normalizeValue(item)));
    for (const key of Object.keys(this.antecedentForms)) {
      if (!selectedNormalized.has(this.normalizeValue(key))) {
        delete this.antecedentForms[key];
      }
    }

    if (
      this.activeAntecedentForm &&
      !selectedNormalized.has(this.normalizeValue(this.activeAntecedentForm))
    ) {
      this.setActiveAntecedentForm(null);
    }

    this.emitAnomaliesChange();
    const selectionChanged = !this.areSameSelection(previousSelected, unique);
    if (selectionChanged) {
      this.closeAntecedentsSelectSoon();
    }
  }

  private areSameSelection(current: string[], next: string[]): boolean {
    if (current.length !== next.length) {
      return false;
    }

    const currentSet = new Set(current.map((item) => this.normalizeValue(item)));
    for (const item of next) {
      if (!currentSet.has(this.normalizeValue(item))) {
        return false;
      }
    }

    return true;
  }

  protected toggleAntecedentsGeneraux(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isSectionCollapsible) {
      this.antecedentsGenerauxExpanded = true;
      return;
    }

    this.antecedentsGenerauxExpanded = !this.antecedentsGenerauxExpanded;
  }

  protected onAntecedentsWrapperEnter(): void {
    if (this.isSectionCollapsible && !this.antecedentsDropdownOpen) {
      this.antecedentsGenerauxExpanded = true;
    }
  }

  protected onAntecedentsWrapperLeave(): void {
    if (this.isSectionCollapsible && !this.antecedentsDropdownOpen) {
      this.antecedentsGenerauxExpanded = false;
    }
  }

  protected onAntecedentsSelectOpen(): void {
    this.antecedentsDropdownOpen = true;
    this.antecedentsGenerauxExpanded = true;
  }

  protected onAntecedentsSelectClose(): void {
    this.antecedentsDropdownOpen = false;
    if (this.isSectionCollapsible) {
      this.antecedentsGenerauxExpanded = false;
    } else {
      this.antecedentsGenerauxExpanded = true;
    }
  }

  private closeAntecedentsSelectSoon(): void {
    setTimeout(() => {
      this.antecedentsSelect?.close();
    });
  }

  protected removeAntecedentGeneral(value: string): void {
    const normalized = this.normalizeValue(value);
    this.selectedAntecedentsGenerauxList = this.selectedAntecedentsGenerauxList.filter(
      (item) => this.normalizeValue(item) !== normalized,
    );

    const key = this.findAntecedentFormKey(value);
    if (key) {
      delete this.antecedentForms[key];
    }

    if (this.activeAntecedentForm && this.normalizeValue(this.activeAntecedentForm) === normalized) {
      this.setActiveAntecedentForm(null);
      this.activeNamedValueInput = '';
      this.activeNamedValueModel = null;
      this.activeDiabeteTraitementInput = '';
      this.activeDiabeteTraitementModel = null;
      this.activeCasParticulierToAdd = '';
    }

    this.customAntecedentKeys.delete(normalized);

    if (this.isSectionCollapsible && !this.antecedentsDropdownOpen) {
      this.antecedentsGenerauxExpanded = false;
    }

    this.refreshCombinedOptions();

    this.emitAnomaliesChange();
  }

  protected deleteAntecedentGeneral(item: unknown, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const option = this.toAntecedentOptionCandidate(item);
    const value = option?.value ?? this.extractValue(item);
    if (!value) {
      return;
    }

    const isCustom = option ? this.resolveOptionIsCustom(option) : this.isCustomAntecedent(value);
    if (!isCustom) {
      return;
    }

    const normalized = this.normalizeValue(value);

    this.interrogatoireService
      .hideCustomAnomalyFromCatalog('medical', value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.antecedentsGenerauxList = this.antecedentsGenerauxList.filter(
            (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
          );
          this.refreshCombinedOptions();
        },
        error: () => {
          // Keep local state unchanged if backend hide fails.
        },
      });

    this.antecedentsGenerauxList = this.antecedentsGenerauxList.filter(
      (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
    );
    this.refreshCombinedOptions();
  }

  protected toggleAntecedentForm(value: string): void {
    this.ensureAntecedentForm(value);
    this.setActiveAntecedentForm(this.activeAntecedentForm === value ? null : value);
    this.activeNamedValueInput = '';
    this.activeNamedValueModel = null;
    this.activeDiabeteTraitementInput = '';
    this.activeDiabeteTraitementModel = null;
    this.activeCasParticulierToAdd = '';
  }

  protected getAntecedentDate(value: string): string {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    return this.antecedentForms[key]?.diagnosedSince ?? '';
  }

  protected addActiveNamedValue(valueFromSuggestion?: string): void {
    const form = this.getOrCreateActiveFormState();
    if (!form) {
      return;
    }

    const value = (valueFromSuggestion ?? this.activeNamedValueInput).trim();
    if (!value) {
      return;
    }

    const normalized = this.normalizeValue(value);
    if (form.valeurs.some((item) => this.normalizeValue(item.name) === normalized)) {
      this.activeNamedValueInput = '';
      return;
    }

    form.valeurs = [
      ...form.valeurs,
      {
        name: value,
        date: this.formatTodayDateDisplay(),
      },
    ];

    this.activeNamedValueInput = '';
    this.activeNamedValueModel = value;
    this.emitAnomaliesChange();
  }

  protected addActiveNamedValueTag(term: string): string {
    this.addActiveNamedValue(term);
    return term;
  }

  protected onActiveNamedValueChange(value: unknown): void {
    const resolved = this.extractValue(value);
    if (!resolved) {
      return;
    }

    this.addActiveNamedValue(resolved);
    this.activeNamedValueModel = resolved;
  }

  protected onActiveNamedValueEnter(event: Event): void {
    event.preventDefault();
    this.addActiveNamedValue();
  }

  protected removeActiveNamedValue(name: string): void {
    const form = this.getOrCreateActiveFormState();
    if (!form) {
      return;
    }

    const normalized = this.normalizeValue(name);
    form.valeurs = form.valeurs.filter((item) => this.normalizeValue(item.name) !== normalized);
    this.emitAnomaliesChange();
  }

  protected addActiveDiabeteTraitement(valueFromSuggestion?: string): void {
    const form = this.getOrCreateActiveFormState();
    if (!form) {
      return;
    }

    const value = (valueFromSuggestion ?? this.activeDiabeteTraitementInput).trim();
    if (!value) {
      return;
    }

    const normalized = this.normalizeValue(value);
    if (form.diabeteTraitement.some((item) => this.normalizeValue(item.name) === normalized)) {
      this.activeDiabeteTraitementInput = '';
      return;
    }

    form.diabeteTraitement = [
      ...form.diabeteTraitement,
      {
        name: value,
        date: this.formatTodayDateDisplay(),
      },
    ];

    this.activeDiabeteTraitementInput = '';
    this.activeDiabeteTraitementModel = null;
    this.emitAnomaliesChange();
  }

  protected addActiveDiabeteTraitementTag(term: string): string {
    this.addActiveDiabeteTraitement(term);
    return term;
  }

  protected onDiabeteTraitementChange(value: unknown): void {
    const resolved = this.extractValue(value);
    if (!resolved) {
      this.activeDiabeteTraitementModel = null;
      return;
    }

    this.addActiveDiabeteTraitement(resolved);
    this.activeDiabeteTraitementModel = null;
  }

  protected onDiabeteTraitementEnter(event: Event): void {
    event.preventDefault();
    this.addActiveDiabeteTraitement();
  }

  protected removeActiveDiabeteTraitement(name: string): void {
    const form = this.getOrCreateActiveFormState();
    if (!form) {
      return;
    }

    const normalized = this.normalizeValue(name);
    form.diabeteTraitement = form.diabeteTraitement.filter((item) => this.normalizeValue(item.name) !== normalized);
    this.emitAnomaliesChange();
  }

  protected setDiabeteAncienneteUnit(unit: AncienneteUnit): void {
    const form = this.getOrCreateActiveFormState();
    if (!form) {
      return;
    }

    form.diabeteAncienneteUnit = unit;
    this.emitAnomaliesChange();
  }

  protected addCasParticulierFromSelection(selection: string): void {
    const form = this.getOrCreateActiveFormState();
    if (!form) {
      return;
    }

    const key = this.parseCasParticulierKey(selection);
    if (!key) {
      this.activeCasParticulierToAdd = '';
      return;
    }

    const current = form.casParticulier[key];
    current.present = true;
    if (!current.date) {
      current.date = this.formatTodayDateDisplay();
    }

    this.activeCasParticulierToAdd = '';
    this.emitAnomaliesChange();
  }

  protected getCasParticulierPresent(form: AntecedentFormState, key: CasParticulierKey): boolean {
    return form.casParticulier[key]?.present ?? false;
  }

  protected setCasParticulierPresent(
    form: AntecedentFormState,
    key: CasParticulierKey,
    present: boolean,
  ): void {
    if (present) {
      form.casParticulier[key].present = true;
      if (!form.casParticulier[key].date) {
        form.casParticulier[key].date = this.formatTodayDateDisplay();
      }
    } else {
      form.casParticulier[key] = this.createDefaultCasParticulierItem();
    }

    this.emitAnomaliesChange();
  }

  protected getCasParticulierText(
    form: AntecedentFormState,
    key: CasParticulierKey,
    field: CasParticulierTextField,
  ): string {
    return form.casParticulier[key]?.[field] ?? '';
  }

  protected updateCasParticulierText(
    form: AntecedentFormState,
    key: CasParticulierKey,
    field: CasParticulierTextField,
    value: string,
  ): void {
    form.casParticulier[key][field] = value;
    this.emitAnomaliesChange();
  }

  protected getCasParticulierFlag(
    form: AntecedentFormState,
    key: CasParticulierKey,
    field: CasParticulierBoolField,
  ): boolean {
    return form.casParticulier[key]?.[field] ?? false;
  }

  protected updateCasParticulierFlag(
    form: AntecedentFormState,
    key: CasParticulierKey,
    field: CasParticulierBoolField,
    value: boolean,
  ): void {
    form.casParticulier[key][field] = value;
    this.emitAnomaliesChange();
  }

  protected updateAntecedentDiagnosedSince(value: string, diagnosedSince: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].diagnosedSince = diagnosedSince;
    this.emitAnomaliesChange();
  }

  protected updateAntecedentSeverity(value: string, severity: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    const safeSeverity: AntecedentFormState['severity'] =
      severity === 'mild' || severity === 'moderate' || severity === 'severe'
        ? severity
        : '';
    this.antecedentForms[key].severity = safeSeverity;
    this.emitAnomaliesChange();
  }

  protected updateAntecedentUnderTreatment(value: string, underTreatment: boolean): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].underTreatment = underTreatment;
    if (!underTreatment) {
      this.antecedentForms[key].treatmentName = '';
    }
    this.emitAnomaliesChange();
  }

  protected updateAntecedentTreatmentName(value: string, treatmentName: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].treatmentName = treatmentName;
    this.emitAnomaliesChange();
  }

  protected updateAntecedentNotes(value: string, notes: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].notes = notes;
    this.emitAnomaliesChange();
  }

  protected updateAntecedentCustomDescription(value: string, description: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].description = description;
    this.antecedentForms[key].notes = description;
    this.emitAnomaliesChange();
  }

  protected getAntecedentCustomDescription(value: string): string {
    const key = this.findAntecedentFormKey(value);
    if (!key) {
      return '';
    }

    return this.antecedentForms[key]?.description ?? this.antecedentForms[key]?.notes ?? '';
  }

  private hydrateFromAnomalies(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.isHydratingFromInput = true;
    this.customAntecedentKeys.clear();

    const medicalAnomalies = [...anomalies]
      .filter((item) => item.section === 'medical')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const selected: string[] = [];
    const selectedNormalized = new Set<string>();
    const forms: Record<string, AntecedentFormState> = {};

    for (const anomaly of medicalAnomalies) {
      if (this.isRemovedAntecedent('', anomaly.templateKey)) {
        continue;
      }

      const payload = (anomaly.payload ?? {}) as Record<string, unknown>;
      const standardByTemplate = this.findStandardDefinitionByTemplateKey(anomaly.templateKey);
      const payloadLabel = this.pickFirstString(payload['name'], payload['label']);
      const standardByLabel = this.findStandardDefinitionByLabel(payloadLabel);
      const standardDefinition = standardByTemplate ?? standardByLabel;

      const label = this.canonicalizeStandardLabel(
        this.pickFirstString(payload['name'], payload['label'], standardDefinition?.label, anomaly.templateKey),
        anomaly.templateKey,
      );

      if (!label) {
        continue;
      }

      if (this.isRemovedAntecedent(label, standardDefinition?.templateKey ?? anomaly.templateKey)) {
        continue;
      }

      const normalizedLabel = this.normalizeValue(label);
      if (selectedNormalized.has(normalizedLabel)) {
        continue;
      }

      selectedNormalized.add(normalizedLabel);

      const form = this.createEmptyFormState();
      form.diagnosedSince = this.toDisplayDate(
        this.pickFirstString(payload['diagnosedSince'], payload['dateCreation'], payload['date']),
        this.formatTodayDateDisplay(),
      );
      form.date = this.toInputDate(this.pickFirstString(payload['date']), this.formatTodayInputDate());
      form.description = this.pickFirstString(payload['description'], payload['notes']);
      form.notes = this.pickFirstString(payload['notes'], payload['description']);
      form.treatmentName = this.pickFirstString(payload['treatmentName']);
      form.underTreatment = this.parseBoolean(payload['underTreatment']);
      form.severity = this.parseSeverity(payload['severity']);

      if (standardDefinition) {
        this.populateStandardForm(form, standardDefinition, payload);
      }

      selected.push(label);
      const formKey = this.normalizeFormKey(label);
      forms[formKey] = {
        ...form,
        severity: this.parseSeverity(payload['severity']),
        underTreatment: this.parseBoolean(payload['underTreatment']),
        treatmentName: this.pickFirstString(payload['treatmentName']) || form.treatmentName,
        notes: this.pickFirstString(payload['notes'], payload['description']) || form.notes,
      };

      const isCustom = anomaly.isCustom || !standardDefinition || this.resolveOptionIsCustom({
        label,
        value: label,
        templateKey: standardDefinition?.templateKey ?? anomaly.templateKey,
        isCustom: anomaly.isCustom,
      });

      this.markCustomAntecedent(label, isCustom);

      if (
        !this.antecedentsGenerauxList.some(
          (item) => this.normalizeValue(item.value) === normalizedLabel,
        )
      ) {
        this.antecedentsGenerauxList = [
          ...this.antecedentsGenerauxList,
          {
            label,
            value: label,
            templateKey: standardDefinition?.templateKey ?? anomaly.templateKey,
            isCustom,
          },
        ];
      }
    }

    this.selectedAntecedentsGenerauxList = selected;
    this.antecedentForms = forms;
    this.refreshCombinedOptions();

    if (!this.isSectionCollapsible) {
      this.antecedentsGenerauxExpanded = true;
    } else if (!this.antecedentsDropdownOpen) {
      this.antecedentsGenerauxExpanded = false;
    }

    if (
      this.activeAntecedentForm &&
      !selected.some((value) => this.normalizeValue(value) === this.normalizeValue(this.activeAntecedentForm ?? ''))
    ) {
      this.setActiveAntecedentForm(null);
    }

    this.refreshActiveListSuggestions();

    this.isHydratingFromInput = false;
  }

  protected emitAnomaliesChange(): void {
    if (this.isHydratingFromInput) {
      return;
    }

    const anomalies: UpdateInterrogatoireAnomalyRequest[] = this.selectedAntecedentsGenerauxList.map(
      (value, sortOrder) => {
        const normalized = this.normalizeValue(value);
        const option = this.antecedentsGenerauxList.find(
          (item) => this.normalizeValue(item.value) === normalized,
        );

        const standardDefinition =
          this.findStandardDefinitionByTemplateKey(option?.templateKey)
          ?? this.findStandardDefinitionByLabel(value);
        const isCustom = option ? this.resolveOptionIsCustom(option) : !standardDefinition;

        const form = this.antecedentForms[this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value)] ?? {
          ...this.createEmptyFormState(),
          diagnosedSince: this.formatTodayDateDisplay(),
        };

        const payload = isCustom || !standardDefinition
          ? {
              name: value,
              date: form.diagnosedSince,
              description: form.description || form.notes,
              notes: form.notes,
            }
          : this.buildStandardPayload(standardDefinition, value, form);

        return {
          section: 'medical',
          isCustom,
          templateKey: standardDefinition?.templateKey ?? option?.templateKey ?? this.buildCustomTemplateKey(value),
          sortOrder,
          payload,
        };
      },
    );

    this.anomaliesChange.emit(anomalies);
  }

  private buildStandardPayload(
    definition: StandardAntecedentDefinition,
    label: string,
    form: AntecedentFormState,
  ): Record<string, unknown> {
    switch (definition.key) {
      case 'grossesse-en-cours':
        return {
          name: label,
          present: true,
          date: form.diagnosedSince,
          description: form.description,
          notes: form.notes,
        };

      case 'terrain-atopique':
      case 'terrain-immunodepression':
      case 'maladie-dysimmunitaire':
      case 'maladie-neurologique': {
        const valeurs = this.toNamedValuePayload(form.valeurs);
        return {
          name: label,
          present: true,
          date: form.diagnosedSince,
          valeurs,
          description: valeurs.map((item) => item.name).join(', '),
        };
      }

      case 'diabete': {
        const traitement = this.toNamedValuePayload(form.diabeteTraitement);
        return {
          name: label,
          present: true,
          date: form.diagnosedSince,
          type: form.diabeteType,
          traitement,
          anciennete: form.diabeteAnciennete,
          ancienneteUnit: form.diabeteAncienneteUnit,
          derniereHBAIC: form.diabeteDerniereHBAIC,
          medecinTraitant: form.diabeteMedecinTraitant,
          resultatHBAIC: form.diabeteResultatHBAIC,
          description: form.notes,
          notes: form.notes,
        };
      }

      case 'hta':
        return {
          name: label,
          present: true,
          date: form.diagnosedSince,
          type: form.htaType,
          traitement: form.htaTraitement,
          anciennete: form.htaAnciennete,
          medecinTraitant: form.htaMedecinTraitant,
          description: form.notes,
          notes: form.notes,
        };

      case 'notion-vaccination-recente':
      case 'notion-anesthesie-recente':
        return {
          name: label,
          present: true,
          dateCreation: form.diagnosedSince,
          date: form.date,
          type: form.type,
          description: form.type,
        };

      case 'cas-particulier-nourrisson-enfant':
        return {
          name: label,
          present: true,
          date: form.diagnosedSince,
          consanguinite: this.toCasParticulierPayloadItem(form.casParticulier.consanguinite),
          seroconversionpendantlagrossesse: this.toCasParticulierPayloadItem(
            form.casParticulier.seroconversionpendantlagrossesse,
          ),
          prematurite: this.toCasParticulierPayloadItem(form.casParticulier.prematurite),
          accouchementvoiebasse: this.toCasParticulierPayloadItem(form.casParticulier.accouchementvoiebasse),
          accouchementcesarienne: this.toCasParticulierPayloadItem(form.casParticulier.accouchementcesarienne),
          faiblepoidsdelanaissance: this.toCasParticulierPayloadItem(
            form.casParticulier.faiblepoidsdelanaissance,
            true,
          ),
          souffrancefoetaleaigue: this.toCasParticulierPayloadItem(
            form.casParticulier.souffrancefoetaleaigue,
            true,
          ),
          casderetinoblastornedanslafamille: this.toCasParticulierPayloadItem(
            form.casParticulier.casderetinoblastornedanslafamille,
          ),
          retardscolaire: this.toCasParticulierPayloadItem(form.casParticulier.retardscolaire),
          comportementdemalvoyance: this.toCasParticulierPayloadItem(
            form.casParticulier.comportementdemalvoyance,
          ),
        };

      default:
        return {
          name: label,
          date: form.diagnosedSince,
          description: form.description || form.notes,
          notes: form.notes,
        };
    }
  }

  private toNamedValuePayload(values: NamedValue[]): Array<{ name: string; date: string }> {
    return values.map((item) => ({
      name: item.name,
      date: item.date,
    }));
  }

  private toCasParticulierPayloadItem(item: CasParticulierItem, numericValue = false): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      present: item.present,
      date: item.date,
      type: item.type,
      voiebasse: item.voiebasse,
      cesarienne: item.cesarienne,
    };

    if (item.valeur) {
      payload['valeur'] = numericValue ? this.toNumberOrZero(item.valeur) : item.valeur;
    }

    return payload;
  }

  private toNumberOrZero(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private pickFirstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private isCustomAntecedent(value: string): boolean {
    const normalized = this.normalizeValue(value);
    if (this.customAntecedentKeys.has(normalized)) {
      return true;
    }

    return this.antecedentsGenerauxList.some(
      (item) => this.normalizeValue(item.value) === normalized && this.resolveOptionIsCustom(item),
    );
  }

  private markCustomAntecedent(value: string, isCustom: boolean): void {
    const normalized = this.normalizeValue(value);
    if (!normalized) {
      return;
    }

    if (isCustom) {
      this.customAntecedentKeys.add(normalized);
      return;
    }

    this.customAntecedentKeys.delete(normalized);
  }

  private populateStandardForm(
    form: AntecedentFormState,
    definition: StandardAntecedentDefinition,
    payload: Record<string, unknown>,
  ): void {
    switch (definition.key) {
      case 'grossesse-en-cours':
        form.description = this.pickFirstString(payload['description'], payload['notes']);
        break;

      case 'terrain-atopique':
      case 'terrain-immunodepression':
      case 'maladie-dysimmunitaire':
      case 'maladie-neurologique':
        form.valeurs = this.parseNamedValues(
          payload['valeurs'],
          this.pickFirstString(payload['description'], payload['notes']),
        );
        break;

      case 'diabete': {
        form.diabeteType = this.pickFirstString(payload['type'], payload['diabeteType']);
        form.diabeteTraitement = this.parseNamedValues(
          payload['traitement'],
          this.pickFirstString(payload['diabeteTraitement']),
        );
        form.diabeteAnciennete = this.pickFirstString(payload['anciennete'], payload['diabeteAnciennete']);
        form.diabeteDerniereHBAIC = this.pickFirstString(payload['derniereHBAIC']);
        form.diabeteMedecinTraitant = this.pickFirstString(payload['medecinTraitant']);
        form.diabeteResultatHBAIC = this.pickFirstString(payload['resultatHBAIC']);

        const unit = this.pickFirstString(payload['ancienneteUnit']);
        if (unit === 'jours' || unit === 'mois' || unit === 'ans') {
          form.diabeteAncienneteUnit = unit;
        }
        break;
      }

      case 'hta':
        form.htaType = this.pickFirstString(payload['type']);
        form.htaTraitement = this.pickFirstString(payload['traitement']);
        form.htaAnciennete = this.pickFirstString(payload['anciennete']);
        form.htaMedecinTraitant = this.pickFirstString(payload['medecinTraitant']);
        break;

      case 'notion-vaccination-recente':
      case 'notion-anesthesie-recente':
        form.date = this.toInputDate(this.pickFirstString(payload['date']), this.formatTodayInputDate());
        form.type = this.pickFirstString(payload['type'], payload['description'], payload['notes']);
        break;

      case 'cas-particulier-nourrisson-enfant':
        form.casParticulier = this.parseCasParticulier(payload);
        break;
    }
  }

  private parseNamedValues(raw: unknown, fallbackText: string): NamedValue[] {
    const values: NamedValue[] = [];
    const seen = new Set<string>();

    const addValue = (nameSource: unknown, dateSource: unknown): void => {
      const name = this.pickFirstString(nameSource);
      if (!name) {
        return;
      }

      const normalized = this.normalizeValue(name);
      if (seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      values.push({
        name,
        date: this.toDisplayDate(this.pickFirstString(dateSource), this.formatTodayDateDisplay()),
      });
    };

    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') {
          addValue(item, '');
          continue;
        }

        const source = this.asRecord(item);
        if (!source) {
          continue;
        }

        addValue(source['name'] ?? source['nom'] ?? source['label'], source['date']);
      }
    } else if (typeof raw === 'string') {
      this.splitTextValues(raw).forEach((item) => addValue(item, ''));
    }

    if (values.length === 0 && fallbackText.trim()) {
      this.splitTextValues(fallbackText).forEach((item) => addValue(item, ''));
    }

    return values;
  }

  private splitTextValues(value: string): string[] {
    return value
      .split(/[,;\n]/g)
      .map((item) => item.trim())
      .filter((item) => !!item);
  }

  private parseCasParticulier(payload: Record<string, unknown>): CasParticulierState {
    const nested = this.asRecord(payload['casparticuliernourrissonenfant']);
    const source = nested ?? payload;
    const state = this.createDefaultCasParticulierState();

    for (const option of CAS_PARTICULIER_OPTIONS) {
      const itemSource = this.asRecord(source[option.key]);
      if (!itemSource) {
        continue;
      }

      state[option.key] = {
        present: this.parseBoolean(itemSource['present']),
        date: this.toDisplayDate(this.pickFirstString(itemSource['date']), this.formatTodayDateDisplay()),
        valeur: this.pickFirstString(itemSource['valeur']),
        type: this.pickFirstString(itemSource['type']),
        cesarienne: this.parseBoolean(itemSource['cesarienne']),
        voiebasse: this.parseBoolean(itemSource['voiebasse']),
      };
    }

    return state;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private extractValue(event: unknown): string {
    if (typeof event === 'string') {
      return event.trim();
    }

    const item = event as {
      label?: unknown;
      value?: unknown;
      name?: unknown;
      nom?: unknown;
      $ngOptionLabel?: unknown;
      $ngOptionValue?: unknown;
    } | null;
    if (!item) {
      return '';
    }

    if (typeof item.value === 'string' && item.value.trim()) {
      return item.value.trim();
    }

    if (typeof item.$ngOptionValue === 'string' && item.$ngOptionValue.trim()) {
      return item.$ngOptionValue.trim();
    }

    if (typeof item.name === 'string' && item.name.trim()) {
      return item.name.trim();
    }

    if (typeof item.nom === 'string' && item.nom.trim()) {
      return item.nom.trim();
    }

    if (typeof item.label === 'string' && item.label.trim()) {
      return item.label.trim();
    }

    if (typeof item.$ngOptionLabel === 'string' && item.$ngOptionLabel.trim()) {
      return item.$ngOptionLabel.trim();
    }

    return '';
  }

  private normalizeValue(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private normalizeTemplateKey(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private buildCustomTemplateKey(value: string): string {
    const slug = this.toTemplateSlug(value);
    return `${MEDICAL_ANTECEDENT_TEMPLATE_KEY_PREFIX}${slug || 'custom'}`;
  }

  private toTemplateSlug(value: string): string {
    return this.normalizeValue(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private isDefaultAntecedentLabel(value: string): boolean {
    return this.defaultAntecedentLabelKeys.has(this.normalizeValue(value));
  }

  private findStandardDefinitionByLabel(value: string | null | undefined): StandardAntecedentDefinition | null {
    const normalized = this.normalizeValue(value ?? '');
    if (!normalized) {
      return null;
    }

    for (const definition of STANDARD_ANTECEDENTS) {
      if (this.normalizeValue(definition.label) === normalized) {
        return definition;
      }

      if ((definition.aliases ?? []).some((alias) => this.normalizeValue(alias) === normalized)) {
        return definition;
      }

      const translatedLabel = this.i18n.t(definition.i18nKey);
      if (this.normalizeValue(translatedLabel) === normalized) {
        return definition;
      }
    }

    return null;
  }

  private findStandardDefinitionByTemplateKey(templateKey: string | null | undefined): StandardAntecedentDefinition | null {
    const normalizedTemplate = this.normalizeTemplateKey(templateKey);
    if (!normalizedTemplate) {
      return null;
    }

    for (const definition of STANDARD_ANTECEDENTS) {
      if (this.normalizeTemplateKey(definition.templateKey) === normalizedTemplate) {
        return definition;
      }

      if ((definition.templateAliases ?? []).some((alias) => this.normalizeTemplateKey(alias) === normalizedTemplate)) {
        return definition;
      }
    }

    return null;
  }

  private canonicalizeStandardLabel(value: string, templateKey?: string | null): string {
    const byTemplate = this.findStandardDefinitionByTemplateKey(templateKey);
    if (byTemplate) {
      return byTemplate.label;
    }

    const byLabel = this.findStandardDefinitionByLabel(value);
    if (byLabel) {
      return byLabel.label;
    }

    return value.trim();
  }

  private ensureAntecedentForm(value: string): void {
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key] = this.createEmptyFormState();
  }

  private findAntecedentFormKey(value: string): string | null {
    const normalized = this.normalizeFormKey(value);
    for (const key of Object.keys(this.antecedentForms)) {
      if (this.normalizeFormKey(key) === normalized) {
        return key;
      }
    }

    return null;
  }

  private normalizeFormKey(value: string): string {
    return this.normalizeValue(value);
  }

  private formatTodayDateDisplay(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private formatTodayInputDate(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  private toDisplayDate(rawValue: string, fallback: string): string {
    const value = rawValue.trim();
    if (!value) {
      return fallback;
    }

    const frMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (frMatch) {
      return value;
    }

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    return value;
  }

  private toInputDate(rawValue: string, fallback: string): string {
    const value = rawValue.trim();
    if (!value) {
      return fallback;
    }

    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const frMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (frMatch) {
      return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    }

    return fallback;
  }

  private createDefaultCasParticulierItem(): CasParticulierItem {
    return {
      present: false,
      date: this.formatTodayDateDisplay(),
      valeur: '',
      type: '',
      cesarienne: false,
      voiebasse: false,
    };
  }

  private createDefaultCasParticulierState(): CasParticulierState {
    return {
      consanguinite: this.createDefaultCasParticulierItem(),
      seroconversionpendantlagrossesse: this.createDefaultCasParticulierItem(),
      prematurite: this.createDefaultCasParticulierItem(),
      accouchementvoiebasse: this.createDefaultCasParticulierItem(),
      accouchementcesarienne: this.createDefaultCasParticulierItem(),
      faiblepoidsdelanaissance: this.createDefaultCasParticulierItem(),
      souffrancefoetaleaigue: this.createDefaultCasParticulierItem(),
      casderetinoblastornedanslafamille: this.createDefaultCasParticulierItem(),
      retardscolaire: this.createDefaultCasParticulierItem(),
      comportementdemalvoyance: this.createDefaultCasParticulierItem(),
    };
  }

  private createEmptyFormState(): AntecedentFormState {
    return {
      diagnosedSince: this.formatTodayDateDisplay(),
      severity: '',
      underTreatment: false,
      treatmentName: '',
      notes: '',

      description: '',
      valeurs: [],

      diabeteType: '',
      diabeteTraitement: [],
      diabeteAnciennete: '',
      diabeteAncienneteUnit: 'ans',
      diabeteDerniereHBAIC: '',
      diabeteMedecinTraitant: '',
      diabeteResultatHBAIC: '',

      htaType: '',
      htaTraitement: '',
      htaAnciennete: '',
      htaMedecinTraitant: '',

      date: this.formatTodayInputDate(),
      type: '',

      casParticulier: this.createDefaultCasParticulierState(),
    };
  }

  private parseCasParticulierKey(value: string): CasParticulierKey | null {
    const key = value.trim() as CasParticulierKey;
    return CAS_PARTICULIER_OPTIONS.some((item) => item.key === key) ? key : null;
  }

  private mergeCatalogItems(items: InterrogatoireAnomalyCatalogItem[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const next = [...this.antecedentsGenerauxList];
    const existing = new Set(next.map((item) => this.normalizeValue(item.value)));

    for (const item of items) {
      if (item.section !== 'medical') {
        continue;
      }

      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(item.templateKey)
        ?? this.findStandardDefinitionByLabel(item.label);

      const label = (standardDefinition?.label ?? item.label ?? '').trim();
      if (!label) {
        continue;
      }

      if (this.isRemovedAntecedent(label, item.templateKey)) {
        continue;
      }

      const normalized = this.normalizeValue(label);
      if (existing.has(normalized)) {
        continue;
      }

      const normalizedTemplate = this.normalizeTemplateKey(item.templateKey);
      const shouldBeCustom = standardDefinition
        ? false
        : (item.isCustom || !normalizedTemplate || !this.defaultTemplateKeys.has(normalizedTemplate));

      existing.add(normalized);
      next.push({
        label,
        value: label,
        templateKey: standardDefinition?.templateKey ?? item.templateKey,
        isCustom: shouldBeCustom,
      });
    }

    this.antecedentsGenerauxList = next;
    this.refreshCombinedOptions();
  }

  private refreshCombinedOptions(): void {
    const selected = this.selectedAntecedentsGenerauxList.map((value) => ({
      label: value,
      value,
      isCustom: this.isCustomAntecedent(value),
    }));

    const byKey = new Map<string, AntecedentOption>();
    for (const item of [...this.antecedentsGenerauxList, ...selected]) {
      const key = this.normalizeValue(item.value);
      if (!key || byKey.has(key)) {
        continue;
      }

      byKey.set(key, item);
    }

    const next = [...byKey.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
    );

    this.combinedAntGenerauxList = next;
  }

  private isRemovedAntecedent(value: string, templateKey?: string | null): boolean {
    if (this.normalizeTemplateKey(templateKey) === REMOVED_ANTECEDENT_TEMPLATE_KEY) {
      return true;
    }

    return this.normalizeValue(value) === this.normalizeValue(REMOVED_ANTECEDENT_LABEL);
  }

  private parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return false;
  }

  private parseSeverity(value: unknown): AntecedentFormState['severity'] {
    if (typeof value !== 'string') {
      return '';
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'mild' || normalized === 'moderate' || normalized === 'severe') {
      return normalized;
    }

    return '';
  }

  private resolveOptionIsCustom(item: Pick<AntecedentOption, 'isCustom' | 'templateKey' | 'value' | 'label'>): boolean {
    if (item.isCustom === true) {
      return true;
    }

    const standardByTemplate = this.findStandardDefinitionByTemplateKey(item.templateKey);
    const standardByLabel = this.findStandardDefinitionByLabel(item.value ?? item.label ?? '');
    if (standardByTemplate || standardByLabel) {
      return false;
    }

    const templateKey = item.templateKey?.trim() ?? '';
    if (!templateKey || !this.defaultTemplateKeys.has(this.normalizeTemplateKey(templateKey))) {
      return true;
    }

    if (item.isCustom === false) {
      return false;
    }

    const value = (item.value ?? item.label ?? '').trim();
    if (!value) {
      return false;
    }

    return !this.isDefaultAntecedentLabel(value);
  }

  private toAntecedentOptionCandidate(item: unknown): AntecedentOption | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const source = item as {
      label?: unknown;
      value?: unknown;
      templateKey?: unknown;
      isCustom?: unknown;
    };

    const nested =
      source.value && typeof source.value === 'object'
        ? (source.value as { label?: unknown; value?: unknown; templateKey?: unknown; isCustom?: unknown })
        : null;

    const candidate = nested ?? source;
    const value =
      typeof candidate.value === 'string'
        ? candidate.value.trim()
        : typeof candidate.label === 'string'
          ? candidate.label.trim()
          : '';
    const label =
      typeof candidate.label === 'string'
        ? candidate.label.trim()
        : value;

    if (!value && !label) {
      return null;
    }

    return {
      label: label || value,
      value: value || label,
      templateKey:
        typeof candidate.templateKey === 'string' && candidate.templateKey.trim()
          ? candidate.templateKey.trim()
          : null,
      isCustom: typeof candidate.isCustom === 'boolean' ? candidate.isCustom : undefined,
    };
  }
}
