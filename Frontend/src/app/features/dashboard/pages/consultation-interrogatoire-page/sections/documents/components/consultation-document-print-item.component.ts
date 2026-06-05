import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { I18nService } from '../../../../../../../core/services/i18n.service';

@Component({
  selector: 'app-consultation-document-print-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consultation-document-print-item.component.html',
  styleUrl: './consultation-document-print-item.component.css',
})
export class ConsultationDocumentPrintItemComponent {
  private readonly i18n = inject(I18nService);

  @Input() label = '';
  @Input() documentType = '';
  @Input() isLoading = false;
  @Output() print = new EventEmitter<string>();

  protected t(key: string): string {
    return this.i18n.t(key);
  }

  protected onPrint(): void {
    if (!this.documentType || this.isLoading) {
      return;
    }

    this.print.emit(this.documentType);
  }
}
