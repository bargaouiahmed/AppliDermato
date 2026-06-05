import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

type CertificateTypeOption = {
  value: string;
  labelKey: string;
};

const CERTIFICATE_TYPE_REST = 'Certificat medical de repos';
const CERTIFICATE_TYPE_PRESENCE = 'Certificat medical de presence';
const CERTIFICATE_TYPE_ACCOMPANIMENT = "Certificat d'accompagnement";

@Component({
  selector: 'app-consultation-conduite-certificat-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './consultation-conduite-certificat-form.component.html',
  styleUrl: './consultation-conduite-certificat-form.component.css',
})
export class ConsultationConduiteCertificatFormComponent implements OnChanges {
  @Input() payload: Record<string, unknown> | null = null;
  @Input() isPrinting = false;
  @Output() payloadChange = new EventEmitter<Record<string, unknown>>();
  @Output() printRequested = new EventEmitter<void>();

  protected readonly typeOptions: CertificateTypeOption[] = [
    {
      value: CERTIFICATE_TYPE_REST,
      labelKey: 'consultation.conduite.certificat.types.rest',
    },
    {
      value: CERTIFICATE_TYPE_ACCOMPANIMENT,
      labelKey: 'consultation.conduite.certificat.types.accompaniment',
    },
    {
      value: CERTIFICATE_TYPE_PRESENCE,
      labelKey: 'consultation.conduite.certificat.types.presence',
    },
  ];

  protected selectedType = CERTIFICATE_TYPE_REST;
  protected nombre = '';
  protected compterDe = '';
  protected dateCertificat = '';
  protected description = '';
  protected civiliteAccompagnant = '';
  protected nomPrenomAccompagnant = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['payload']) {
      return;
    }

    const data = this.payload ?? {};
    this.selectedType = this.resolveCertificateType(data['types']);
    this.nombre = this.readText(data['nombre']);
    this.compterDe = this.readText(data['compterDe']);
    this.dateCertificat = this.readText(data['dateCertificat']);
    this.description = this.readText(data['description']);
    this.civiliteAccompagnant = this.readText(data['civiliteAccompagnant']);
    this.nomPrenomAccompagnant = this.readText(data['nomPrenomAccompagnant']);
  }

  protected get isRestType(): boolean {
    return this.selectedType === CERTIFICATE_TYPE_REST;
  }

  protected get isPresenceType(): boolean {
    return this.selectedType === CERTIFICATE_TYPE_PRESENCE;
  }

  protected get isAccompanimentType(): boolean {
    return this.selectedType === CERTIFICATE_TYPE_ACCOMPANIMENT;
  }

  protected get hasDateField(): boolean {
    return !this.isAccompanimentType;
  }

  protected get hasDescriptionField(): boolean {
    return !this.isAccompanimentType && !this.isPresenceType;
  }

  protected onTypeChange(value: unknown): void {
    this.selectedType = this.resolveCertificateType(value);

    if (this.isAccompanimentType) {
      this.nombre = '';
      this.compterDe = '';
      this.dateCertificat = '';
      this.description = '';
    } else if (this.isPresenceType) {
      this.nombre = '';
      this.compterDe = '';
      this.civiliteAccompagnant = '';
      this.nomPrenomAccompagnant = '';
      this.description = '';
    } else {
      this.civiliteAccompagnant = '';
      this.nomPrenomAccompagnant = '';
    }

    this.onFieldChange();
  }

  protected onFieldChange(): void {
    this.payloadChange.emit({
      types: this.selectedType,
      nombre: this.isRestType ? this.normalizeText(this.nombre) : '',
      compterDe: this.isRestType ? this.normalizeText(this.compterDe) : '',
      dateCertificat: this.hasDateField ? this.normalizeText(this.dateCertificat) : '',
      description: this.hasDescriptionField ? this.normalizeText(this.description) : '',
      civiliteAccompagnant: this.isAccompanimentType
        ? this.normalizeText(this.civiliteAccompagnant)
        : '',
      nomPrenomAccompagnant: this.isAccompanimentType
        ? this.normalizeText(this.nomPrenomAccompagnant)
        : '',
    });
  }

  protected onPrintClick(): void {
    this.printRequested.emit();
  }

  private resolveCertificateType(value: unknown): string {
    const normalized = this.normalizeTypeToken(this.readText(value));

    if (!normalized) {
      return CERTIFICATE_TYPE_REST;
    }

    if (normalized.includes('accompagnement')) {
      return CERTIFICATE_TYPE_ACCOMPANIMENT;
    }

    if (normalized.includes('presence')) {
      return CERTIFICATE_TYPE_PRESENCE;
    }

    if (normalized.includes('repos')) {
      return CERTIFICATE_TYPE_REST;
    }

    return CERTIFICATE_TYPE_REST;
  }

  private normalizeTypeToken(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  }

  private normalizeText(value: unknown): string {
    return this.readText(value).trim();
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
}
