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
  selector: 'app-consultation-examen-abdomen',
  standalone: true,
  imports: [CommonModule, ConsultationExamenSpecificFindingsCardComponent],
  template: `
    <app-consultation-examen-specific-findings-card
      [titleKey]="'consultation.page.exam.specific.abdomen.title'"
      [sectionKey]="'abdomen'"
      [value]="value"
      [catalog]="catalog"
      (valueChange)="valueChange.emit($event)"
      (customFindingCreate)="customFindingCreate.emit($event)"
    />
  `,
})
export class ConsultationExamenAbdomenComponent {
  @Input() value: SpecificExamSectionData = createDefaultSpecificExamSectionData();
  @Input() catalog: ExamFindingCatalogItem[] = [];
  @Output() valueChange = new EventEmitter<SpecificExamSectionData>();
  @Output() customFindingCreate = new EventEmitter<CustomFindingCreateEvent>();
}

