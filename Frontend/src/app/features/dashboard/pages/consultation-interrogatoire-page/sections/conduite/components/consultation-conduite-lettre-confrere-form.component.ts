import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AngularEditorConfig, AngularEditorModule } from '@kolkov/angular-editor';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConduiteService } from '../../../../../../../core/services/conduite.service';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { ToastService } from '../../../../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type LettreFormality = 'confrere' | 'consoeur' | 'colleague';
type LettrePayload = {
  medecin: string;
  formalityKey: LettreFormality | '';
  formulepolitesse: string;
  contenue: string;
};

@Component({
  selector: 'app-consultation-conduite-lettre-confrere-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, AngularEditorModule],
  templateUrl: './consultation-conduite-lettre-confrere-form.component.html',
  styleUrl: './consultation-conduite-lettre-confrere-form.component.css',
})
export class ConsultationConduiteLettreConfrereFormComponent implements OnChanges {
  @Input() consultationId: string | null = null;
  @Input() payload: Record<string, unknown> | null = null;
  @Input() isPrinting = false;
  @Output() payloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() printRequested = new EventEmitter<void>();

  private readonly i18n = inject(I18nService);
  private readonly conduiteService = inject(ConduiteService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected medecin = '';
  protected formulepolitesse = '';
  protected contenue = '';
  protected showGenerateAiModal = false;
  protected lettreAiGeneralDescription = '';
  protected lettreAiCorrectionPrompt = '';
  protected lettreAiPromptRecipient = false;
  protected lettreAiPromptFormality = false;
  protected isQueueingAiGenerate = false;
  protected isQueueingAiCorrect = false;
  protected lettreAiBadgeVisible = false;
  protected lettreAiBadgeText = '';
  protected lettreAiBadgeClass = 'lettre-ai-badge--muted';
  protected formules = {
    consoeur: false,
    confrere: false,
    colleague: false,
  };
  private lastEmittedPayloadSignature = '';
  private lettreAiBadgeTimeoutRef: ReturnType<typeof setTimeout> | null = null;

  protected readonly editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    minHeight: '15rem',
    placeholder: this.i18n.t('consultation.conduite.lettreConfrere.fields.contentPlaceholder'),
    translate: 'yes',
    defaultParagraphSeparator: 'p',
    defaultFontName: 'Segoe UI',
    toolbarHiddenButtons: [
      ['insertImage', 'insertVideo', 'insertHorizontalRule', 'removeFormat', 'toggleEditorMode'],
    ],
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['payload']) {
      return;
    }

    const data = this.payload ?? {};
    const incomingSignature = this.buildPayloadSignature(data);
    if (incomingSignature === this.lastEmittedPayloadSignature) {
      return;
    }

    this.medecin = this.readString(data['medecin']);
    this.contenue = this.readString(data['contenue']);

    const incomingFormule = this.readString(data['formulepolitesse']);
    const incomingFormalityKey = this.readString(data['formalityKey']);
    if (incomingFormalityKey.trim() || incomingFormule.trim()) {
      const incomingFormality = this.resolveFormality(incomingFormalityKey, incomingFormule);
      this.applyFormality(incomingFormality, false);
      this.formulepolitesse = this.getFormalityLabel(incomingFormality);
    } else {
      this.clearFormality();
    }

    this.lastEmittedPayloadSignature = this.buildPayloadSignature({
      medecin: this.medecin,
      formalityKey: this.currentFormalityOrEmpty(),
      formulepolitesse: this.formulepolitesse,
      contenue: this.contenue,
    });
  }

  protected get showAiRecipientField(): boolean {
    return this.lettreAiPromptRecipient;
  }

  protected get showAiFormalityField(): boolean {
    return this.i18n.lang() !== 'en';
  }

  protected get hasAiMissingRecipientOrFormality(): boolean {
    return this.showAiRecipientField || this.showAiFormalityField;
  }

  protected onAiRecipientChange(value: unknown): void {
    this.onMedecinChange(value);
  }

  protected onAiFormalitySelect(type: LettreFormality): void {
    this.onSelect(type);
  }

  protected isFormalityOptionSelected(type: LettreFormality): boolean {
    return this.currentFormalityOrEmpty() === type;
  }

  protected get aiFormalityOptions(): Array<{ type: LettreFormality; labelKey: string }> {
    if (this.showEnglishSingleFormality) {
      return [
        {
          type: 'colleague',
          labelKey: 'consultation.conduite.lettreConfrere.fields.formality.colleague',
        },
      ];
    }

    return [
      {
        type: 'consoeur',
        labelKey: 'consultation.conduite.lettreConfrere.fields.formality.consoeur',
      },
      {
        type: 'confrere',
        labelKey: 'consultation.conduite.lettreConfrere.fields.formality.confrere',
      },
    ];
  }

  protected get showEnglishSingleFormality(): boolean {
    return this.i18n.lang() === 'en';
  }

  protected onSelect(type: LettreFormality): void {
    this.applyFormality(type);
  }

  protected onMedecinChange(value: unknown): void {
    if (typeof value !== 'string') {
      return;
    }

    this.medecin = value;
    this.emitPayloadPatch({ medecin: value });
  }

  protected onContenueChange(value: unknown): void {
    if (typeof value !== 'string') {
      return;
    }

    this.contenue = value;
    this.emitPayloadPatch({ contenue: value });
  }

  protected onPrintClick(): void {
    this.printRequested.emit();
  }

  protected openGenerateAiModal(): void {
    this.lettreAiGeneralDescription = '';
    this.lettreAiPromptRecipient = !this.medecin.trim();
    this.lettreAiPromptFormality = this.i18n.lang() !== 'en' && !this.hasSelectedFormality();
    this.showGenerateAiModal = true;
  }

  protected closeGenerateAiModal(): void {
    this.showGenerateAiModal = false;
    this.lettreAiPromptRecipient = false;
    this.lettreAiPromptFormality = false;
  }

  protected generateLettreConfrereParIa(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    const generalDescription = this.lettreAiGeneralDescription.trim();
    if (!consultationId) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.consultationNotFound'));
      return;
    }

    if (!generalDescription) {
      this.toastService.error(this.i18n.t('consultation.conduite.lettreConfrere.ai.descriptionRequired'));
      return;
    }

    const medecin = this.medecin.trim();
    if (!medecin) {
      this.lettreAiPromptRecipient = true;
      this.toastService.error(this.i18n.t('consultation.conduite.lettreConfrere.ai.recipientRequired'));
      return;
    }

    if (this.i18n.lang() !== 'en' && !this.hasSelectedFormality()) {
      this.lettreAiPromptFormality = true;
      this.toastService.error(this.i18n.t('consultation.conduite.lettreConfrere.ai.formalityRequired'));
      return;
    }

    const formality = this.hasSelectedFormality() ? this.currentFormality() : 'colleague';
    const formulepolitesse = this.formulepolitesse.trim() || this.getFormalityLabel(formality);

    this.isQueueingAiGenerate = true;
    this.conduiteService
      .generateLettreConfrereAi(consultationId, {
        generalDescription,
        medecin,
        contenue: this.contenue.trim(),
        formulepolitesse,
      })
      .pipe(
        finalize(() => {
          this.isQueueingAiGenerate = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.showGenerateAiModal = false;
          this.lettreAiPromptRecipient = false;
          this.lettreAiPromptFormality = false;
          this.setLettreAiBadge(
            this.i18n.t('consultation.conduite.lettreConfrere.ai.generationQueued'),
            'lettre-ai-badge--info',
            0,
          );
          this.toastService.success(this.i18n.t('consultation.conduite.lettreConfrere.ai.queued'));
        },
        error: (error) => {
          this.toastService.error(
            this.extractApiErrorMessage(error)
              || this.i18n.t('consultation.conduite.lettreConfrere.ai.queueFailed'),
          );
        },
      });
  }

  protected correctLettreConfrereParIa(): void {
    const consultationId = this.consultationId?.trim() ?? '';
    const contenue = this.contenue.trim();
    if (!consultationId) {
      this.toastService.error(this.i18n.t('consultation.documents.toast.consultationNotFound'));
      return;
    }

    if (!this.stripHtml(contenue)) {
      this.toastService.error(this.i18n.t('consultation.conduite.lettreConfrere.ai.contentRequired'));
      return;
    }

    this.isQueueingAiCorrect = true;
    this.conduiteService
      .correctLettreConfrereAi(consultationId, {
        contenue,
        correctionPrompt: this.lettreAiCorrectionPrompt.trim(),
        medecin: this.medecin.trim(),
        formulepolitesse: this.formulepolitesse.trim()
          || (this.hasSelectedFormality() ? this.getFormalityLabel(this.currentFormality()) : ''),
      })
      .pipe(
        finalize(() => {
          this.isQueueingAiCorrect = false;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.setLettreAiBadge(
            this.i18n.t('consultation.conduite.lettreConfrere.ai.correctionQueued'),
            'lettre-ai-badge--info',
            0,
          );
          this.toastService.success(this.i18n.t('consultation.conduite.lettreConfrere.ai.queued'));
        },
        error: (error) => {
          this.toastService.error(
            this.extractApiErrorMessage(error)
              || this.i18n.t('consultation.conduite.lettreConfrere.ai.queueFailed'),
          );
        },
      });
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private resolveFormality(rawFormalityKey: string, rawFormule: string): LettreFormality {
    const normalizedFormality = this.normalizeToken(rawFormalityKey);
    if (normalizedFormality.includes('consoeur')) {
      return this.i18n.lang() === 'en' ? 'colleague' : 'consoeur';
    }

    if (normalizedFormality.includes('confrere')) {
      return this.i18n.lang() === 'en' ? 'colleague' : 'confrere';
    }

    if (normalizedFormality.includes('colleague') || normalizedFormality.includes('collegue')) {
      return 'colleague';
    }

    if (rawFormule.includes('زميلتي') || rawFormule.includes('زميلة')) {
      return this.i18n.lang() === 'en' ? 'colleague' : 'consoeur';
    }

    if (rawFormule.includes('زميلي') || rawFormule.includes('زميل')) {
      return this.i18n.lang() === 'en' ? 'colleague' : 'confrere';
    }

    const normalizedFormule = this.normalizeToken(rawFormule);
    if (normalizedFormule.includes('consoeur')) {
      return this.i18n.lang() === 'en' ? 'colleague' : 'consoeur';
    }

    if (normalizedFormule.includes('confrere')) {
      return this.i18n.lang() === 'en' ? 'colleague' : 'confrere';
    }

    if (normalizedFormule.includes('colleague') || normalizedFormule.includes('collegue')) {
      return 'colleague';
    }

    return this.i18n.lang() === 'en' ? 'colleague' : 'confrere';
  }

  private normalizeToken(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private applyFormality(type: LettreFormality, emit = true): void {
    const effectiveType = this.i18n.lang() === 'en' ? 'colleague' : type;

    this.formules = {
      consoeur: effectiveType === 'consoeur',
      confrere: effectiveType === 'confrere',
      colleague: effectiveType === 'colleague',
    };

    this.formulepolitesse = this.getFormalityLabel(effectiveType);

    if (emit) {
      this.emitPayloadPatch({
        formalityKey: this.currentFormality(),
        formulepolitesse: this.formulepolitesse,
      });
    }
  }

  private clearFormality(): void {
    this.formules = {
      consoeur: false,
      confrere: false,
      colleague: false,
    };
    this.formulepolitesse = '';
  }

  private hasSelectedFormality(): boolean {
    return this.formules.consoeur || this.formules.confrere || this.formules.colleague;
  }

  private emitPayloadPatch(patch: Partial<LettrePayload>): void {
    const fullPayload = this.buildCurrentPayload(patch);
    this.lastEmittedPayloadSignature = this.buildPayloadSignature(fullPayload);
    this.payloadChange.emit(fullPayload as Record<string, unknown>);
  }

  private buildCurrentPayload(overrides?: Partial<LettrePayload>): LettrePayload {
    return {
      medecin: overrides?.medecin ?? this.medecin,
      formalityKey: overrides?.formalityKey ?? this.currentFormalityOrEmpty(),
      formulepolitesse: overrides?.formulepolitesse ?? this.formulepolitesse,
      contenue: overrides?.contenue ?? this.contenue,
    };
  }

  private buildPayloadSignature(payload: Record<string, unknown>): string {
    return JSON.stringify({
      medecin: this.readString(payload['medecin']),
      formalityKey: this.readString(payload['formalityKey']).trim().toLowerCase(),
      formulepolitesse: this.readString(payload['formulepolitesse']),
      contenue: this.readString(payload['contenue']),
    });
  }

  private currentFormality(): LettreFormality {
    if (this.formules.colleague || this.i18n.lang() === 'en') {
      return 'colleague';
    }

    return this.formules.consoeur ? 'consoeur' : 'confrere';
  }

  private currentFormalityOrEmpty(): LettreFormality | '' {
    return this.hasSelectedFormality() ? this.currentFormality() : '';
  }

  private getFormalityLabel(type: LettreFormality): string {
    if (this.i18n.lang() === 'en') {
      return this.i18n.t('consultation.conduite.lettreConfrere.fields.formality.colleague');
    }

    if (this.i18n.lang() === 'ar') {
      if (type === 'consoeur') {
        return this.i18n.t('consultation.conduite.lettreConfrere.fields.formality.consoeur');
      }

      return this.i18n.t('consultation.conduite.lettreConfrere.fields.formality.confrere');
    }

    switch (type) {
      case 'consoeur':
        return this.i18n.t('consultation.conduite.lettreConfrere.fields.formality.consoeur');
      case 'colleague':
        return this.i18n.t('consultation.conduite.lettreConfrere.fields.formality.colleague');
      default:
        return this.i18n.t('consultation.conduite.lettreConfrere.fields.formality.confrere');
    }
  }

  private setLettreAiBadge(text: string, badgeClass: string, autoHideMs: number): void {
    this.lettreAiBadgeText = text;
    this.lettreAiBadgeClass = badgeClass;
    this.lettreAiBadgeVisible = true;

    if (this.lettreAiBadgeTimeoutRef) {
      clearTimeout(this.lettreAiBadgeTimeoutRef);
      this.lettreAiBadgeTimeoutRef = null;
    }

    if (autoHideMs > 0) {
      this.lettreAiBadgeTimeoutRef = setTimeout(() => {
        this.lettreAiBadgeVisible = false;
      }, autoHideMs);
    }
  }

  private extractApiErrorMessage(error: unknown): string {
    const maybeError = error as { error?: unknown; message?: unknown };
    if (typeof maybeError?.error === 'string') {
      return maybeError.error.trim();
    }

    if (maybeError?.error && typeof maybeError.error === 'object') {
      const nested = maybeError.error as { message?: unknown };
      if (typeof nested.message === 'string') {
        return nested.message.trim();
      }
    }

    return typeof maybeError?.message === 'string' ? maybeError.message.trim() : '';
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
