import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../../../../../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-consultation-examen-imc-field',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="exam-card">
      <h3>{{ 'consultation.page.exam.general.imc.title' | translate }}</h3>
      <div class="imc-value">{{ value ?? '-' }}</div>
      <div class="imc-category">{{ getImcCategoryKey() | translate }}</div>
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
        inline-size: 8rem;
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

      .imc-value {
        margin-top: auto;
        font-size: 1.35rem;
        font-weight: 700;
        color: #175042;
        line-height: 1.1;
      }

      .imc-category {
        margin-top: 0.25rem;
        font-size: 0.88rem;
        color: #495057;
      }
    `,
  ],
})
export class ConsultationExamenImcFieldComponent {
  @Input() value: number | null = null;

  protected getImcCategoryKey(): string {
    const imc = this.value;
    if (imc === null || !Number.isFinite(imc)) {
      return 'consultation.page.exam.general.imc.category.none';
    }

    if (imc < 18.5) {
      return 'consultation.page.exam.general.imc.category.low';
    }

    if (imc < 25) {
      return 'consultation.page.exam.general.imc.category.normal';
    }

    if (imc < 30) {
      return 'consultation.page.exam.general.imc.category.overweight';
    }

    return 'consultation.page.exam.general.imc.category.obesity';
  }
}

