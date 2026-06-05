import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ExamFindingCatalogItem,
  SpecificExamSectionData,
  SpecificExamSectionKey,
  SpecificExamSections,
  createDefaultSpecificExamSections,
} from '../../../../../../../core/models/exam.models';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';
import { ConsultationExamenAbdomenComponent } from './specific/consultation-examen-abdomen.component';
import { ConsultationExamenAuscultationCardiaqueComponent } from './specific/consultation-examen-auscultation-cardiaque.component';
import { ConsultationExamenAuscultationPulmonaireComponent } from './specific/consultation-examen-auscultation-pulmonaire.component';
import { ConsultationExamenLocomoteurOsteoArticulaireComponent } from './specific/consultation-examen-locomoteur-osteo-articulaire.component';
import { ConsultationExamenNeurologiqueComponent } from './specific/consultation-examen-neurologique.component';
import { ConsultationExamenOrlCouConjonctiveComponent } from './specific/consultation-examen-orl-cou-conjonctive.component';
import { ConsultationExamenPeauDermatologiqueComponent } from './specific/consultation-examen-peau-dermatologique.component';
import { ConsultationExamenUrogenitalComponent } from './specific/consultation-examen-urogenital.component';

type SectionChangeEvent = {
  section: SpecificExamSectionKey;
  data: SpecificExamSectionData;
};

type CustomFindingCreateEvent = {
  section: SpecificExamSectionKey;
  label: string;
};

@Component({
  selector: 'app-consultation-examen-specific-section',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ConsultationExamenOrlCouConjonctiveComponent,
    ConsultationExamenAuscultationCardiaqueComponent,
    ConsultationExamenAuscultationPulmonaireComponent,
    ConsultationExamenAbdomenComponent,
    ConsultationExamenNeurologiqueComponent,
    ConsultationExamenLocomoteurOsteoArticulaireComponent,
    ConsultationExamenPeauDermatologiqueComponent,
    ConsultationExamenUrogenitalComponent,
  ],
  templateUrl: './consultation-examen-specific-section.component.html',
  styleUrl: './consultation-examen-specific-section.component.css',
})
export class ConsultationExamenSpecificSectionComponent {
  @Input() sections: SpecificExamSections = createDefaultSpecificExamSections();
  @Input() catalogBySection: Record<SpecificExamSectionKey, ExamFindingCatalogItem[]> = {
    orlCouConjonctive: [],
    auscultationCardiaque: [],
    auscultationPulmonaire: [],
    abdomen: [],
    neurologique: [],
    locomoteurOsteoArticulaire: [],
    peauDermatologique: [],
    urogenital: [],
  };

  @Output() sectionChange = new EventEmitter<SectionChangeEvent>();
  @Output() customFindingCreate = new EventEmitter<CustomFindingCreateEvent>();

  protected onSectionValueChange(section: SpecificExamSectionKey, data: SpecificExamSectionData): void {
    this.sectionChange.emit({ section, data });
  }

  protected onCustomFindingCreate(section: SpecificExamSectionKey, event: CustomFindingCreateEvent): void {
    this.customFindingCreate.emit({
      section,
      label: event.label,
    });
  }
}

