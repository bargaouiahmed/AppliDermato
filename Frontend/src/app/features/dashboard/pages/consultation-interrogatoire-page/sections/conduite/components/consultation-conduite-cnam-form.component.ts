import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type CnamFormType = 'ap1' | 'ap2' | 'ap3' | 'ap4' | 'apci';

type CnamFormTypeOption = {
  value: CnamFormType;
  labelKey: string;
};

type Ap1MedicationLine = {
  code: string;
  designation: string;
  posologie: string;
  dureeTraitement: string;
};

type Ap1Payload = {
  codeConventionnel: string;
  medicationLines: Ap1MedicationLine[];
  clinique: string;
  diagnostic: string;
  donneesCliniquesParacliniques: string;
};

type Ap2Payload = {
  clinique: string;
  diagnostic: string;
  therapeutique: string;
  natureExamen: string;
  dateExamen: string;
};

type Ap3Payload = {
  donneesCliniquesParacliniques: string;
  diagnostics: string;
};

type Ap4Payload = {
  pathologieOrigine: string;
  traitement: string;
  etatSante: string;
  bilanFonctionnel: string;
  prolongation: string;
};

type ApciPayload = {
  diagnostic: string;
  observation: string;
};

@Component({
  selector: 'app-consultation-conduite-cnam-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './consultation-conduite-cnam-form.component.html',
  styleUrl: './consultation-conduite-cnam-form.component.css',
})
export class ConsultationConduiteCnamFormComponent implements OnChanges {
  @Input() payload: Record<string, unknown> | null = null;
  @Input() clinicOptions: string[] = [];
  @Input() isPrinting = false;
  @Output() payloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() printRequested = new EventEmitter<void>();

  protected readonly formTypeOptions: CnamFormTypeOption[] = [
    { value: 'ap1', labelKey: 'consultation.conduite.cnam.types.ap1' },
    { value: 'ap2', labelKey: 'consultation.conduite.cnam.types.ap2' },
    { value: 'ap3', labelKey: 'consultation.conduite.cnam.types.ap3' },
    { value: 'ap4', labelKey: 'consultation.conduite.cnam.types.ap4' },
    { value: 'apci', labelKey: 'consultation.conduite.cnam.types.apci' },
  ];

  protected selectedFormType: CnamFormType = 'ap1';
  protected ap1: Ap1Payload = this.createDefaultAp1Payload();
  protected ap2: Ap2Payload = this.createDefaultAp2Payload();
  protected ap3: Ap3Payload = this.createDefaultAp3Payload();
  protected ap4: Ap4Payload = this.createDefaultAp4Payload();
  protected apci: ApciPayload = this.createDefaultApciPayload();

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['payload']) {
      return;
    }

    const data = this.readObject(this.payload);
    this.selectedFormType = this.resolveFormType(data['selectedFormType']);
    this.ap1 = this.readAp1Payload(data['ap1']);
    this.ap2 = this.readAp2Payload(data['ap2']);
    this.ap3 = this.readAp3Payload(data['ap3']);
    this.ap4 = this.readAp4Payload(data['ap4']);
    this.apci = this.readApciPayload(data['apci']);
  }

  protected onSelectedFormTypeChange(value: unknown): void {
    this.selectedFormType = this.resolveFormType(value);
    this.emitPayload();
  }

  protected onFieldChange(): void {
    this.emitPayload();
  }

  protected addMedicationLine(): void {
    this.ap1 = {
      ...this.ap1,
      medicationLines: [...this.ap1.medicationLines, this.createDefaultMedicationLine()],
    };
    this.emitPayload();
  }

  protected removeMedicationLine(index: number): void {
    const remainingLines = this.ap1.medicationLines.filter((_, currentIndex) => currentIndex !== index);
    this.ap1 = {
      ...this.ap1,
      medicationLines: remainingLines.length > 0 ? remainingLines : [this.createDefaultMedicationLine()],
    };
    this.emitPayload();
  }

  protected trackMedicationLine(index: number): number {
    return index;
  }

  protected onPrintClick(): void {
    this.printRequested.emit();
  }

  private emitPayload(): void {
    this.payloadChange.emit({
      selectedFormType: this.selectedFormType,
      ap1: this.normalizeAp1Payload(this.ap1),
      ap2: this.normalizeAp2Payload(this.ap2),
      ap3: this.normalizeAp3Payload(this.ap3),
      ap4: this.normalizeAp4Payload(this.ap4),
      apci: this.normalizeApciPayload(this.apci),
    });
  }

  private resolveFormType(value: unknown): CnamFormType {
    const normalized = this.readText(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'ap2') {
      return 'ap2';
    }

    if (normalized === 'ap3') {
      return 'ap3';
    }

    if (normalized === 'ap4') {
      return 'ap4';
    }

    if (normalized === 'apci') {
      return 'apci';
    }

    return 'ap1';
  }

  private readAp1Payload(value: unknown): Ap1Payload {
    const data = this.readObject(value);
    const medicationLines = this.readAp1MedicationLines(data);

    return {
      codeConventionnel: this.readText(data['codeConventionnel']),
      medicationLines: medicationLines.length > 0 ? medicationLines : [this.createDefaultMedicationLine()],
      clinique: this.readText(data['clinique']),
      diagnostic: this.readText(data['diagnostic']),
      donneesCliniquesParacliniques: this.readText(data['donneesCliniquesParacliniques']),
    };
  }

  private readAp1MedicationLines(data: Record<string, unknown>): Ap1MedicationLine[] {
    const rawLines = this.readArray(data['medicationLines'])
      .map((item) => this.readMedicationLine(item))
      .filter((item) => this.isMedicationLineMeaningful(item));

    if (rawLines.length > 0) {
      return rawLines;
    }

    const legacyLine = this.readMedicationLine(data);
    return this.isMedicationLineMeaningful(legacyLine) ? [legacyLine] : [];
  }

  private readMedicationLine(value: unknown): Ap1MedicationLine {
    const data = this.readObject(value);
    return {
      code: this.readText(data['code']),
      designation: this.readText(data['designation']),
      posologie: this.readText(data['posologie']),
      dureeTraitement: this.readText(data['dureeTraitement']),
    };
  }

  private readAp2Payload(value: unknown): Ap2Payload {
    const data = this.readObject(value);
    return {
      clinique: this.readText(data['clinique']),
      diagnostic: this.readText(data['diagnostic']),
      therapeutique: this.readText(data['therapeutique']),
      natureExamen: this.readText(data['natureExamen']),
      dateExamen: this.readText(data['dateExamen']),
    };
  }

  private readAp3Payload(value: unknown): Ap3Payload {
    const data = this.readObject(value);
    return {
      donneesCliniquesParacliniques: this.readText(data['donneesCliniquesParacliniques']),
      diagnostics: this.readText(data['diagnostics']),
    };
  }

  private readAp4Payload(value: unknown): Ap4Payload {
    const data = this.readObject(value);
    return {
      pathologieOrigine: this.readText(data['pathologieOrigine']),
      traitement: this.readText(data['traitement']),
      etatSante: this.readText(data['etatSante']),
      bilanFonctionnel: this.readText(data['bilanFonctionnel']),
      prolongation: this.readText(data['prolongation']),
    };
  }

  private readApciPayload(value: unknown): ApciPayload {
    const data = this.readObject(value);
    return {
      diagnostic: this.readText(data['diagnostic']),
      observation: this.readText(data['observation']),
    };
  }

  private normalizeAp1Payload(value: Ap1Payload): Ap1Payload {
    const medicationLines = value.medicationLines
      .map((line) => ({
        code: this.normalizeSingleLineText(line.code),
        designation: this.normalizeSingleLineText(line.designation),
        posologie: this.normalizeSingleLineText(line.posologie),
        dureeTraitement: this.normalizeSingleLineText(line.dureeTraitement),
      }))
      .filter((line) => this.isMedicationLineMeaningful(line));

    return {
      codeConventionnel: this.normalizeSingleLineText(value.codeConventionnel),
      medicationLines,
      clinique: this.normalizeMultilineText(value.clinique),
      diagnostic: this.normalizeMultilineText(value.diagnostic),
      donneesCliniquesParacliniques: this.normalizeMultilineText(value.donneesCliniquesParacliniques),
    };
  }

  private normalizeAp2Payload(value: Ap2Payload): Ap2Payload {
    return {
      clinique: this.normalizeSingleLineText(value.clinique),
      diagnostic: this.normalizeMultilineText(value.diagnostic),
      therapeutique: this.normalizeMultilineText(value.therapeutique),
      natureExamen: this.normalizeSingleLineText(value.natureExamen),
      dateExamen: this.normalizeSingleLineText(value.dateExamen),
    };
  }

  private normalizeAp3Payload(value: Ap3Payload): Ap3Payload {
    return {
      donneesCliniquesParacliniques: this.normalizeMultilineText(value.donneesCliniquesParacliniques),
      diagnostics: this.normalizeMultilineText(value.diagnostics),
    };
  }

  private normalizeAp4Payload(value: Ap4Payload): Ap4Payload {
    return {
      pathologieOrigine: this.normalizeMultilineText(value.pathologieOrigine),
      traitement: this.normalizeMultilineText(value.traitement),
      etatSante: this.normalizeMultilineText(value.etatSante),
      bilanFonctionnel: this.normalizeMultilineText(value.bilanFonctionnel),
      prolongation: this.normalizeMultilineText(value.prolongation),
    };
  }

  private normalizeApciPayload(value: ApciPayload): ApciPayload {
    return {
      diagnostic: this.normalizeMultilineText(value.diagnostic),
      observation: this.normalizeMultilineText(value.observation),
    };
  }

  private isMedicationLineMeaningful(line: Ap1MedicationLine): boolean {
    return !!(
      this.normalizeSingleLineText(line.code) ||
      this.normalizeSingleLineText(line.designation) ||
      this.normalizeSingleLineText(line.posologie) ||
      this.normalizeSingleLineText(line.dureeTraitement)
    );
  }

  private readObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private readText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return '';
  }

  private normalizeSingleLineText(value: unknown): string {
    return this.readText(value).trim().replace(/\s+/g, ' ');
  }

  private normalizeMultilineText(value: unknown): string {
    return this.readText(value).replace(/\r\n/g, '\n').trim();
  }

  private createDefaultMedicationLine(): Ap1MedicationLine {
    return {
      code: '',
      designation: '',
      posologie: '',
      dureeTraitement: '',
    };
  }

  private createDefaultAp1Payload(): Ap1Payload {
    return {
      codeConventionnel: '',
      medicationLines: [this.createDefaultMedicationLine()],
      clinique: '',
      diagnostic: '',
      donneesCliniquesParacliniques: '',
    };
  }

  private createDefaultAp2Payload(): Ap2Payload {
    return {
      clinique: '',
      diagnostic: '',
      therapeutique: '',
      natureExamen: '',
      dateExamen: '',
    };
  }

  private createDefaultAp3Payload(): Ap3Payload {
    return {
      donneesCliniquesParacliniques: '',
      diagnostics: '',
    };
  }

  private createDefaultAp4Payload(): Ap4Payload {
    return {
      pathologieOrigine: '',
      traitement: '',
      etatSante: '',
      bilanFonctionnel: '',
      prolongation: '',
    };
  }

  private createDefaultApciPayload(): ApciPayload {
    return {
      diagnostic: '',
      observation: '',
    };
  }
}
