import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EtatGeneralValue } from '../../../../../../../../core/models/exam.models';
import { TranslatePipe } from '../../../../../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-consultation-examen-etat-general-field',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="exam-card">
      <h3>{{ 'consultation.page.exam.general.etatGeneral.title' | translate }}</h3>
      <select
        class="form-control compact-select"
        [value]="value"
        (change)="onValueChange($any($event.target).value)"
      >
        <option value="">{{ 'consultation.page.exam.general.selectPlaceholder' | translate }}</option>
        <option value="good">{{ 'consultation.page.exam.general.etatGeneral.good' | translate }}</option>
        <option value="average">{{ 'consultation.page.exam.general.etatGeneral.average' | translate }}</option>
        <option value="altered">{{ 'consultation.page.exam.general.etatGeneral.altered' | translate }}</option>
      </select>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 100%;
        height: 100%;
      }

      .exam-card {
        border: 1px solid #ddd6ca;
        border-radius: 0.35rem;
        background: rgba(200, 149, 104, 0.16);
        padding: 0.7rem 0.72rem 0.72rem;
        inline-size: 11rem;
        max-inline-size: 100%;
        block-size: 8.45rem;
        display: flex;
        flex-direction: column;
      }

      .exam-card h3 {
        margin: 0 0 0.5rem;
        color: #175042;
        font-size: 1.05rem;
        font-weight: 700;
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .exam-card .form-control {
        min-height: 2rem;
        margin-top: auto;
      }

      .compact-select {
        inline-size: 100%;
      }
    `,
  ],
})
export class ConsultationExamenEtatGeneralFieldComponent {
  @Input() value: EtatGeneralValue = '';
  @Output() valueChange = new EventEmitter<EtatGeneralValue>();

  protected onValueChange(next: string): void {
    if (next === 'good' || next === 'average' || next === 'altered') {
      this.valueChange.emit(next);
      return;
    }

    this.valueChange.emit('');
  }
}

