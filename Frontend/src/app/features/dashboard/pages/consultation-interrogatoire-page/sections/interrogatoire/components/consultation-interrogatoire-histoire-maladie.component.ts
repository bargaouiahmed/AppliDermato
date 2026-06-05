import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../../../../core/services/i18n.service';
import { TranslatePipe } from '../../../../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-consultation-interrogatoire-histoire-maladie',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './consultation-interrogatoire-histoire-maladie.component.html',
  styleUrl: './consultation-interrogatoire-histoire-maladie.component.css',
})
export class ConsultationInterrogatoireHistoireMaladieComponent implements OnChanges {
  @Input() histoireMaladie = '';
  @Output() histoireMaladieChange = new EventEmitter<string>();

  protected histoireMaladieExpanded = false;
  protected isHoveringCard = false;

  private readonly i18n = inject(I18nService);

  protected get isRtl(): boolean {
    return this.i18n.dir() === 'rtl';
  }

  protected get dir(): 'rtl' | 'ltr' {
    return this.isRtl ? 'rtl' : 'ltr';
  }

  protected get isSectionCollapsible(): boolean {
    return !this.histoireMaladie?.trim();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['histoireMaladie']) {
      return;
    }

    if (!this.isSectionCollapsible) {
      this.histoireMaladieExpanded = true;
      return;
    }

    if (!this.isHoveringCard) {
      this.histoireMaladieExpanded = false;
    }
  }

  protected toggleHistoireMaladie(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isSectionCollapsible) {
      this.histoireMaladieExpanded = true;
      return;
    }

    this.histoireMaladieExpanded = !this.histoireMaladieExpanded;
  }

  protected onWrapperEnter(): void {
    this.isHoveringCard = true;
    if (this.isSectionCollapsible) {
      this.histoireMaladieExpanded = true;
    }
  }

  protected onWrapperLeave(): void {
    this.isHoveringCard = false;
    if (this.isSectionCollapsible) {
      this.histoireMaladieExpanded = false;
    }
  }

  protected onValueChange(value: string): void {
    this.histoireMaladie = value ?? '';
    if (!this.isSectionCollapsible) {
      this.histoireMaladieExpanded = true;
    }

    this.histoireMaladieChange.emit(this.histoireMaladie);
  }
}
