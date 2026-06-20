import { CommonModule } from '@angular/common';
import {
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
import {
  NgMultiLabelTemplateDirective,
  NgNotFoundTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import {
  InterrogatoireAnomalyCatalogItem,
  InterrogatoireSection,
  UpdateInterrogatoireAnomalyRequest,
} from '../../../../../../../core/models/interrogatoire.models';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../../../../core/services/interrogatoire.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type DermatologicAntecedentCategory = 'laser' | 'surgical' | 'general';

type DermatologicCategoryDefinition = {
  value: DermatologicAntecedentCategory;
  section: InterrogatoireSection;
  i18nKey: string;
  shortI18nKey: string;
  order: number;
};

type DermatologicAntecedentOption = {
  label: string;
  value: string;
  category: DermatologicAntecedentCategory;
  categoryGroupLabel: string;
  section: InterrogatoireSection;
  templateKey?: string | null;
  isCustom?: boolean;
};

type DermatologicAntecedentFormState = {
  date: string;
  description: string;
  category: DermatologicAntecedentCategory;
};

type StandardDermatologicAntecedentDefinition = {
  label: string;
  templateKey: string;
  i18nKey: string;
  category: DermatologicAntecedentCategory;
  section: InterrogatoireSection;
  aliases?: string[];
  templateAliases?: string[];
};

const DERMATOLOGIC_ANTECEDENT_TEMPLATE_KEY_PREFIX = 'dermatologic-antecedent-';

const DERMATOLOGIC_CATEGORIES: readonly DermatologicCategoryDefinition[] = [
  {
    value: 'laser',
    section: 'medical',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.categories.laser',
    shortI18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.categoryButtons.laser',
    order: 0,
  },
  {
    value: 'surgical',
    section: 'surgical',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.categories.surgical',
    shortI18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.categoryButtons.surgical',
    order: 1,
  },
  {
    value: 'general',
    section: 'medical',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.categories.general',
    shortI18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.categoryButtons.general',
    order: 2,
  },
];

const STANDARD_DERMATOLOGIC_ANTECEDENTS: readonly StandardDermatologicAntecedentDefinition[] = [
  {
    label: 'Épilation laser',
    templateKey: 'dermatologic-antecedent-laser-epilation',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserEpilation',
    category: 'laser',
    section: 'medical',
  },
  {
    label: 'Laser vasculaire',
    templateKey: 'dermatologic-antecedent-laser-vasculaire',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserVasculaire',
    category: 'laser',
    section: 'medical',
  },
  {
    label: 'Laser pigmentaire',
    templateKey: 'dermatologic-antecedent-laser-pigmentaire',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserPigmentaire',
    category: 'laser',
    section: 'medical',
  },
  {
    label: 'Détatouage laser',
    templateKey: 'dermatologic-antecedent-laser-detatouage',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserDetatouage',
    category: 'laser',
    section: 'medical',
  },
  {
    label: 'Laser CO2 fractionné',
    templateKey: 'dermatologic-antecedent-laser-co2-fractionne',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserCo2Fractionne',
    category: 'laser',
    section: 'medical',
  },
  {
    label: 'Laser Erbium / resurfacing',
    templateKey: 'dermatologic-antecedent-laser-erbium',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserErbium',
    category: 'laser',
    section: 'medical',
    aliases: ['Laser Erbium resurfacing'],
  },
  {
    label: "Laser des cicatrices d'acné",
    templateKey: 'dermatologic-antecedent-laser-cicatrices-acne',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserCicatricesAcne',
    category: 'laser',
    section: 'medical',
    aliases: ['Laser cicatrices d acne', "Laser cicatrices d'acne"],
  },
  {
    label: "Laser d'angiome",
    templateKey: 'dermatologic-antecedent-laser-angiome',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.laserAngiome',
    category: 'laser',
    section: 'medical',
    aliases: ['Laser angiome'],
  },
  {
    label: 'Complication post-laser',
    templateKey: 'dermatologic-antecedent-laser-complication-post-laser',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.complicationPostLaser',
    category: 'laser',
    section: 'medical',
  },
  {
    label: 'Biopsie cutanée',
    templateKey: 'dermatologic-antecedent-surgical-biopsie-cutanee',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.biopsieCutanee',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Exérèse de nævus',
    templateKey: 'dermatologic-antecedent-surgical-exerese-naevus',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.exereseNaevus',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Exérèse de kyste ou lipome',
    templateKey: 'dermatologic-antecedent-surgical-exerese-kyste-lipome',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.exereseKysteLipome',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Exérèse de carcinome basocellulaire',
    templateKey: 'dermatologic-antecedent-surgical-exerese-carcinome-basocellulaire',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.exereseCarcinomeBasocellulaire',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Exérèse de carcinome épidermoïde',
    templateKey: 'dermatologic-antecedent-surgical-exerese-carcinome-epidermoide',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.exereseCarcinomeEpidermoide',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Exérèse de mélanome',
    templateKey: 'dermatologic-antecedent-surgical-exerese-melanome',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.exereseMelanome',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Greffe ou lambeau cutané',
    templateKey: 'dermatologic-antecedent-surgical-greffe-lambeau-cutane',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.greffeLambeauCutane',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Cicatrice hypertrophique ou chéloïde',
    templateKey: 'dermatologic-antecedent-surgical-cicatrice-hypertrophique-cheloide',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.cicatriceHypertrophiqueCheloide',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: "Incision-drainage d'abcès",
    templateKey: 'dermatologic-antecedent-surgical-incision-drainage-abces',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.incisionDrainageAbces',
    category: 'surgical',
    section: 'surgical',
    aliases: ['Incision drainage d abces', "Incision drainage d'abces"],
  },
  {
    label: 'Chirurgie esthétique cutanée',
    templateKey: 'dermatologic-antecedent-surgical-chirurgie-esthetique-cutanee',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.chirurgieEsthetiqueCutanee',
    category: 'surgical',
    section: 'surgical',
  },
  {
    label: 'Dermatite atopique / eczéma',
    templateKey: 'dermatologic-antecedent-general-dermatite-atopique-eczema',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.dermatiteAtopiqueEczema',
    category: 'general',
    section: 'medical',
    aliases: ['Dermatite atopique eczema', 'Eczema', 'Dermatite atopique'],
  },
  {
    label: 'Psoriasis',
    templateKey: 'dermatologic-antecedent-general-psoriasis',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.psoriasis',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Acné',
    templateKey: 'dermatologic-antecedent-general-acne',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.acne',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Rosacée',
    templateKey: 'dermatologic-antecedent-general-rosacee',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.rosacee',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Urticaire chronique',
    templateKey: 'dermatologic-antecedent-general-urticaire-chronique',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.urticaireChronique',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Vitiligo',
    templateKey: 'dermatologic-antecedent-general-vitiligo',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.vitiligo',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Mélasma',
    templateKey: 'dermatologic-antecedent-general-melasma',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.melasma',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Dermatite séborrhéique',
    templateKey: 'dermatologic-antecedent-general-dermatite-seborrheique',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.dermatiteSeborrheique',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Lupus cutané',
    templateKey: 'dermatologic-antecedent-general-lupus-cutane',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.lupusCutane',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Lichen plan',
    templateKey: 'dermatologic-antecedent-general-lichen-plan',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.lichenPlan',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Hidradénite suppurée',
    templateKey: 'dermatologic-antecedent-general-hidradenite-suppuree',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.hidradeniteSuppuree',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Alopécie',
    templateKey: 'dermatologic-antecedent-general-alopecie',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.alopecie',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Herpès récidivant',
    templateKey: 'dermatologic-antecedent-general-herpes-recidivant',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.herpesRecidivant',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Zona',
    templateKey: 'dermatologic-antecedent-general-zona',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.zona',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Verrues HPV',
    templateKey: 'dermatologic-antecedent-general-verrues-hpv',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.verruesHpv',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Molluscum contagiosum',
    templateKey: 'dermatologic-antecedent-general-molluscum-contagiosum',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.molluscumContagiosum',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Impétigo',
    templateKey: 'dermatologic-antecedent-general-impetigo',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.impetigo',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Folliculite',
    templateKey: 'dermatologic-antecedent-general-folliculite',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.folliculite',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Mycose cutanée / dermatophytie',
    templateKey: 'dermatologic-antecedent-general-mycose-cutanee-dermatophytie',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.mycoseCutaneeDermatophytie',
    category: 'general',
    section: 'medical',
    aliases: ['Mycose cutanee dermatophytie'],
  },
  {
    label: 'Candidose cutanée',
    templateKey: 'dermatologic-antecedent-general-candidose-cutanee',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.candidoseCutanee',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Gale',
    templateKey: 'dermatologic-antecedent-general-gale',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.gale',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Pédiculose',
    templateKey: 'dermatologic-antecedent-general-pediculose',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.pediculose',
    category: 'general',
    section: 'medical',
  },
  {
    label: 'Antécédent personnel de cancer cutané',
    templateKey: 'dermatologic-antecedent-general-cancer-cutane-personnel',
    i18nKey: 'consultation.page.interrogatoire.dermatologicAntecedents.items.cancerCutanePersonnel',
    category: 'general',
    section: 'medical',
    aliases: ['Cancer cutane personnel'],
  },
];

@Component({
  selector: 'app-consultation-interrogatoire-antecedents-dermatologiques',
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
  templateUrl: './consultation-interrogatoire-antecedents-dermatologiques.component.html',
  styleUrls: [
    './consultation-interrogatoire-antecedents-generaux.component.css',
    './consultation-interrogatoire-antecedents-dermatologiques.component.css',
  ],
})
export class ConsultationInterrogatoireAntecedentsDermatologiquesComponent implements OnInit, OnChanges {
  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Output() anomaliesChange = new EventEmitter<UpdateInterrogatoireAnomalyRequest[]>();

  @ViewChild('categoryModal') private categoryModal?: ElementRef<HTMLDivElement>;

  protected dermatologicAntecedentsExpanded = false;
  protected dermatologicDropdownOpen = false;
  protected selectedDermatologicAntecedentsList: string[] = [];
  protected activeAntecedentForm: string | null = null;
  protected antecedentForms: Record<string, DermatologicAntecedentFormState> = {};
  protected combinedDermatologicAntecedentsList: DermatologicAntecedentOption[] = [];
  protected dermatologicAntecedentsList: DermatologicAntecedentOption[] =
    STANDARD_DERMATOLOGIC_ANTECEDENTS.map((item) => this.toOption(item, false));
  protected readonly categoryActions = DERMATOLOGIC_CATEGORIES;
  protected currentSearchTerm = '';
  protected categoryModalOpen = false;
  protected categoryModalTerm = '';
  protected categoryModalActiveIndex = 0;

  private readonly customAntecedentKeys = new Set<string>();
  private isHydratingFromInput = false;

  protected get isRtl(): boolean {
    return this.i18n.dir() === 'rtl';
  }

  protected get dir(): 'rtl' | 'ltr' {
    return this.isRtl ? 'rtl' : 'ltr';
  }

  protected get isSectionCollapsible(): boolean {
    return this.selectedDermatologicAntecedentsList.length === 0;
  }

  protected get activeFormState(): DermatologicAntecedentFormState | null {
    if (!this.activeAntecedentForm) {
      return null;
    }

    const key = this.findAntecedentFormKey(this.activeAntecedentForm);
    return key ? this.antecedentForms[key] ?? null : null;
  }

  ngOnInit(): void {
    this.refreshCombinedOptions();
    this.loadCatalogSection('medical');
    this.loadCatalogSection('surgical');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anomalies']) {
      this.hydrateFromAnomalies(this.anomalies ?? []);
    }
  }

  protected displayAntecedentLabel(value: string): string {
    const standardDefinition = this.findStandardDefinitionByLabel(value);
    return standardDefinition ? this.i18n.t(standardDefinition.i18nKey) : value;
  }

  protected displayOptionLabel(item: DermatologicAntecedentOption): string {
    const standardDefinition =
      this.findStandardDefinitionByTemplateKey(item.templateKey)
      ?? this.findStandardDefinitionByLabel(item.label);

    return standardDefinition ? this.i18n.t(standardDefinition.i18nKey) : item.label;
  }

  protected displayCategoryLabel(category: DermatologicAntecedentCategory | string | null | undefined): string {
    const definition = this.findCategoryDefinition(category);
    return definition ? this.i18n.t(definition.i18nKey) : '';
  }

  protected displayCategoryShortLabel(category: DermatologicAntecedentCategory): string {
    return this.i18n.t(this.findCategoryDefinition(category)?.shortI18nKey ?? '');
  }

  protected getAntecedentDate(value: string): string {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    return this.antecedentForms[key]?.date ?? '';
  }

  protected getAntecedentCategory(value: string): DermatologicAntecedentCategory {
    const key = this.findAntecedentFormKey(value);
    if (key && this.antecedentForms[key]) {
      return this.antecedentForms[key].category;
    }

    const option = this.findOptionByValue(value);
    return option?.category ?? 'general';
  }

  protected getAntecedentDescription(value: string): string {
    const key = this.findAntecedentFormKey(value);
    return key ? this.antecedentForms[key]?.description ?? '' : '';
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

  protected updateAntecedentDate(value: string, date: string): void {
    this.ensureAntecedentForm(value);
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (!this.antecedentForms[key]) {
      return;
    }

    this.antecedentForms[key].date = date;
    this.emitAnomaliesChange();
  }

  protected onDermatologicSearch(event: unknown): void {
    const source = event as { term?: unknown } | null;
    this.currentSearchTerm = typeof source?.term === 'string' ? source.term.trim() : '';
  }

  protected onDermatologicSelectKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    const term = this.currentSearchTerm.trim();
    if (!term || this.canResolveTypedTerm(term)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.openCategoryModal(term);
  }

  protected addTypedAntecedent(searchTerm: unknown, category: DermatologicAntecedentCategory): void {
    const value = this.extractValue(searchTerm);
    if (!value) {
      return;
    }

    this.addDermatologicAntecedent(value, category);
  }

  protected onDermatologicModelChange(values: unknown[] | null): void {
    const incoming = Array.isArray(values) ? values : [];
    const previousSelected = [...this.selectedDermatologicAntecedentsList];
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const rawValue of incoming) {
      const value = this.extractValue(rawValue);
      if (!value) {
        continue;
      }

      const matchingOption = this.findOptionByValue(value);
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
      this.ensureAntecedentForm(canonicalValue, standardDefinition?.category ?? matchingOption?.category);
      this.markCustomAntecedent(
        canonicalValue,
        matchingOption ? this.resolveOptionIsCustom(matchingOption) : !standardDefinition,
      );
    }

    this.selectedDermatologicAntecedentsList = unique;

    if (!this.isSectionCollapsible) {
      this.dermatologicAntecedentsExpanded = true;
    } else if (!this.dermatologicDropdownOpen) {
      this.dermatologicAntecedentsExpanded = false;
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

  protected toggleDermatologicAntecedents(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isSectionCollapsible) {
      this.dermatologicAntecedentsExpanded = true;
      return;
    }

    this.dermatologicAntecedentsExpanded = !this.dermatologicAntecedentsExpanded;
  }

  protected onDermatologicWrapperEnter(): void {
    if (this.isSectionCollapsible && !this.dermatologicDropdownOpen) {
      this.dermatologicAntecedentsExpanded = true;
    }
  }

  protected onDermatologicWrapperLeave(): void {
    if (this.isSectionCollapsible && !this.dermatologicDropdownOpen && !this.categoryModalOpen) {
      this.dermatologicAntecedentsExpanded = false;
    }
  }

  protected onDermatologicSelectOpen(): void {
    this.dermatologicDropdownOpen = true;
    this.dermatologicAntecedentsExpanded = true;
  }

  protected onDermatologicSelectClose(): void {
    this.dermatologicDropdownOpen = false;
    this.currentSearchTerm = '';
    this.dermatologicAntecedentsExpanded = !this.isSectionCollapsible;
  }

  protected toggleAntecedentForm(value: string): void {
    this.ensureAntecedentForm(value);
    this.activeAntecedentForm = this.activeAntecedentForm === value ? null : value;
  }

  protected removeDermatologicAntecedent(value: string): void {
    const normalized = this.normalizeValue(value);
    this.selectedDermatologicAntecedentsList = this.selectedDermatologicAntecedentsList.filter(
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
    this.refreshCombinedOptions();
    this.emitAnomaliesChange();
  }

  protected deleteDermatologicAntecedent(item: unknown, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const option = this.toDermatologicOptionCandidate(item);
    const value = option?.value ?? this.extractValue(item);
    if (!value) {
      return;
    }

    const existingOption = option ?? this.findOptionByValue(value);
    const isCustom = existingOption ? this.resolveOptionIsCustom(existingOption) : this.isCustomAntecedent(value);
    if (!isCustom) {
      return;
    }

    const category = existingOption?.category ?? this.getAntecedentCategory(value);
    const section = existingOption?.section ?? this.resolveSection(category);
    const normalized = this.normalizeValue(value);

    this.interrogatoireService
      .hideCustomAnomalyFromCatalog(section, value, category)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dermatologicAntecedentsList = this.dermatologicAntecedentsList.filter(
            (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
          );
          this.refreshCombinedOptions();
        },
        error: () => {
          // Keep local state unchanged if backend hide fails.
        },
      });

    this.dermatologicAntecedentsList = this.dermatologicAntecedentsList.filter(
      (catalogItem) => this.normalizeValue(catalogItem.value) !== normalized,
    );
    this.refreshCombinedOptions();
  }

  protected isCustomOption(item: unknown): boolean {
    const option = this.toDermatologicOptionCandidate(item) ?? this.findOptionByValue(this.extractValue(item));
    return option ? this.resolveOptionIsCustom(option) : this.isCustomAntecedent(this.extractValue(item));
  }

  protected openCategoryModal(term: string): void {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      return;
    }

    this.categoryModalTerm = normalizedTerm;
    this.categoryModalActiveIndex = 0;
    this.categoryModalOpen = true;
    this.dermatologicAntecedentsExpanded = true;

    window.setTimeout(() => this.categoryModal?.nativeElement.focus(), 0);
  }

  protected closeCategoryModal(): void {
    this.categoryModalOpen = false;
    this.categoryModalTerm = '';
  }

  protected onCategoryModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCategoryModal();
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.categoryModalActiveIndex = (this.categoryModalActiveIndex + 1) % this.categoryActions.length;
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.categoryModalActiveIndex =
        (this.categoryModalActiveIndex - 1 + this.categoryActions.length) % this.categoryActions.length;
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.addModalTermToCategory(this.categoryActions[this.categoryModalActiveIndex]?.value ?? 'general');
    }
  }

  protected addModalTermToCategory(category: DermatologicAntecedentCategory): void {
    const term = this.categoryModalTerm.trim();
    if (!term) {
      return;
    }

    this.addDermatologicAntecedent(term, category);
    this.closeCategoryModal();
  }

  protected emitAnomaliesChange(): void {
    if (this.isHydratingFromInput) {
      return;
    }

    const anomalies = this.selectedDermatologicAntecedentsList.map((value, sortOrder) => {
      const option = this.findOptionByValue(value);
      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(option?.templateKey)
        ?? this.findStandardDefinitionByLabel(value);
      const form = this.antecedentForms[this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value)] ?? {
        ...this.createEmptyFormState(standardDefinition?.category ?? option?.category ?? 'general'),
        date: this.formatTodayDateDisplay(),
      };
      const category = standardDefinition?.category ?? option?.category ?? form.category;
      const section = standardDefinition?.section ?? option?.section ?? this.resolveSection(category);
      const templateKey =
        standardDefinition?.templateKey
        ?? option?.templateKey
        ?? this.buildCustomTemplateKey(value, category);

      return {
        section,
        isCustom: option ? this.resolveOptionIsCustom(option) : !standardDefinition,
        templateKey,
        sortOrder,
        payload: {
          name: standardDefinition?.label ?? value,
          date: form.date,
          description: form.description,
          category,
        },
      };
    });

    this.anomaliesChange.emit(anomalies);
  }

  private addDermatologicAntecedent(value: string, requestedCategory: DermatologicAntecedentCategory): void {
    const standardDefinition = this.findStandardDefinitionByLabel(value);
    const canonicalValue = standardDefinition?.label ?? value.trim();
    const category = standardDefinition?.category ?? requestedCategory;
    const section = standardDefinition?.section ?? this.resolveSection(category);
    const normalized = this.normalizeValue(canonicalValue);

    if (!normalized) {
      return;
    }

    if (
      !this.selectedDermatologicAntecedentsList.some(
        (item) => this.normalizeValue(item) === normalized,
      )
    ) {
      this.selectedDermatologicAntecedentsList = [
        ...this.selectedDermatologicAntecedentsList,
        canonicalValue,
      ];
    }

    this.ensureAntecedentForm(canonicalValue, category);
    this.activeAntecedentForm = canonicalValue;
    this.markCustomAntecedent(canonicalValue, !standardDefinition);

    if (!this.findOptionByValue(canonicalValue)) {
      this.dermatologicAntecedentsList = [
        ...this.dermatologicAntecedentsList,
        {
          label: canonicalValue,
          value: canonicalValue,
          category,
          categoryGroupLabel: this.displayCategoryLabel(category),
          section,
          templateKey: standardDefinition?.templateKey ?? this.buildCustomTemplateKey(canonicalValue, category),
          isCustom: !standardDefinition,
        },
      ];
    }

    this.currentSearchTerm = '';
    this.refreshCombinedOptions();
    this.emitAnomaliesChange();

    if (!standardDefinition) {
      this.interrogatoireService
        .addCustomAnomalyToCatalog(section, canonicalValue, this.buildCustomTemplateKey(canonicalValue, category), category)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }

  private hydrateFromAnomalies(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.isHydratingFromInput = true;
    this.customAntecedentKeys.clear();

    const dermatologicAnomalies = [...anomalies]
      .filter((item) => this.isDermatologicAnomaly(item))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const selected: string[] = [];
    const selectedNormalized = new Set<string>();
    const forms: Record<string, DermatologicAntecedentFormState> = {};

    for (const anomaly of dermatologicAnomalies) {
      const payload = (anomaly.payload ?? {}) as Record<string, unknown>;
      const standardByTemplate = this.findStandardDefinitionByTemplateKey(anomaly.templateKey);
      const payloadLabel = this.pickFirstString(payload['name'], payload['label']);
      const standardByLabel = this.findStandardDefinitionByLabel(payloadLabel);
      const standardDefinition = standardByTemplate ?? standardByLabel;
      const category = this.resolveCategory(
        this.pickFirstString(payload['category'], payload['categoryKey']),
        anomaly.templateKey,
        anomaly.section,
        standardDefinition?.category,
      );

      if (!category) {
        continue;
      }

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
      selected.push(label);
      forms[this.normalizeFormKey(label)] = {
        date: this.toDisplayDate(
          this.pickFirstString(payload['date'], payload['diagnosedSince'], payload['dateCreation']),
          this.formatTodayDateDisplay(),
        ),
        description: this.pickFirstString(payload['description'], payload['notes']),
        category,
      };

      const option: DermatologicAntecedentOption = {
        label,
        value: label,
        category,
        categoryGroupLabel: this.displayCategoryLabel(category),
        section: standardDefinition?.section ?? anomaly.section,
        templateKey: standardDefinition?.templateKey ?? anomaly.templateKey ?? this.buildCustomTemplateKey(label, category),
        isCustom: anomaly.isCustom || !standardDefinition,
      };

      this.markCustomAntecedent(label, this.resolveOptionIsCustom(option));

      if (!this.findOptionByValue(label)) {
        this.dermatologicAntecedentsList = [...this.dermatologicAntecedentsList, option];
      }
    }

    this.selectedDermatologicAntecedentsList = selected;
    this.antecedentForms = forms;
    this.refreshCombinedOptions();
    this.dermatologicAntecedentsExpanded = !this.isSectionCollapsible;

    if (
      this.activeAntecedentForm
      && !selected.some((value) => this.normalizeValue(value) === this.normalizeValue(this.activeAntecedentForm ?? ''))
    ) {
      this.activeAntecedentForm = null;
    }

    this.isHydratingFromInput = false;
  }

  private loadCatalogSection(section: 'medical' | 'surgical'): void {
    this.interrogatoireService
      .getAnomalyCatalog(section)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.mergeCatalogItems(items ?? []),
        error: () => {
          // Keep defaults if catalog fetch fails.
        },
      });
  }

  private mergeCatalogItems(items: InterrogatoireAnomalyCatalogItem[]): void {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const next = [...this.dermatologicAntecedentsList];
    const existing = new Set(next.map((item) => this.normalizeValue(item.value)));

    for (const item of items) {
      const standardDefinition =
        this.findStandardDefinitionByTemplateKey(item.templateKey)
        ?? this.findStandardDefinitionByLabel(item.label);
      const category = this.resolveCategory(
        item.category ?? '',
        item.templateKey,
        item.section,
        standardDefinition?.category,
      );

      if (!category || !this.shouldTreatAsDermatologicAntecedent(item.templateKey, item.category)) {
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

      existing.add(normalized);
      next.push({
        label,
        value: label,
        category,
        categoryGroupLabel: this.displayCategoryLabel(category),
        section: standardDefinition?.section ?? item.section,
        templateKey: standardDefinition?.templateKey ?? item.templateKey ?? this.buildCustomTemplateKey(label, category),
        isCustom: standardDefinition ? false : item.isCustom,
      });
    }

    this.dermatologicAntecedentsList = next;
    this.refreshCombinedOptions();
  }

  private refreshCombinedOptions(): void {
    const selected = this.selectedDermatologicAntecedentsList.map((value) => {
      const option = this.findOptionByValue(value);
      const category = this.antecedentForms[this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value)]?.category
        ?? option?.category
        ?? 'general';

      return {
        label: value,
        value,
        category,
        categoryGroupLabel: this.displayCategoryLabel(category),
        section: option?.section ?? this.resolveSection(category),
        templateKey: option?.templateKey ?? this.buildCustomTemplateKey(value, category),
        isCustom: this.isCustomAntecedent(value),
      };
    });

    const byKey = new Map<string, DermatologicAntecedentOption>();
    for (const item of [...this.dermatologicAntecedentsList, ...selected]) {
      const key = this.normalizeValue(item.value);
      if (!key || byKey.has(key)) {
        continue;
      }

      byKey.set(key, {
        ...item,
        categoryGroupLabel: this.displayCategoryLabel(item.category),
      });
    }

    this.combinedDermatologicAntecedentsList = [...byKey.values()].sort((a, b) => {
      const orderDiff = this.categoryOrder(a.category) - this.categoryOrder(b.category);
      return orderDiff !== 0 ? orderDiff : a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
    });
  }

  private toOption(
    item: StandardDermatologicAntecedentDefinition,
    isCustom: boolean,
  ): DermatologicAntecedentOption {
    return {
      label: item.label,
      value: item.label,
      category: item.category,
      categoryGroupLabel: this.displayCategoryLabel(item.category),
      section: item.section,
      templateKey: item.templateKey,
      isCustom,
    };
  }

  private findOptionByValue(value: string | null | undefined): DermatologicAntecedentOption | null {
    const normalized = this.normalizeValue(value ?? '');
    if (!normalized) {
      return null;
    }

    return this.dermatologicAntecedentsList.find((item) => this.normalizeValue(item.value) === normalized) ?? null;
  }

  private ensureAntecedentForm(value: string, category?: DermatologicAntecedentCategory | null): void {
    const key = this.findAntecedentFormKey(value) ?? this.normalizeFormKey(value);
    if (this.antecedentForms[key]) {
      return;
    }

    const option = this.findOptionByValue(value);
    const standardDefinition = this.findStandardDefinitionByLabel(value);
    this.antecedentForms[key] = this.createEmptyFormState(
      category ?? standardDefinition?.category ?? option?.category ?? 'general',
    );
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

  private createEmptyFormState(category: DermatologicAntecedentCategory): DermatologicAntecedentFormState {
    return {
      date: this.formatTodayDateDisplay(),
      description: '',
      category,
    };
  }

  private isDermatologicAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
    return this.shouldTreatAsDermatologicAntecedent(
      item.templateKey,
      this.pickFirstString(item.payload?.['category'], item.payload?.['categoryKey']),
    );
  }

  private shouldTreatAsDermatologicAntecedent(
    templateKey: string | null | undefined,
    category: string | null | undefined,
  ): boolean {
    return this.isDermatologicTemplateKey(templateKey) || this.resolveCategory(category, templateKey, 'medical') !== null;
  }

  private isDermatologicTemplateKey(templateKey: string | null | undefined): boolean {
    return this.normalizeTemplateKey(templateKey).startsWith(DERMATOLOGIC_ANTECEDENT_TEMPLATE_KEY_PREFIX);
  }

  private findStandardDefinitionByLabel(value: string | null | undefined): StandardDermatologicAntecedentDefinition | null {
    const normalized = this.normalizeValue(value ?? '');
    if (!normalized) {
      return null;
    }

    for (const definition of STANDARD_DERMATOLOGIC_ANTECEDENTS) {
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

  private findStandardDefinitionByTemplateKey(
    templateKey: string | null | undefined,
  ): StandardDermatologicAntecedentDefinition | null {
    const normalizedTemplate = this.normalizeTemplateKey(templateKey);
    if (!normalizedTemplate) {
      return null;
    }

    for (const definition of STANDARD_DERMATOLOGIC_ANTECEDENTS) {
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

  private resolveCategory(
    rawCategory: string | null | undefined,
    templateKey?: string | null,
    section?: InterrogatoireSection,
    fallback?: DermatologicAntecedentCategory | null,
  ): DermatologicAntecedentCategory | null {
    const normalized = this.normalizeValue(rawCategory ?? '');
    if (normalized === 'laser' || normalized === 'traitement laser') {
      return 'laser';
    }

    if (['surgical', 'chirurgical', 'chirurgicaux', 'chirurgie'].includes(normalized)) {
      return 'surgical';
    }

    if (['general', 'generaux', 'dermatologiques generaux'].includes(normalized)) {
      return 'general';
    }

    const normalizedTemplate = this.normalizeTemplateKey(templateKey);
    if (normalizedTemplate.startsWith('dermatologic-antecedent-laser-')) {
      return 'laser';
    }

    if (normalizedTemplate.startsWith('dermatologic-antecedent-surgical-')) {
      return 'surgical';
    }

    if (normalizedTemplate.startsWith('dermatologic-antecedent-general-')) {
      return 'general';
    }

    if (fallback) {
      return fallback;
    }

    return section === 'surgical' && this.isDermatologicTemplateKey(templateKey) ? 'surgical' : null;
  }

  private findCategoryDefinition(
    category: DermatologicAntecedentCategory | string | null | undefined,
  ): DermatologicCategoryDefinition | null {
    const normalized = this.resolveCategory(category ?? '', null, 'medical');
    return normalized
      ? DERMATOLOGIC_CATEGORIES.find((item) => item.value === normalized) ?? null
      : null;
  }

  private resolveSection(category: DermatologicAntecedentCategory): InterrogatoireSection {
    return DERMATOLOGIC_CATEGORIES.find((item) => item.value === category)?.section ?? 'medical';
  }

  private categoryOrder(category: DermatologicAntecedentCategory): number {
    return DERMATOLOGIC_CATEGORIES.find((item) => item.value === category)?.order ?? 99;
  }

  private canResolveTypedTerm(value: string): boolean {
    const normalized = this.normalizeValue(value);
    return this.combinedDermatologicAntecedentsList.some((item) => this.normalizeValue(item.value) === normalized)
      || this.findStandardDefinitionByLabel(value) !== null;
  }

  private resolveOptionIsCustom(
    item: Pick<DermatologicAntecedentOption, 'isCustom' | 'templateKey' | 'value' | 'label'>,
  ): boolean {
    if (item.isCustom === true) {
      return true;
    }

    const standardByTemplate = this.findStandardDefinitionByTemplateKey(item.templateKey);
    const standardByLabel = this.findStandardDefinitionByLabel(item.value ?? item.label ?? '');
    return !(standardByTemplate || standardByLabel);
  }

  private isCustomAntecedent(value: string): boolean {
    const normalized = this.normalizeValue(value);
    if (this.customAntecedentKeys.has(normalized)) {
      return true;
    }

    return this.dermatologicAntecedentsList.some(
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

  private toDermatologicOptionCandidate(item: unknown): DermatologicAntecedentOption | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const source = item as {
      label?: unknown;
      value?: unknown;
      category?: unknown;
      section?: unknown;
      templateKey?: unknown;
      isCustom?: unknown;
    };

    const nested =
      source.value && typeof source.value === 'object'
        ? (source.value as {
            label?: unknown;
            value?: unknown;
            category?: unknown;
            section?: unknown;
            templateKey?: unknown;
            isCustom?: unknown;
          })
        : null;

    const candidate = nested ?? source;
    const value =
      typeof candidate.value === 'string'
        ? candidate.value.trim()
        : typeof candidate.label === 'string'
          ? candidate.label.trim()
          : '';
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : value;
    const category = this.resolveCategory(
      typeof candidate.category === 'string' ? candidate.category : '',
      typeof candidate.templateKey === 'string' ? candidate.templateKey : null,
      typeof candidate.section === 'string' ? (candidate.section as InterrogatoireSection) : 'medical',
    );

    if ((!value && !label) || !category) {
      return null;
    }

    return {
      label: label || value,
      value: value || label,
      category,
      categoryGroupLabel: this.displayCategoryLabel(category),
      section: this.resolveSection(category),
      templateKey:
        typeof candidate.templateKey === 'string' && candidate.templateKey.trim()
          ? candidate.templateKey.trim()
          : null,
      isCustom: typeof candidate.isCustom === 'boolean' ? candidate.isCustom : undefined,
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

  private normalizeValue(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['â€™`]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private normalizeTemplateKey(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private normalizeFormKey(value: string): string {
    return this.normalizeValue(value);
  }

  private buildCustomTemplateKey(value: string, category: DermatologicAntecedentCategory): string {
    const slug = this.toTemplateSlug(value);
    return `${DERMATOLOGIC_ANTECEDENT_TEMPLATE_KEY_PREFIX}${category}-${slug || 'custom'}`;
  }

  private toTemplateSlug(value: string): string {
    return this.normalizeValue(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
