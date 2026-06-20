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

type AntecedentOption = {
  label: string;
  value: string;
  templateKey?: string | null;
  isCustom?: boolean;
};

type AntecedentFormState = {
  diagnosedSince: string;
  description: string;
};

type StandardFamilyAntecedentKey =
  | 'atopie-familiale'
  | 'psoriasis-familial'
  | 'vitiligo-familial'
  | 'pelade-familiale'
  | 'lupus-maladie-auto-immune-familiale'
  | 'melanome-familial'
  | 'cancer-cutane-non-melanome-familial'
  | 'acne-severe-familiale'
  | 'ichthyose-maladie-genetique-cutanee-familiale';

type StandardFamilyAntecedentDefinition = {
  key: StandardFamilyAntecedentKey;
  label: string;
  templateKey: string;
  i18nKey: string;
  aliases?: string[];
  templateAliases?: string[];
};

const STANDARD_FAMILY_ANTECEDENTS: readonly StandardFamilyAntecedentDefinition[] = [
  {
    key: 'atopie-familiale',
    label: 'Atopie familiale',
    templateKey: 'family-atopie',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.atopieFamiliale',
  },
  {
    key: 'psoriasis-familial',
    label: 'Psoriasis familial',
    templateKey: 'family-psoriasis',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.psoriasisFamilial',
  },
  {
    key: 'vitiligo-familial',
    label: 'Vitiligo familial',
    templateKey: 'family-vitiligo',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.vitiligoFamilial',
  },
  {
    key: 'pelade-familiale',
    label: 'Pelade familiale',
    templateKey: 'family-pelade',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.peladeFamiliale',
  },
  {
    key: 'lupus-maladie-auto-immune-familiale',
    label: 'Lupus ou maladie auto-immune familiale',
    templateKey: 'family-lupus-maladie-auto-immune',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.lupusMaladieAutoImmuneFamiliale',
  },
  {
    key: 'melanome-familial',
    label: 'Mélanome familial',
    templateKey: 'family-melanome',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.melanomeFamilial',
    aliases: ['Melanome familial'],
  },
  {
    key: 'cancer-cutane-non-melanome-familial',
    label: 'Cancer cutané non mélanome familial',
    templateKey: 'family-cancer-cutane-non-melanome',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.cancerCutaneNonMelanomeFamilial',
    aliases: ['Cancer cutane non melanome familial'],
  },
  {
    key: 'acne-severe-familiale',
    label: 'Acné sévère familiale',
    templateKey: 'family-acne-severe',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.acneSevereFamiliale',
    aliases: ['Acne severe familiale'],
  },
  {
    key: 'ichthyose-maladie-genetique-cutanee-familiale',
    label: 'Ichthyose ou maladie génétique cutanée familiale',
    templateKey: 'family-ichthyose-maladie-genetique-cutanee',
    i18nKey: 'consultation.page.interrogatoire.familyAntecedents.items.ichthyoseMaladieGenetiqueCutaneeFamiliale',
    aliases: ['Ichthyose ou maladie genetique cutanee familiale'],
  },
];

@Component({
  selector: 'app-consultation-interrogatoire-antecedents-familiaux',
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
  templateUrl: './consultation-interrogatoire-antecedents-familiaux.component.html',
  styleUrl: './consultation-interrogatoire-antecedents-familiaux.component.css',
})
export class ConsultationInterrogatoireAntecedentsFamiliauxComponent implements OnInit, OnChanges {
  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Output() anomaliesChange = new EventEmitter<UpdateInterrogatoireAnomalyRequest[]>();

  protected antecedentsFamiliauxExpanded = false;
  protected antecedentsDropdownOpen = false;
  protected selectedAntecedentsFamiliauxList: string[] = [];
  protected activeAntecedentForm: string | null = null;
  protected antecedentForms: Record<string, AntecedentFormState> = {};
  protected combinedAntecedentsFamiliauxList: AntecedentOption[] = [];
  protected antecedentsFamiliauxList: AntecedentOption[] = STANDARD_FAMILY_ANTECEDENTS.map((item) => ({
    label: item.label,
    value: item.label,
    templateKey: item.templateKey,
    isCustom: false,
  }));

  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultTemplateKeys = new Set(
    STANDARD_FAMILY_ANTECEDENTS
      .flatMap((item) => [item.templateKey, ...(item.templateAliases ?? [])])
      .map((item) => this.normalizeTemplateKey(item))
      .filter((item) => !!item),
  );

  private readonly defaultAntecedentLabelKeys = new Set(
    STANDARD_FAMILY_ANTECEDENTS
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
    return this.selectedAntecedentsFamiliauxList.length === 0;
  }

  ngOnInit(): void {
    this.refreshCombinedOptions();

    this.interrogatoireService
      .getAnomalyCatalog('family')
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
    if (!standardDefinition) {
      return value;
    }

    return this.i18n.t(standardDefinition.i18nKey);
  }

  protected displayOptionLabel(item: AntecedentOption): string {
    const standardDefinition =
      this.findStandardDefinitionByTemplateKey(item.templateKey)
      ?? this.findStandardDefinitionByLabel(item.label);

    if (!standardDefinition) {
      return item.label;
    }

    return this.i18n.t(standardDefinition.i18nKey);
  }

  protected addInputAntecedentFamiliaux(event: unknown): string {
    const inputValue = this.extractValue(event);
    if (!inputValue) {
      return '';
    }

    const standardDefinition = this.findStandardDefinitionByLabel(inputValue);
    const value = standardDefinition?.label ?? inputValue;
    const normalized = this.normalizeValue(value);

    if (
      !this.selectedAntecedentsFamiliauxList.some(
        (item) => this.normalizeValue(item) === normalized,
      )
    ) {
      this.selectedAntecedentsFamiliauxList = [
        ...this.selectedAntecedentsFamiliauxList,
        value,
      ];
    }

    this.ensureAntecedentForm(value);
    this.markCustomAntecedent(value, !standardDefinition);
    this.activeAntecedentForm = value;

    if (
      !this.antecedentsFamiliauxList.some(
        (item) => this.normalizeValue(item.value) === normalized,
      )
    ) {
      this.antecedentsFamiliauxList = [
        ...this.antecedentsFamiliauxList,
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
        .addCustomAnomalyToCatalog('family', value, null)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }

    return value;
  }

  protected onAntecedentsModelChange(values: unknown[] | null): void {
    const incoming = Array.isArray(values) ? values : [];
    const previousSelected = [...this.selectedAntecedentsFamiliauxList];
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const rawValue of incoming) {
      const value = this.extractValue(rawValue);
      if (!value) {
        continue;
      }

      const matchingOption = this.antecedentsFamiliauxList.find(
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
      this.ensureAntecedentForm(canonicalValue);
      this.markCustomAntecedent(
        canonicalValue,
        matchingOption ? this.resolveOptionIsCustom(matchingOption) : !standardDefinition,
      );
    }

    this.selectedAntecedentsFamiliauxList = unique;

    if (!this.isSectionCollapsible) {
      this.antecedentsFamiliauxExpanded = true;
    } else if (!this.antecedentsDropdownOpen) {
      this.antecedentsFamiliauxExpanded = false;
    }

    const selectedNormalized = new Set(unique.map((item) => this.normalizeValue(item)));
    for (const key of Object.keys(this.antecedentForms)) {
      if (!selectedNormalized.has(this.normalizeValue(key))) {
        delete this.antecedentForms[key];
      }
    }

    if (
      this.activeAntecedentForm
      && !selectedNormalized.has(this.normalizeValue(this.activeAntecedentForm))
    ) {
      this.activeAntecedentForm = null;
    }

    const previousNormalized = new Set(previousSelected.map((item) => this.normalizeValue(item)));
    const newlyAdded = unique.filter((item) => !previousNormalized.has(this.normalizeValue(item)));
    if (newlyAdded.length > 0) {
      this.activeAntecedentForm = newlyAdded[newlyAdded.length - 1];
    }

    this.refreshCombinedOptions();
    this.emitAnomaliesChange();
  }

  protected toggleAntecedentsFamiliaux(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isSectionCollapsible) {
      this.antecedentsFamiliauxExpanded = true;
      return;
    }

    this.antecedentsFamiliauxExpanded = !this.antecedentsFamiliauxExpanded;
  }

  protected onAntecedentsWrapperEnter(): void {
    if (this.isSectionCollapsible && !this.antecedentsDropdownOpen) {
      this.antecedentsFamiliauxExpanded = true;
    }
  }

  protected onAntecedentsWrapperLeave(): void {
    if (this.isSectionCollapsible && !this.antecedentsDropdownOpen) {
      this.antecedentsFamiliauxExpanded = false;
    }
  }

  protected onAntecedentsSelectOpen(): void {
    this.antecedentsDropdownOpen = true;
    this.antecedentsFamiliauxExpanded = true;
  }

  protected onAntecedentsSelectClose(): void {
    this.antecedentsDropdownOpen = false;
    if (this.isSectionCollapsible) {
      this.antecedentsFamiliauxExpanded = false;
    } else {
      this.antecedentsFamiliauxExpanded = true;
    }
  }

  protected removeAntecedentFamilial(value: string): void {
    const normalized = this.normalizeValue(value);
    this.selectedAntecedentsFamiliauxList = this.selectedAntecedentsFamiliauxList.filter(
      (item) => this.normalizeValue(item) !== normalized,
    );

    const key = this.findAntecedentFormKey(value);
    if (key) {
      delete this.antecedentForms[key];
    }

    if (this.activeAntecedentForm && this.normalizeValue(this.activeAntecedentForm) === normalized) {
      this.activeAntecedentForm = null;
    }

    this.customAntecedentKeys.delete(normalized);

    if (this.isSectionCollapsible && !this.antecedentsDropdownOpen) {
      this.antecedentsFamiliauxExpanded = false;
    }

    this.refreshCombinedOptions();
    this.emitAnomaliesChange();
  }

  protected deleteAntecedentFamilial(item: unknown, event: MouseEvent): void {
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
      .hideCustomAnomalyFromCatalog('family', value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.antecedentsFamiliauxList = this.antecedentsFamiliauxList.filter(
            (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
          );
          this.refreshCombinedOptions();
        },
        error: () => {
          // Keep local state unchanged if backend hide fails.
        },
      });

    this.antecedentsFamiliauxList = this.antecedentsFamiliauxList.filter(
      (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
    );
    this.refreshCombinedOptions();
  }

  protected toggleAntecedentForm(value: string): void {
    this.ensureAntecedentForm(value);
    this.activeAntecedentForm = this.activeAntecedentForm === value ? null : value;
  }

  protected getAntecedentDate(value: string): string {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    return this.antecedentForms[key]?.diagnosedSince ?? '';
  }

  protected getAntecedentDescription(value: string): string {
    const key = this.findAntecedentFormKey(value);
    if (!key) {
      return '';
    }

    return this.antecedentForms[key]?.description ?? '';
  }

  protected updateAntecedentDescription(value: string, description: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].description = description;
    this.emitAnomaliesChange();
  }

  protected isCustomOption(item: unknown): boolean {
    const option = this.toAntecedentOptionCandidate(item);

    if (option) {
      return this.resolveOptionIsCustom(option);
    }

    const value = this.extractValue(item);
    return !!value && this.isCustomAntecedent(value);
  }

  protected emitAnomaliesChange(): void {
    if (this.isHydratingFromInput) {
      return;
    }

    const anomalies: UpdateInterrogatoireAnomalyRequest[] = this.selectedAntecedentsFamiliauxList.map(
      (value, sortOrder) => {
        const normalized = this.normalizeValue(value);
        const option = this.antecedentsFamiliauxList.find(
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

        return {
          section: 'family',
          isCustom,
          templateKey: standardDefinition?.templateKey ?? option?.templateKey ?? null,
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
    this.customAntecedentKeys.clear();

    const familyAnomalies = [...anomalies]
      .filter((item) => item.section === 'family')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const selected: string[] = [];
    const selectedNormalized = new Set<string>();
    const forms: Record<string, AntecedentFormState> = {};

    for (const anomaly of familyAnomalies) {
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

      const normalizedLabel = this.normalizeValue(label);
      if (selectedNormalized.has(normalizedLabel)) {
        continue;
      }

      selectedNormalized.add(normalizedLabel);

      const form: AntecedentFormState = {
        diagnosedSince: this.toDisplayDate(
          this.pickFirstString(payload['diagnosedSince'], payload['dateCreation'], payload['date']),
          this.formatTodayDateDisplay(),
        ),
        description: this.pickFirstString(payload['description'], payload['notes']),
      };

      selected.push(label);
      forms[this.normalizeFormKey(label)] = form;

      const isCustom = anomaly.isCustom || !standardDefinition || this.resolveOptionIsCustom({
        label,
        value: label,
        templateKey: standardDefinition?.templateKey ?? anomaly.templateKey,
        isCustom: anomaly.isCustom,
      });

      this.markCustomAntecedent(label, isCustom);

      if (
        !this.antecedentsFamiliauxList.some(
          (item) => this.normalizeValue(item.value) === normalizedLabel,
        )
      ) {
        this.antecedentsFamiliauxList = [
          ...this.antecedentsFamiliauxList,
          {
            label,
            value: label,
            templateKey: standardDefinition?.templateKey ?? anomaly.templateKey,
            isCustom,
          },
        ];
      }
    }

    this.selectedAntecedentsFamiliauxList = selected;
    this.antecedentForms = forms;
    this.refreshCombinedOptions();

    if (!this.isSectionCollapsible) {
      this.antecedentsFamiliauxExpanded = true;
    } else if (!this.antecedentsDropdownOpen) {
      this.antecedentsFamiliauxExpanded = false;
    }

    if (
      this.activeAntecedentForm
      && !selected.some((value) => this.normalizeValue(value) === this.normalizeValue(this.activeAntecedentForm ?? ''))
    ) {
      this.activeAntecedentForm = null;
    }

    this.isHydratingFromInput = false;
  }

  private mergeCatalogItems(items: InterrogatoireAnomalyCatalogItem[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const next = [...this.antecedentsFamiliauxList];
    const existing = new Set(next.map((item) => this.normalizeValue(item.value)));

    for (const item of items) {
      if (item.section !== 'family') {
        continue;
      }

      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(item.templateKey)
        ?? this.findStandardDefinitionByLabel(item.label);

      const label = (standardDefinition?.label ?? item.label ?? '').trim();
      if (!label) {
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

    this.antecedentsFamiliauxList = next;
    this.refreshCombinedOptions();
  }

  private refreshCombinedOptions(): void {
    const selected = this.selectedAntecedentsFamiliauxList.map((value) => ({
      label: value,
      value,
      isCustom: this.isCustomAntecedent(value),
    }));

    const byKey = new Map<string, AntecedentOption>();
    for (const item of [...this.antecedentsFamiliauxList, ...selected]) {
      const key = this.normalizeValue(item.value);
      if (!key || byKey.has(key)) {
        continue;
      }

      byKey.set(key, item);
    }

    this.combinedAntecedentsFamiliauxList = [...byKey.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
    );
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

  private createEmptyFormState(): AntecedentFormState {
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

  private isCustomAntecedent(value: string): boolean {
    const normalized = this.normalizeValue(value);
    if (this.customAntecedentKeys.has(normalized)) {
      return true;
    }

    return this.antecedentsFamiliauxList.some(
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

  private findStandardDefinitionByLabel(value: string | null | undefined): StandardFamilyAntecedentDefinition | null {
    const normalized = this.normalizeValue(value ?? '');
    if (!normalized) {
      return null;
    }

    for (const definition of STANDARD_FAMILY_ANTECEDENTS) {
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

  private findStandardDefinitionByTemplateKey(templateKey: string | null | undefined): StandardFamilyAntecedentDefinition | null {
    const normalizedTemplate = this.normalizeTemplateKey(templateKey);
    if (!normalizedTemplate) {
      return null;
    }

    for (const definition of STANDARD_FAMILY_ANTECEDENTS) {
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

  private isDefaultAntecedentLabel(value: string): boolean {
    return this.defaultAntecedentLabelKeys.has(this.normalizeValue(value));
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
