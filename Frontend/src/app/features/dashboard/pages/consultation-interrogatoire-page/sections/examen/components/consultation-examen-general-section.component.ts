import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  GeneralExamData,
  RythmeCardiaqueValue,
  createDefaultGeneralExamData,
} from '../../../../../../../core/models/exam.models';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';
import { ConsultationExamenEtatGeneralFieldComponent } from './general/consultation-examen-etat-general-field.component';
import { ConsultationExamenFrequenceCardiaqueFieldComponent } from './general/consultation-examen-frequence-cardiaque-field.component';
import { ConsultationExamenImcFieldComponent } from './general/consultation-examen-imc-field.component';
import { ConsultationExamenPoidsFieldComponent } from './general/consultation-examen-poids-field.component';
import { ConsultationExamenSaturationO2FieldComponent } from './general/consultation-examen-saturation-o2-field.component';
import { ConsultationExamenTailleFieldComponent } from './general/consultation-examen-taille-field.component';
import { ConsultationExamenTemperatureFieldComponent } from './general/consultation-examen-temperature-field.component';
import { ConsultationExamenTensionArterielleFieldComponent } from './general/consultation-examen-tension-arterielle-field.component';

type TensionValue = { systolique: number | null; diastolique: number | null };
type FrequenceCardiaqueValue = { frequence: number | null; rythme: RythmeCardiaqueValue };

@Component({
  selector: 'app-consultation-examen-general-section',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ConsultationExamenEtatGeneralFieldComponent,
    ConsultationExamenTensionArterielleFieldComponent,
    ConsultationExamenFrequenceCardiaqueFieldComponent,
    ConsultationExamenTemperatureFieldComponent,
    ConsultationExamenSaturationO2FieldComponent,
    ConsultationExamenPoidsFieldComponent,
    ConsultationExamenTailleFieldComponent,
    ConsultationExamenImcFieldComponent,
  ],
  templateUrl: './consultation-examen-general-section.component.html',
  styleUrl: './consultation-examen-general-section.component.css',
})
export class ConsultationExamenGeneralSectionComponent implements OnChanges {
  @Input() value: GeneralExamData = createDefaultGeneralExamData();
  @Output() valueChange = new EventEmitter<GeneralExamData>();

  protected state: GeneralExamData = createDefaultGeneralExamData();

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) {
      return;
    }

    this.state = {
      ...createDefaultGeneralExamData(),
      ...(this.value ?? {}),
    };

    this.state.imc = this.computeImc(this.state.poidsKg, this.state.tailleCm);
  }

  protected onEtatGeneralChange(next: GeneralExamData['etatGeneral']): void {
    this.patchState({ etatGeneral: next }, false);
  }

  protected onTensionChange(next: TensionValue): void {
    this.patchState(
      {
        tensionSystolique: next.systolique,
        tensionDiastolique: next.diastolique,
      },
      false,
    );
  }

  protected onFrequenceCardiaqueChange(next: FrequenceCardiaqueValue): void {
    this.patchState(
      {
        frequenceCardiaque: next.frequence,
        rythmeCardiaque: next.rythme,
      },
      false,
    );
  }

  protected onTemperatureChange(next: number | null): void {
    this.patchState({ temperature: next }, false);
  }

  protected onSaturationChange(next: number | null): void {
    this.patchState({ saturationO2: next }, false);
  }

  protected onPoidsChange(next: number | null): void {
    this.patchState({ poidsKg: next }, true);
  }

  protected onTailleChange(next: number | null): void {
    this.patchState({ tailleCm: next }, true);
  }

  private patchState(patch: Partial<GeneralExamData>, recomputeImc: boolean): void {
    this.state = {
      ...this.state,
      ...patch,
    };

    if (recomputeImc) {
      this.state = {
        ...this.state,
        imc: this.computeImc(this.state.poidsKg, this.state.tailleCm),
      };
    }

    this.valueChange.emit({
      ...this.state,
    });
  }

  private computeImc(poidsKg: number | null, tailleCm: number | null): number | null {
    if (poidsKg === null || tailleCm === null || tailleCm <= 0) {
      return null;
    }

    const tailleMetres = tailleCm / 100;
    const imc = poidsKg / (tailleMetres * tailleMetres);
    if (!Number.isFinite(imc)) {
      return null;
    }

    return Number(imc.toFixed(1));
  }
}

