import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../../../../../../../shared/pipes/translate.pipe';

type TensionValue = {
  systolique: number | null;
  diastolique: number | null;
};

@Component({
  selector: 'app-consultation-examen-tension-arterielle-field',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="exam-card">
      <h3>{{ 'consultation.page.exam.general.tension.title' | translate }}</h3>
      <div class="grid-2">
        <label>
          <span>{{ 'consultation.page.exam.general.tension.systolique' | translate }}</span>
          <input
            #systoliqueInput
            type="number"
            class="form-control compact-number"
            min="0"
            [value]="systolique ?? ''"
            (input)="onSystoliqueInput($any($event.target).value)"
            (wheel)="onSystoliqueWheel($event, systoliqueInput)"
          />
        </label>
        <label>
          <span>{{ 'consultation.page.exam.general.tension.diastolique' | translate }}</span>
          <input
            #diastoliqueInput
            type="number"
            class="form-control compact-number"
            min="0"
            [value]="diastolique ?? ''"
            (input)="onDiastoliqueInput($any($event.target).value)"
            (wheel)="onDiastoliqueWheel($event, diastoliqueInput)"
          />
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
    `,
  ],
})
export class ConsultationExamenTensionArterielleFieldComponent {
  private static readonly DEFAULT_TENSION = 10;

  @Input() systolique: number | null = null;
  @Input() diastolique: number | null = null;
  @Output() valueChange = new EventEmitter<TensionValue>();

  protected onSystoliqueWheel(event: WheelEvent, input: HTMLInputElement): void {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    if (input.value === '') {
      input.value = String(ConsultationExamenTensionArterielleFieldComponent.DEFAULT_TENSION);
    }
    if (event.deltaY < 0) {
      input.stepUp();
    } else {
      input.stepDown();
    }

    this.onSystoliqueInput(input.value);
  }

  protected onDiastoliqueWheel(event: WheelEvent, input: HTMLInputElement): void {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    if (input.value === '') {
      input.value = String(ConsultationExamenTensionArterielleFieldComponent.DEFAULT_TENSION);
    }
    if (event.deltaY < 0) {
      input.stepUp();
    } else {
      input.stepDown();
    }

    this.onDiastoliqueInput(input.value);
  }

  protected onSystoliqueInput(raw: string): void {
    this.valueChange.emit({
      systolique: this.toNullableNumber(raw),
      diastolique: this.diastolique,
    });
  }

  protected onDiastoliqueInput(raw: string): void {
    this.valueChange.emit({
      systolique: this.systolique,
      diastolique: this.toNullableNumber(raw),
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

