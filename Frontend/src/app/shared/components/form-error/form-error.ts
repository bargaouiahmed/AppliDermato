import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-form-error',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (show()) {
      <small class="text-red-500 text-xs mt-0.5 block">{{ messageKey() | translate }}</small>
    }
  `,
})
export class FormError {
  /** Whether to show the error */
  show = input.required<boolean>();

  /** i18n key for the error message */
  messageKey = input.required<string>();
}
