import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../core/models/interrogatoire.models';
import { TranslatePipe } from '../../../../../../shared/pipes/translate.pipe';
import { ConsultationInterrogatoireAntecedentsGenerauxComponent } from './components/consultation-interrogatoire-antecedents-generaux.component';
import { ConsultationInterrogatoireAntecedentsFamiliauxComponent } from './components/consultation-interrogatoire-antecedents-familiaux.component';
import { ConsultationInterrogatoireHistoireMaladieComponent } from './components/consultation-interrogatoire-histoire-maladie.component';
import { ConsultationInterrogatoireSignesFonctionnelsComponent } from './components/consultation-interrogatoire-signes-fonctionnels.component';
import { ConsultationInterrogatoireTraitementEnCoursComponent } from './components/consultation-interrogatoire-traitement-en-cours.component';

@Component({
  selector: 'app-consultation-interrogatoire-section',
  standalone: true,
  imports: [
    CommonModule,
    ConsultationInterrogatoireAntecedentsGenerauxComponent,
    ConsultationInterrogatoireSignesFonctionnelsComponent,
    ConsultationInterrogatoireAntecedentsFamiliauxComponent,
    ConsultationInterrogatoireHistoireMaladieComponent,
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
  @Input() histoireMaladie = '';
  @Input() ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[] = [];
  @Input() canAccessExam = false;
  @Output() anomaliesChange = new EventEmitter<UpdateInterrogatoireAnomalyRequest[]>();
  @Output() histoireMaladieChange = new EventEmitter<string>();
  @Output() ongoingTreatmentsChange = new EventEmitter<UpdateOngoingTreatmentMedicineRequest[]>();
  @Output() navigateToExam = new EventEmitter<void>();

  private medicalAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private functionalSignsAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private familyAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];
  private passthroughAnomalies: UpdateInterrogatoireAnomalyRequest[] = [];

  protected get medicalSectionAnomalies(): UpdateInterrogatoireAnomalyRequest[] {
    return this.medicalAnomalies;
  }

  protected get functionalSignsSectionAnomalies(): UpdateInterrogatoireAnomalyRequest[] {
    return this.functionalSignsAnomalies;
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

  protected onFunctionalSignsAnomaliesChange(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.functionalSignsAnomalies = this.normalizeAnomaliesForSection(anomalies, 'medical');
    this.emitCombinedAnomalies();
  }

  protected onFamilyAnomaliesChange(anomalies: UpdateInterrogatoireAnomalyRequest[]): void {
    this.familyAnomalies = this.normalizeAnomaliesForSection(anomalies, 'family');
    this.emitCombinedAnomalies();
  }

  protected onOngoingTreatmentsChange(treatments: UpdateOngoingTreatmentMedicineRequest[]): void {
    this.ongoingTreatmentsChange.emit(treatments ?? []);
  }

  protected onHistoireMaladieChange(value: string): void {
    this.histoireMaladieChange.emit(value ?? '');
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
        (item) => item.section === 'medical' && !this.isFunctionalSignAnomaly(item),
      ),
      'medical',
    );
    this.functionalSignsAnomalies = this.normalizeAnomaliesForSection(
      incoming.filter(
        (item) => item.section === 'medical' && this.isFunctionalSignAnomaly(item),
      ),
      'medical',
    );
    this.familyAnomalies = this.normalizeAnomaliesForSection(
      incoming.filter((item) => item.section === 'family'),
      'family',
    );
    this.passthroughAnomalies = incoming
      .filter((item) => item.section !== 'medical' && item.section !== 'family')
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

  private emitCombinedAnomalies(): void {
    const combined = [
      ...this.medicalAnomalies,
      ...this.functionalSignsAnomalies,
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
}
