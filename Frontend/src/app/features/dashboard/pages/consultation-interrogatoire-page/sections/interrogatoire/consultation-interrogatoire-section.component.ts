import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../core/models/interrogatoire.models';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { ConsultationInterrogatoireAntecedentsGenerauxComponent } from './components/consultation-interrogatoire-antecedents-generaux.component';
import { ConsultationInterrogatoireAntecedentsFamiliauxComponent } from './components/consultation-interrogatoire-antecedents-familiaux.component';
import { ConsultationInterrogatoireAntecedentsDermatologiquesComponent } from './components/consultation-interrogatoire-antecedents-dermatologiques.component';
import { ConsultationInterrogatoireTraitementEnCoursComponent } from './components/consultation-interrogatoire-traitement-en-cours.component';

@Component({
  selector: 'app-consultation-interrogatoire-section',
  standalone: true,
  imports: [
    CommonModule,
    ConsultationInterrogatoireAntecedentsGenerauxComponent,
    ConsultationInterrogatoireAntecedentsDermatologiquesComponent,
    ConsultationInterrogatoireAntecedentsFamiliauxComponent,
    ConsultationInterrogatoireTraitementEnCoursComponent,
    TranslatePipe,
  ],
  templateUrl: './consultation-interrogatoire-section.component.html',
  styleUrl: './consultation-interrogatoire-section.component.css',
})
export class ConsultationInterrogatoireSectionComponent implements OnChanges {
  @Input() consultationId: string | null = null;
  @Input() motifs: string[] = [];
  @Input() selectedMotif: string | null = null;
  @Input() anomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  @Input() ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Input() canAccessExam = false;
  @Output() anomaliesChange = new EventEmitter<UpdateInterrogatoireAnomalyRequest[]>();
  @Output() ongoingTreatmentsChange = new EventEmitter<UpdateOngoingTreatmentMedicineRequest[]>();
  @Output() navigateToExam = new EventEmitter<void>();

  private medicalAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private dermatologicAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private familyAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private passthroughAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];

  protected get medicalSectionAnomalies(): UpdateInterrogatoireAnomalyRequest[] {
    return this.medicalAnomalies;
  }

  protected get dermatologicSectionAnomalies(): UpdateInterrogatoireAnomalyRequest[] {
    return this.dermatologicAnomalies;
  }

  protected get familySectionAnomalies(): UpdateInterrogatoireAnomalyRequest[] {
    return this.familyAnomalies;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['anomalies']) {
      this.syncManagedAnomalyBuckets();
    }
  }

  protected onMedicalAnomaliesChange(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.medicalAnomalies = this.normalizeAnomaliesForSection(anomalies, 'medical');
    this.emitCombinedAnomalies();
  }

  protected onDermatologicAnomaliesChange(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.dermatologicAnomalies = this.normalizeManagedAnomalies(anomalies);
    this.emitCombinedAnomalies();
  }

  protected onFamilyAnomaliesChange(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.familyAnomalies = this.normalizeAnomaliesForSection(anomalies, 'family');
    this.emitCombinedAnomalies();
  }

  protected onOngoingTreatmentsChange(treatments: UpdateOngoingTreatmentMedicineRequest[]): void {
    this.ongoingTreatmentsChange.emit(treatments ?? []);
  }

  protected goToExam(): void {
    if (!this.canAccessExam) {
      return;
    }

    this.navigateToExam.emit();
  }

  private syncManagedAnomalyBuckets(): void {
    const incoming = [...(this.anomalies ?? [])];
    this.medicalAnomalies = this.normalizeAnomaliesForSection(
      incoming.filter(
        (item) => item.section === 'medical' && !this.isFunctionalSignAnomaly(item) && !this.isDermatologicAnomaly(item),
      ),
      'medical',
    );
    this.dermatologicAnomalies = this.normalizeManagedAnomalies(
      incoming.filter((item) => this.isDermatologicAnomaly(item)),
    );
    this.familyAnomalies = this.normalizeAnomaliesForSection(
      incoming.filter((item) => item.section === 'family'),
      'family',
    );
    this.passthroughAnomalies = incoming
      .filter((item) => item.section !== 'medical' && item.section !== 'family' && !this.isDermatologicAnomaly(item))
      .map((item, index) => ({
        ...item,
        sortOrder: index,
      }));
  }

  private normalizeAnomaliesForSection(
    anomalies: UpdateInterrogatoireAnomalyRequest[] | null | undefined,
    section: 'medical' | 'family',
  ): UpdateInterrogatoireAnomalyRequest[] {
    return [...(anomalies ?? [])].map((item, index) => ({
      ...item,
      section,
      sortOrder: index,
      payload: item.payload ?? {},
    }));
  }

  private normalizeManagedAnomalies(
    anomalies: UpdateInterrogatoireAnomalyRequest[] | null | undefined,
  ): UpdateInterrogatoireAnomalyRequest[] {
    return [...(anomalies ?? [])].map((item, index) => ({
      ...item,
      sortOrder: index,
      payload: item.payload ?? {},
    }));
  }

  private emitCombinedAnomalies(): void {
    const combined = [
      ...this.medicalAnomalies,
      ...this.dermatologicAnomalies,
      ...this.familyAnomalies,
      ...this.passthroughAnomalies,
    ].map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    this.anomaliesChange.emit(combined);
  }

  private isFunctionalSignAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
    const templateKey = (item.templateKey ?? '').trim().toLowerCase();
    return templateKey.startsWith('functional-sign-');
  }

  private isDermatologicAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
    const templateKey = (item.templateKey ?? '').trim().toLowerCase();
    if (templateKey.startsWith('dermatologic-antecedent-')) {
      return true;
    }

    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const category = typeof payload['category'] === 'string' ? payload['category'].trim().toLowerCase() : '';
    return category === 'laser' || category === 'surgical' || category === 'general';
  }
}
