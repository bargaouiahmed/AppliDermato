import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RythmeCardiaqueValue } from '../../../../../../../../core/models/exam.models';
import { TranslatePipe } from '../../../../../../../../shared/pipes/translate.pipe';

type FrequenceCardiaqueValue = {
  frequence: number | null;
  rythme: RythmeCardiaqueValue;
};

@Component({
  selector: 'app-consultation-examen-frequence-cardiaque-field',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="exam-card">
      <h3>{{ 'consultation.page.exam.general.frequenceCardiaque.title' | translate }}</h3>
      <div class="grid-2">
        <label>
          <span>{{ 'consultation.page.exam.general.frequenceCardiaque.bpm' | translate }}</span>
          <input
            #frequenceInput
            type="number"
            class="form-control compact-number"
            min="0"
            [value]="frequence ?? ''"
            (input)="onFrequenceInput($any($event.target).value)"
            (wheel)="onFrequenceWheel($event, frequenceInput)"
          />
        </label>

        <label>
          <span>{{ 'consultation.page.exam.general.frequenceCardiaque.rythme' | translate }}</span>
          <select
            class="form-control compact-select"
            [value]="rythme"
            (change)="onRythmeChange($any($event.target).value)"
          >
            <option value="">{{ 'consultation.page.exam.general.selectPlaceholder' | translate }}</option>
            <option value="regular">{{ 'consultation.page.exam.general.frequenceCardiaque.regular' | translate }}</option>
            <option value="irregular">{{ 'consultation.page.exam.general.frequenceCardiaque.irregular' | translate }}</option>
          </select>
        </label>
      </div>
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
        inline-size: 14rem;
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

      .grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: flex-end;
        gap: 0.45rem;
        margin-top: auto;
      }

      label {
        display: grid;
        width: 100%;
      }

      label span {
        display: block;
        margin-bottom: 0.25rem;
        color: #175042;
        font-weight: 600;
        font-size: 0.88rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .exam-card .form-control {
        min-height: 2rem;
      }

      .compact-number {
        inline-size: 100%;
        min-inline-size: 0;
        max-inline-size: 100%;
      }

      .compact-select {
        inline-size: 100%;
        min-inline-size: 0;
        max-inline-size: 100%;
      }
    `,
  ],
})
export class ConsultationExamenFrequenceCardiaqueFieldComponent {
  @Input() frequence: number | null = null;
  @Input() rythme: RythmeCardiaqueValue = '';
  @Output() valueChange = new EventEmitter<FrequenceCardiaqueValue>();

  protected onFrequenceWheel(event: WheelEvent, input: HTMLInputElement): void {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    if (event.deltaY < 0) {
      input.stepUp();
    } else {
      input.stepDown();
    }

    this.onFrequenceInput(input.value);
  }

  protected onFrequenceInput(raw: string): void {
    this.valueChange.emit({
      frequence: this.toNullableNumber(raw),
      rythme: this.rythme,
    });
  }

  protected onRythmeChange(next: string): void {
    const rythme: RythmeCardiaqueValue = next === 'regular' || next === 'irregular' ? next : '';
    this.valueChange.emit({
      frequence: this.frequence,
      rythme,
    });
  }

  private toNullableNumber(raw: string): number | null {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return null;
    }

    return value;
  }
}

