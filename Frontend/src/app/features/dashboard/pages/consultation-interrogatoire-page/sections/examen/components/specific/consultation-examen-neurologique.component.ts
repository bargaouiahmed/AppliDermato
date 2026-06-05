import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ExamFindingCatalogItem,
  SpecificExamSectionData,
  SpecificExamSectionKey,
  createDefaultSpecificExamSectionData,
} from '../../../../../../../../core/models/exam.models';
import { ConsultationExamenSpecificFindingsCardComponent } from './consultation-examen-specific-findings-card.component';

type CustomFindingCreateEvent = { section: SpecificExamSectionKey; label: string };

@Component({
  selector: 'app-consultation-examen-neurologique',
  standalone: true,
  imports: [CommonModule, ConsultationExamenSpecificFindingsCardComponent],
  template: `
    <app-consultation-examen-specific-findings-card
      [titleKey]="'consultation.page.exam.specific.neurologique.title'"
      [sectionKey]="'neurologique'"
      [value]="value"
      [catalog]="catalog"
      (valueChange)="valueChange.emit($event)"
      (customFindingCreate)="customFindingCreate.emit($event)"
    />
  `,
})
export class ConsultationExamenNeurologiqueComponent {
  @Input() value: SpecificExamSectionData = createDefaultSpecificExamSectionData();
  @Input() catalog: ExamFindingCatalogItem[] = [];
  @Output() valueChange = new EventEmitter<SpecificExamSectionData>();
  @Output() customFindingCreate = new EventEmitter<CustomFindingCreateEvent>();
}

