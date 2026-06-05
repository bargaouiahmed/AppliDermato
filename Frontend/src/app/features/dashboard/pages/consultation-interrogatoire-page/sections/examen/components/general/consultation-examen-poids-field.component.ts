import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../../../../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-consultation-examen-poids-field',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="exam-card">
      <h3>{{ 'consultation.page.exam.general.poids.title' | translate }}</h3>
      <label>
        <span>{{ 'consultation.page.exam.general.poids.kg' | translate }}</span>
        <input
          #poidsInput
          type="number"
          class="form-control compact-number"
          min="0"
          step="0.1"
          [value]="value ?? ''"
          (input)="onInput($any($event.target).value)"
          (wheel)="onWheel($event, poidsInput)"
        />
      </label>
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

      label {
        display: grid;
        width: 100%;
        margin-top: auto;
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
    `,
  ],
})
export class ConsultationExamenPoidsFieldComponent {
  @Input() value: number | null = null;
  @Output() valueChange = new EventEmitter<number | null>();

  protected onWheel(event: WheelEvent, input: HTMLInputElement): void {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    if (event.deltaY < 0) {
      input.stepUp();
    } else {
      input.stepDown();
    }

    this.onInput(input.value);
  }

  protected onInput(raw: string): void {
    const parsed = Number(raw);
    this.valueChange.emit(Number.isFinite(parsed) ? parsed : null);
  }
}

