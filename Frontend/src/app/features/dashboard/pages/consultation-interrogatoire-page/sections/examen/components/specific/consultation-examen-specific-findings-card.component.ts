import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgMultiLabelTemplateDirective, NgNotFoundTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import {
  ExamFindingCatalogItem,
  SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS,
  SpecificExamSectionData,
  SpecificExamSectionKey,
  createDefaultSpecificExamSectionData,
} from '../../../../../../../../core/models/exam.models';
import { TranslatePipe } from '../../../../../../../../shared/pipes/translate.pipe';

type CustomFindingCreateEvent = {
  section: SpecificExamSectionKey;
  label: string;
};

@Component({
  selector: 'app-consultation-examen-specific-findings-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    NgMultiLabelTemplateDirective,
    NgNotFoundTemplateDirective,
    TranslatePipe,
  ],
  templateUrl: './consultation-examen-specific-findings-card.component.html',
  styleUrl: './consultation-examen-specific-findings-card.component.css',
})
export class ConsultationExamenSpecificFindingsCardComponent implements OnChanges {
  @Input({ required: true }) titleKey = '';
  @Input({ required: true }) sectionKey!: SpecificExamSectionKey;
  @Input() value: SpecificExamSectionData = createDefaultSpecificExamSectionData();
  @Input() catalog: ExamFindingCatalogItem[] = [];

  @Output() valueChange = new EventEmitter<SpecificExamSectionData>();
  @Output() customFindingCreate = new EventEmitter<CustomFindingCreateEvent>();

  protected selectedFindings: string[] = [];
  protected findingDetails: Record<string, { description: string }> = {};
  protected activeFinding: string | null = null;
  protected catalogLabels: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.hydrateFromValue(this.value);
    }

    if (changes['catalog'] || changes['value']) {
      this.refreshCatalogLabels();
    }
  }

  protected onFindingsModelChange(values: unknown[] | null): void {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const raw of values ?? []) {
      const label = this.normalizeLabel(this.extractLabel(raw));
      if (!label) {
        continue;
      }

      const normalized = label.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      unique.push(label);
      this.ensureDetail(label);
    }

    this.selectedFindings = this.normalizeFindingsSelection(unique);
    this.pruneUnselectedDetails();

    if (this.activeFinding && !this.selectedFindings.some((item) => this.sameLabel(item, this.activeFinding ?? ''))) {
      this.activeFinding = null;
    }

    this.refreshCatalogLabels();
    this.emitState();
  }

  protected addFindingTag(raw: unknown): string {
    const label = this.normalizeLabel(this.extractLabel(raw));
    if (!label) {
      return '';
    }

    if (!this.catalogLabels.some((item) => this.sameLabel(item, label))) {
      this.customFindingCreate.emit({
        section: this.sectionKey,
        label,
      });
    }

    if (!this.selectedFindings.some((item) => this.sameLabel(item, label))) {
      this.selectedFindings = [...this.selectedFindings, label];
    }

    this.selectedFindings = this.normalizeFindingsSelection(this.selectedFindings);
    this.ensureDetail(label);
    this.activeFinding = label;
    this.refreshCatalogLabels();
    this.emitState();
    return label;
  }

  protected toggleFindingForm(label: string): void {
    this.ensureDetail(label);
    this.activeFinding = this.activeFinding && this.sameLabel(this.activeFinding, label)
      ? null
      : label;
  }

  protected removeFinding(label: string): void {
    this.selectedFindings = this.selectedFindings.filter((item) => !this.sameLabel(item, label));
    this.selectedFindings = this.normalizeFindingsSelection(this.selectedFindings);
    this.pruneUnselectedDetails();

    if (this.activeFinding && this.sameLabel(this.activeFinding, label)) {
      this.activeFinding = null;
    }

    this.emitState();
  }

  protected getFindingDescription(label: string): string {
    const key = this.findDetailKey(label);
    return key ? this.findingDetails[key]?.description ?? '' : '';
  }

  protected updateFindingDescription(label: string, description: string): void {
    this.ensureDetail(label);
    const key = this.findDetailKey(label) ?? label;
    this.findingDetails[key] = {
      description,
    };

    this.emitState();
  }

  protected isNormalFinding(label: string): boolean {
    const defaultFinding = this.getSectionNormalFindingLabel();
    if (!defaultFinding) {
      return false;
    }

    return this.sameLabel(label, defaultFinding);
  }

  private hydrateFromValue(value: SpecificExamSectionData): void {
    const safe = value ?? createDefaultSpecificExamSectionData();
    this.selectedFindings = this.normalizeFindingsSelection(
      [...(safe.selectedFindings ?? [])]
      .map((item) => this.normalizeLabel(item))
      .filter((item) => !!item),
    );

    const details: Record<string, { description: string }> = {};
    for (const [key, detail] of Object.entries(safe.findingDetails ?? {}) as Array<
      [string, { description?: string }]
    >) {
      const normalized = this.normalizeLabel(key);
      if (!normalized) {
        continue;
      }

      details[normalized] = {
        description: detail?.description ?? '',
      };
    }

    this.findingDetails = details;
    this.pruneUnselectedDetails();
  }

  private emitState(): void {
    const findingDetails: SpecificExamSectionData['findingDetails'] = {};
    for (const label of this.selectedFindings) {
      const key = this.findDetailKey(label) ?? label;
      findingDetails[key] = {
        description: this.findingDetails[key]?.description ?? '',
      };
    }

    this.valueChange.emit({
      status: this.computeDerivedStatus(),
      selectedFindings: [...this.selectedFindings],
      findingDetails,
      notes: '',
    });
  }

  private refreshCatalogLabels(): void {
    const byNormalized = new Map<string, string>();

    for (const item of this.catalog ?? []) {
      const normalized = this.normalizeLabel(item.label);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (!byNormalized.has(key)) {
        byNormalized.set(key, normalized);
      }
    }

    for (const selected of this.selectedFindings) {
      const normalized = this.normalizeLabel(selected);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (!byNormalized.has(key)) {
        byNormalized.set(key, normalized);
      }
    }

    this.catalogLabels = [...byNormalized.values()].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    );
  }

  private ensureDetail(label: string): void {
    const key = this.findDetailKey(label) ?? label;
    if (this.findingDetails[key]) {
      return;
    }

    this.findingDetails[key] = { description: '' };
  }

  private pruneUnselectedDetails(): void {
    const selected = new Set(this.selectedFindings.map((item) => item.toLowerCase()));
    for (const key of Object.keys(this.findingDetails)) {
      if (!selected.has(key.toLowerCase())) {
        delete this.findingDetails[key];
      }
    }
  }

  private findDetailKey(label: string): string | null {
    const normalized = this.normalizeLabel(label).toLowerCase();
    for (const key of Object.keys(this.findingDetails)) {
      if (key.toLowerCase() === normalized) {
        return key;
      }
    }

    return null;
  }

  private normalizeLabel(value: string): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  private extractLabel(raw: unknown): string {
    if (typeof raw === 'string') {
      return raw;
    }

    if (raw && typeof raw === 'object') {
      const candidate = raw as Record<string, unknown>;
      if (typeof candidate['label'] === 'string') {
        return candidate['label'];
      }

      if (typeof candidate['name'] === 'string') {
        return candidate['name'];
      }
    }

    return '';
  }

  private sameLabel(a: string, b: string): boolean {
    return this.normalizeLabel(a).toLowerCase() === this.normalizeLabel(b).toLowerCase();
  }

  private normalizeFindingsSelection(values: string[]): string[] {
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const raw of values) {
      const normalized = this.normalizeLabel(raw);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      deduped.push(normalized);
    }

    const defaultFinding = this.getSectionNormalFindingLabel();
    if (!defaultFinding) {
      return deduped;
    }

    if (deduped.length === 0) {
      return [defaultFinding];
    }

    if (deduped.length === 1) {
      return deduped;
    }

    return deduped.filter((item) => !this.sameLabel(item, defaultFinding));
  }

  private computeDerivedStatus(): SpecificExamSectionData['status'] {
    if (this.selectedFindings.length === 0) {
      return 'not_examined';
    }

    const defaultFinding = this.getSectionNormalFindingLabel();
    if (!defaultFinding) {
      return 'abnormal';
    }

    const onlyNormalFinding =
      this.selectedFindings.length === 1 && this.sameLabel(this.selectedFindings[0], defaultFinding);

    return onlyNormalFinding ? 'normal' : 'abnormal';
  }

  private getSectionNormalFindingLabel(): string {
    const candidate = SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS[this.sectionKey] ?? '';
    return this.normalizeLabel(candidate);
  }
}

