import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

type VisionPayload = {
  acuiteVisuelSansCorrection: string;
  acuiteVisuelAvecCorrection: string;
  acuiteVisuelBinoculaire: string;
};

@Component({
  selector: 'app-consultation-conduite-certificat-aptitude-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultation-conduite-certificat-aptitude-form.component.html',
  styleUrl: './consultation-conduite-certificat-aptitude-form.component.css',
})
export class ConsultationConduiteCertificatAptitudeFormComponent implements OnChanges {
  @Input() payload: Record<string, unknown> | null = null;
  @Output() payloadChange = new EventEmitter<Record<string, unknown>>();

  protected oeilDroit: VisionPayload = this.createEmptyVisionPayload();
  protected oeilGauche: VisionPayload = this.createEmptyVisionPayload();
  protected informationAdditionnel = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['payload']) {
      return;
    }

    const data = this.payload ?? {};
    this.oeilDroit = this.readVisionPayload(data['oeilDroit']);
    this.oeilGauche = this.readVisionPayload(data['oeilGauche']);
    this.informationAdditionnel = this.readString(data['informationAdditionnel']);
  }

  protected onFieldChange(): void {
    this.payloadChange.emit({
      oeilDroit: {
        acuiteVisuelSansCorrection: this.oeilDroit.acuiteVisuelSansCorrection.trim(),
        acuiteVisuelAvecCorrection: this.oeilDroit.acuiteVisuelAvecCorrection.trim(),
        acuiteVisuelBinoculaire: this.oeilDroit.acuiteVisuelBinoculaire.trim(),
      },
      oeilGauche: {
        acuiteVisuelSansCorrection: this.oeilGauche.acuiteVisuelSansCorrection.trim(),
        acuiteVisuelAvecCorrection: this.oeilGauche.acuiteVisuelAvecCorrection.trim(),
        acuiteVisuelBinoculaire: this.oeilGauche.acuiteVisuelBinoculaire.trim(),
      },
      informationAdditionnel: this.informationAdditionnel.trim(),
    });
  }

  private readVisionPayload(value: unknown): VisionPayload {
    if (!value || typeof value !== 'object') {
      return this.createEmptyVisionPayload();
    }

    const typedValue = value as Record<string, unknown>;
    return {
      acuiteVisuelSansCorrection: this.readString(typedValue['acuiteVisuelSansCorrection']),
      acuiteVisuelAvecCorrection: this.readString(typedValue['acuiteVisuelAvecCorrection']),
      acuiteVisuelBinoculaire: this.readString(typedValue['acuiteVisuelBinoculaire']),
    };
  }

  private createEmptyVisionPayload(): VisionPayload {
    return {
      acuiteVisuelSansCorrection: '',
      acuiteVisuelAvecCorrection: '',
      acuiteVisuelBinoculaire: '',
    };
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
