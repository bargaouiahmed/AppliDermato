import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
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

type FunctionalSignOption = {
  label: string;
  value: string;
  templateKey?: string | null;
  isCustom?: boolean;
};

type FunctionalSignFormState = {
  diagnosedSince: string;
  description: string;
};

type StandardFunctionalSignKey =
  | 'fievre'
  | 'asthenie-fatigue'
  | 'perte-de-poids'
  | 'cephalees'
  | 'vertiges'
  | 'syncope-lipothymie'
  | 'douleur-thoracique'
  | 'palpitations'
  | 'dyspnee'
  | 'toux'
  | 'expectoration'
  | 'hemoptysie'
  | 'douleur-abdominale'
  | 'nausees-vomissements'
  | 'diarrhee'
  | 'constipation'
  | 'dysurie-brulures-mictionnelles'
  | 'pollakiurie'
  | 'hematurie'
  | 'arthralgies-myalgies'
  | 'lombalgies'
  | 'oedemes-membres-inferieurs'
  | 'eruption-cutanee-prurit'
  | 'anxiete'
  | 'troubles-sommeil';

type StandardFunctionalSignDefinition = {
  key: StandardFunctionalSignKey;
  label: string;
  templateKey: string;
  i18nKey: string;
  aliases?: string[];
  templateAliases?: string[];
};

const FUNCTIONAL_SIGN_TEMPLATE_KEY_PREFIX = 'functional-sign-';

const STANDARD_FUNCTIONAL_SIGNS: readonly StandardFunctionalSignDefinition[] = [
  {
    key: 'fievre',
    label: 'Fievre',
    templateKey: 'functional-sign-fievre',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.fievre',
  },
  {
    key: 'asthenie-fatigue',
    label: 'Asthenie ou fatigue',
    templateKey: 'functional-sign-asthenie-fatigue',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.asthenieFatigue',
  },
  {
    key: 'perte-de-poids',
    label: 'Perte de poids',
    templateKey: 'functional-sign-perte-de-poids',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.perteDePoids',
  },
  {
    key: 'cephalees',
    label: 'Cephalees',
    templateKey: 'functional-sign-cephalees',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.cephalees',
  },
  {
    key: 'vertiges',
    label: 'Vertiges',
    templateKey: 'functional-sign-vertiges',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.vertiges',
  },
  {
    key: 'syncope-lipothymie',
    label: 'Syncope ou lipothymie',
    templateKey: 'functional-sign-syncope-lipothymie',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.syncopeLipothymie',
  },
  {
    key: 'douleur-thoracique',
    label: 'Douleur thoracique',
    templateKey: 'functional-sign-douleur-thoracique',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.douleurThoracique',
  },
  {
    key: 'palpitations',
    label: 'Palpitations',
    templateKey: 'functional-sign-palpitations',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.palpitations',
  },
  {
    key: 'dyspnee',
    label: 'Dyspnee',
    templateKey: 'functional-sign-dyspnee',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.dyspnee',
  },
  {
    key: 'toux',
    label: 'Toux',
    templateKey: 'functional-sign-toux',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.toux',
  },
  {
    key: 'expectoration',
    label: 'Expectoration',
    templateKey: 'functional-sign-expectoration',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.expectoration',
  },
  {
    key: 'hemoptysie',
    label: 'Hemoptysie',
    templateKey: 'functional-sign-hemoptysie',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.hemoptysie',
  },
  {
    key: 'douleur-abdominale',
    label: 'Douleur abdominale',
    templateKey: 'functional-sign-douleur-abdominale',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.douleurAbdominale',
  },
  {
    key: 'nausees-vomissements',
    label: 'Nausees ou vomissements',
    templateKey: 'functional-sign-nausees-vomissements',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.nauseesVomissements',
  },
  {
    key: 'diarrhee',
    label: 'Diarrhee',
    templateKey: 'functional-sign-diarrhee',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.diarrhee',
  },
  {
    key: 'constipation',
    label: 'Constipation',
    templateKey: 'functional-sign-constipation',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.constipation',
  },
  {
    key: 'dysurie-brulures-mictionnelles',
    label: 'Dysurie ou brulures mictionnelles',
    templateKey: 'functional-sign-dysurie-brulures-mictionnelles',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.dysurieBruluresMictionnelles',
  },
  {
    key: 'pollakiurie',
    label: 'Pollakiurie',
    templateKey: 'functional-sign-pollakiurie',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.pollakiurie',
  },
  {
    key: 'hematurie',
    label: 'Hematurie',
    templateKey: 'functional-sign-hematurie',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.hematurie',
  },
  {
    key: 'arthralgies-myalgies',
    label: 'Arthralgies ou myalgies',
    templateKey: 'functional-sign-arthralgies-myalgies',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.arthralgiesMyalgies',
  },
  {
    key: 'lombalgies',
    label: 'Lombalgies',
    templateKey: 'functional-sign-lombalgies',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.lombalgies',
  },
  {
    key: 'oedemes-membres-inferieurs',
    label: 'Oedemes des membres inferieurs',
    templateKey: 'functional-sign-oedemes-membres-inferieurs',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.oedemesMembresInferieurs',
  },
  {
    key: 'eruption-cutanee-prurit',
    label: 'Eruption cutanee ou prurit',
    templateKey: 'functional-sign-eruption-cutanee-prurit',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.eruptionCutaneePrurit',
  },
  {
    key: 'anxiete',
    label: 'Anxiete',
    templateKey: 'functional-sign-anxiete',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.anxiete',
  },
  {
    key: 'troubles-sommeil',
    label: 'Troubles du sommeil',
    templateKey: 'functional-sign-troubles-sommeil',
    i18nKey: 'consultation.page.interrogatoire.functionalSigns.items.troublesSommeil',
  },
];

@Component({
  selector: 'app-consultation-interrogatoire-signes-fonctionnels',
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
  templateUrl: './consultation-interrogatoire-signes-fonctionnels.component.html',
  styleUrl: './consultation-interrogatoire-signes-fonctionnels.component.css',
})
export class ConsultationInterrogatoireSignesFonctionnelsComponent implements OnInit, OnChanges {
  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Output() anomaliesChange = new EventEmitter<UpdateInterrogatoireAnomalyRequest[]>();

  protected signesFonctionnelsExpanded = false;
  protected signesDropdownOpen = false;
  protected selectedSignesFonctionnelsList: string[] = [];
  protected activeSigneForm: string | null = null;
  protected signeForms: Record<string, FunctionalSignFormState> = {};
  protected combinedSignesFonctionnelsList: FunctionalSignOption[] = [];
  protected signesFonctionnelsList: FunctionalSignOption[] = STANDARD_FUNCTIONAL_SIGNS.map((item) => ({
    label: item.label,
    value: item.label,
    templateKey: item.templateKey,
    isCustom: false,
  }));

  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultTemplateKeys = new Set(
    STANDARD_FUNCTIONAL_SIGNS
      .flatMap((item) => [item.templateKey, ...(item.templateAliases ?? [])])
      .map((item) => this.normalizeTemplateKey(item))
      .filter((item) => !!item),
  );

  private readonly defaultSignLabelKeys = new Set(
    STANDARD_FUNCTIONAL_SIGNS
      .flatMap((item) => [item.label, ...(item.aliases ?? [])])
      .map((item) => this.normalizeValue(item))
      .filter((item) => !!item),
  );

  private readonly customSignKeys = new Set<string>();
  private isHydratingFromInput = false;

  protected get isRtl(): boolean {
    return this.i18n.dir() === 'rtl';
  }

  protected get dir(): 'rtl' | 'ltr' {
    return this.isRtl ? 'rtl' : 'ltr';
  }

  protected get isSectionCollapsible(): boolean {
    return this.selectedSignesFonctionnelsList.length === 0;
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

  protected displaySignLabel(value: string): string {
    const standardDefinition = this.findStandardDefinitionByLabel(value);
    if (!standardDefinition) {
      return value;
    }

    return this.i18n.t(standardDefinition.i18nKey);
  }

  protected displayOptionLabel(item: FunctionalSignOption): string {
    const standardDefinition =
      this.findStandardDefinitionByTemplateKey(item.templateKey)
      ?? this.findStandardDefinitionByLabel(item.label);

    if (!standardDefinition) {
      return item.label;
    }

    return this.i18n.t(standardDefinition.i18nKey);
  }

  protected addInputSigneFonctionnel(event: unknown): string {
    const inputValue = this.extractValue(event);
    if (!inputValue) {
      return '';
    }

    const standardDefinition = this.findStandardDefinitionByLabel(inputValue);
    const value = standardDefinition?.label ?? inputValue;
    const normalized = this.normalizeValue(value);

    if (
      !this.selectedSignesFonctionnelsList.some(
        (item) => this.normalizeValue(item) === normalized,
      )
    ) {
      this.selectedSignesFonctionnelsList = [
        ...this.selectedSignesFonctionnelsList,
        value,
      ];
    }

    this.ensureSigneForm(value);
    this.markCustomSign(value, !standardDefinition);
    this.activeSigneForm = value;

    if (
      !this.signesFonctionnelsList.some(
        (item) => this.normalizeValue(item.value) === normalized,
      )
    ) {
      this.signesFonctionnelsList = [
        ...this.signesFonctionnelsList,
        {
          label: value,
          value,
          templateKey: standardDefinition?.templateKey ?? this.buildCustomTemplateKey(value),
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

  protected onSignesModelChange(values: unknown[] | null): void {
    const incoming = Array.isArray(values) ? values : [];
    const previousSelected = [...this.selectedSignesFonctionnelsList];
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const rawValue of incoming) {
      const value = this.extractValue(rawValue);
      if (!value) {
        continue;
      }

      const matchingOption = this.signesFonctionnelsList.find(
        (item) => this.normalizeValue(item.value) === this.normalizeValue(value),
      );

      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(matchingOption?.templateKey)
        ?? this.findStandardDefinitionByLabel(value);
      const canonicalValue = standardDefinition?.label ?? value;

      const normalized = this.normalizeValue(canonicalValue);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      unique.push(canonicalValue);
      this.ensureSigneForm(canonicalValue);
      this.markCustomSign(
        canonicalValue,
        matchingOption ? this.resolveOptionIsCustom(matchingOption) : !standardDefinition,
      );
    }

    this.selectedSignesFonctionnelsList = unique;

    if (!this.isSectionCollapsible) {
      this.signesFonctionnelsExpanded = true;
    } else if (!this.signesDropdownOpen) {
      this.signesFonctionnelsExpanded = false;
    }

    const selectedNormalized = new Set(unique.map((item) => this.normalizeValue(item)));
    for (const key of Object.keys(this.signeForms)) {
      if (!selectedNormalized.has(this.normalizeValue(key))) {
        delete this.signeForms[key];
      }
    }

    if (
      this.activeSigneForm
      && !selectedNormalized.has(this.normalizeValue(this.activeSigneForm))
    ) {
      this.activeSigneForm = null;
    }

    const previousNormalized = new Set(previousSelected.map((item) => this.normalizeValue(item)));
    const newlyAdded = unique.filter((item) => !previousNormalized.has(this.normalizeValue(item)));
    if (newlyAdded.length > 0) {
      this.activeSigneForm = newlyAdded[newlyAdded.length - 1];
    }

    this.refreshCombinedOptions();
    this.emitAnomaliesChange();
  }

  protected toggleSignesFonctionnels(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isSectionCollapsible) {
      this.signesFonctionnelsExpanded = true;
      return;
    }

    this.signesFonctionnelsExpanded = !this.signesFonctionnelsExpanded;
  }

  protected onSignesWrapperEnter(): void {
    if (this.isSectionCollapsible && !this.signesDropdownOpen) {
      this.signesFonctionnelsExpanded = true;
    }
  }

  protected onSignesWrapperLeave(): void {
    if (this.isSectionCollapsible && !this.signesDropdownOpen) {
      this.signesFonctionnelsExpanded = false;
    }
  }

  protected onSignesSelectOpen(): void {
    this.signesDropdownOpen = true;
    this.signesFonctionnelsExpanded = true;
  }

  protected onSignesSelectClose(): void {
    this.signesDropdownOpen = false;
    if (this.isSectionCollapsible) {
      this.signesFonctionnelsExpanded = false;
    } else {
      this.signesFonctionnelsExpanded = true;
    }
  }

  protected removeSigneFonctionnel(value: string): void {
    const normalized = this.normalizeValue(value);
    this.selectedSignesFonctionnelsList = this.selectedSignesFonctionnelsList.filter(
      (item) => this.normalizeValue(item) !== normalized,
    );

    const key = this.findSigneFormKey(value);
    if (key) {
      delete this.signeForms[key];
    }

    if (this.activeSigneForm && this.normalizeValue(this.activeSigneForm) === normalized) {
      this.activeSigneForm = null;
    }

    this.customSignKeys.delete(normalized);

    if (this.isSectionCollapsible && !this.signesDropdownOpen) {
      this.signesFonctionnelsExpanded = false;
    }

    this.refreshCombinedOptions();
    this.emitAnomaliesChange();
  }

  protected deleteSigneFonctionnel(item: unknown, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const option = this.toSignOptionCandidate(item);
    const value = option?.value ?? this.extractValue(item);
    if (!value) {
      return;
    }

    const isCustom = option ? this.resolveOptionIsCustom(option) : this.isCustomSign(value);
    if (!isCustom) {
      return;
    }

    const normalized = this.normalizeValue(value);

    this.interrogatoireService
      .hideCustomAnomalyFromCatalog('medical', value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.signesFonctionnelsList = this.signesFonctionnelsList.filter(
            (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
          );
          this.refreshCombinedOptions();
        },
        error: () => {
          // Keep local state unchanged if backend hide fails.
        },
      });

    this.signesFonctionnelsList = this.signesFonctionnelsList.filter(
      (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
    );
    this.refreshCombinedOptions();
  }

  protected toggleSigneForm(value: string): void {
    this.ensureSigneForm(value);
    this.activeSigneForm = this.activeSigneForm === value ? null : value;
  }

  protected getSigneDate(value: string): string {
    this.ensureSigneForm(value);
    const key = this.findSigneFormKey(value) ?? this.normalizeFormKey(value);
    return this.signeForms[key]?.diagnosedSince ?? '';
  }

  protected getSigneDescription(value: string): string {
    const key = this.findSigneFormKey(value);
    if (!key) {
      return '';
    }

    return this.signeForms[key]?.description ?? '';
  }

  protected updateSigneDescription(value: string, description: string): void {
    this.ensureSigneForm(value);
    const key = this.findSigneFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.signeForms[key]) {
      return;
    }

    this.signeForms[key].description = description;
    this.emitAnomaliesChange();
  }

  protected isCustomOption(item: unknown): boolean {
    const option = this.toSignOptionCandidate(item);

    if (option) {
      return this.resolveOptionIsCustom(option);
    }

    const value = this.extractValue(item);
    return !!value && this.isCustomSign(value);
  }

  protected emitAnomaliesChange(): void {
    if (this.isHydratingFromInput) {
      return;
    }

    const anomalies: UpdateInterrogatoireAnomalyRequest[] = this.selectedSignesFonctionnelsList.map(
      (value, sortOrder) => {
        const normalized = this.normalizeValue(value);
        const option = this.signesFonctionnelsList.find(
          (item) => this.normalizeValue(item.value) === normalized,
        );

        const standardDefinition =
          this.findStandardDefinitionByTemplateKey(option?.templateKey)
          ?? this.findStandardDefinitionByLabel(value);
        const isCustom = option ? this.resolveOptionIsCustom(option) : !standardDefinition;

        const form = this.signeForms[this.findSigneFormKey(value) ?? this.normalizeFormKey(value)] ?? {
          ...this.createEmptyFormState(),
          diagnosedSince: this.formatTodayDateDisplay(),
        };

        const templateKey =
          standardDefinition?.templateKey
          ?? option?.templateKey
          ?? this.buildCustomTemplateKey(value);

        return {
          section: 'medical',
          isCustom,
          templateKey,
          sortOrder,
          payload: {
            name: value,
            date: form.diagnosedSince,
            description: form.description,
          },
        };
      },
    );

    this.anomaliesChange.emit(anomalies);
  }

  private hydrateFromAnomalies(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.isHydratingFromInput = true;
    this.customSignKeys.clear();

    const medicalAnomalies = [...anomalies]
      .filter((item) => item.section === 'medical')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const selected: string[] = [];
    const selectedNormalized = new Set<string>();
    const forms: Record<string, FunctionalSignFormState> = {};

    for (const anomaly of medicalAnomalies) {
      const payload = (anomaly.payload ?? {}) as Record<string, unknown>;
      const standardByTemplate = this.findStandardDefinitionByTemplateKey(anomaly.templateKey);
      const payloadLabel = this.pickFirstString(payload['name'], payload['label']);
      const standardByLabel = this.findStandardDefinitionByLabel(payloadLabel);
      const isFunctionalSign = this.shouldTreatAsFunctionalSign(anomaly.templateKey, payloadLabel);

      if (!isFunctionalSign) {
        continue;
      }

      const standardDefinition = standardByTemplate ?? standardByLabel;

      const label = this.canonicalizeStandardLabel(
        this.pickFirstString(payload['name'], payload['label'], standardDefinition?.label),
        anomaly.templateKey,
      );

      if (!label) {
        continue;
      }

      const normalizedLabel = this.normalizeValue(label);
      if (selectedNormalized.has(normalizedLabel)) {
        continue;
      }

      selectedNormalized.add(normalizedLabel);

      const form: FunctionalSignFormState = {
        diagnosedSince: this.toDisplayDate(
          this.pickFirstString(payload['diagnosedSince'], payload['dateCreation'], payload['date']),
          this.formatTodayDateDisplay(),
        ),
        description: this.pickFirstString(payload['description'], payload['notes']),
      };

      selected.push(label);
      forms[this.normalizeFormKey(label)] = form;

      const templateKey =
        standardDefinition?.templateKey
        ?? anomaly.templateKey
        ?? this.buildCustomTemplateKey(label);

      const isCustom = anomaly.isCustom || !standardDefinition || this.resolveOptionIsCustom({
        label,
        value: label,
        templateKey,
        isCustom: anomaly.isCustom,
      });

      this.markCustomSign(label, isCustom);

      if (
        !this.signesFonctionnelsList.some(
          (item) => this.normalizeValue(item.value) === normalizedLabel,
        )
      ) {
        this.signesFonctionnelsList = [
          ...this.signesFonctionnelsList,
          {
            label,
            value: label,
            templateKey,
            isCustom,
          },
        ];
      }
    }

    this.selectedSignesFonctionnelsList = selected;
    this.signeForms = forms;
    this.refreshCombinedOptions();

    if (!this.isSectionCollapsible) {
      this.signesFonctionnelsExpanded = true;
    } else if (!this.signesDropdownOpen) {
      this.signesFonctionnelsExpanded = false;
    }

    if (
      this.activeSigneForm
      && !selected.some((value) => this.normalizeValue(value) === this.normalizeValue(this.activeSigneForm ?? ''))
    ) {
      this.activeSigneForm = null;
    }

    this.isHydratingFromInput = false;
  }

  private mergeCatalogItems(items: InterrogatoireAnomalyCatalogItem[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const next = [...this.signesFonctionnelsList];
    const existing = new Set(next.map((item) => this.normalizeValue(item.value)));

    for (const item of items) {
      if (item.section !== 'medical') {
        continue;
      }

      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(item.templateKey)
        ?? this.findStandardDefinitionByLabel(item.label);
      const isFunctionalSign = this.shouldTreatAsFunctionalSign(item.templateKey, item.label);
      if (!isFunctionalSign) {
        continue;
      }

      const label = (standardDefinition?.label ?? item.label ?? '').trim();
      if (!label) {
        continue;
      }

      const normalized = this.normalizeValue(label);
      if (existing.has(normalized)) {
        continue;
      }

      const templateKey =
        standardDefinition?.templateKey
        ?? item.templateKey
        ?? this.buildCustomTemplateKey(label);

      const shouldBeCustom = standardDefinition
        ? false
        : (item.isCustom || this.isFunctionalSignTemplateKey(templateKey));

      existing.add(normalized);
      next.push({
        label,
        value: label,
        templateKey,
        isCustom: shouldBeCustom,
      });
    }

    this.signesFonctionnelsList = next;
    this.refreshCombinedOptions();
  }

  private refreshCombinedOptions(): void {
    const selected = this.selectedSignesFonctionnelsList.map((value) => ({
      label: value,
      value,
      isCustom: this.isCustomSign(value),
    }));

    const byKey = new Map<string, FunctionalSignOption>();
    for (const item of [...this.signesFonctionnelsList, ...selected]) {
      const key = this.normalizeValue(item.value);
      if (!key || byKey.has(key)) {
        continue;
      }

      byKey.set(key, item);
    }

    this.combinedSignesFonctionnelsList = [...byKey.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
    );
  }

  private ensureSigneForm(value: string): void {
    const key = this.findSigneFormKey(value) ?? this.normalizeFormKey(value);
    if (this.signeForms[key]) {
      return;
    }

    this.signeForms[key] = this.createEmptyFormState();
  }

  private findSigneFormKey(value: string): string | null {
    const normalized = this.normalizeFormKey(value);
    for (const key of Object.keys(this.signeForms)) {
      if (this.normalizeFormKey(key) === normalized) {
        return key;
      }
    }

    return null;
  }

  private createEmptyFormState(): FunctionalSignFormState {
    return {
      diagnosedSince: this.formatTodayDateDisplay(),
      description: '',
    };
  }

  private pickFirstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  private formatTodayDateDisplay(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
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

  private normalizeFormKey(value: string): string {
    return this.normalizeValue(value);
  }

  private isCustomSign(value: string): boolean {
    const normalized = this.normalizeValue(value);
    if (this.customSignKeys.has(normalized)) {
      return true;
    }

    return this.signesFonctionnelsList.some(
      (item) => this.normalizeValue(item.value) === normalized && this.resolveOptionIsCustom(item),
    );
  }

  private markCustomSign(value: string, isCustom: boolean): void {
    const normalized = this.normalizeValue(value);
    if (!normalized) {
      return;
    }

    if (isCustom) {
      this.customSignKeys.add(normalized);
      return;
    }

    this.customSignKeys.delete(normalized);
  }

  private findStandardDefinitionByLabel(value: string | null | undefined): StandardFunctionalSignDefinition | null {
    const normalized = this.normalizeValue(value ?? '');
    if (!normalized) {
      return null;
    }

    for (const definition of STANDARD_FUNCTIONAL_SIGNS) {
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

  private findStandardDefinitionByTemplateKey(templateKey: string | null | undefined): StandardFunctionalSignDefinition | null {
    const normalizedTemplate = this.normalizeTemplateKey(templateKey);
    if (!normalizedTemplate) {
      return null;
    }

    for (const definition of STANDARD_FUNCTIONAL_SIGNS) {
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

  private isDefaultSignLabel(value: string): boolean {
    return this.defaultSignLabelKeys.has(this.normalizeValue(value));
  }

  private resolveOptionIsCustom(item: Pick<FunctionalSignOption, 'isCustom' | 'templateKey' | 'value' | 'label'>): boolean {
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

    return !this.isDefaultSignLabel(value);
  }

  private toSignOptionCandidate(item: unknown): FunctionalSignOption | null {
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

  private isFunctionalSignTemplateKey(templateKey: string | null | undefined): boolean {
    return this.normalizeTemplateKey(templateKey).startsWith(FUNCTIONAL_SIGN_TEMPLATE_KEY_PREFIX);
  }

  private shouldTreatAsFunctionalSign(templateKey: string | null | undefined, label: string | null | undefined): boolean {
    const normalizedTemplateKey = this.normalizeTemplateKey(templateKey);
    if (normalizedTemplateKey) {
      if (this.isFunctionalSignTemplateKey(normalizedTemplateKey)) {
        return true;
      }

      return this.findStandardDefinitionByTemplateKey(normalizedTemplateKey) !== null;
    }

    return this.findStandardDefinitionByLabel(label) !== null;
  }

  private buildCustomTemplateKey(value: string): string {
    const slug = this.toTemplateSlug(value);
    return `${FUNCTIONAL_SIGN_TEMPLATE_KEY_PREFIX}${slug || 'custom'}`;
  }

  private toTemplateSlug(value: string): string {
    return this.normalizeValue(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
