import { Component, output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { FormError } from '../../../../shared/components/form-error/form-error';

@Component({
  selector: 'app-reset-email-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormError],
  templateUrl: './reset-email-step.html',
})
export class ResetEmailStep {
  private readonly fb = inject(FormBuilder);

  /** Emits the email when submitted */
  emailSubmit = output<string>();

  /** Emits when user clicks back to login */
  backToLogin = output<void>();

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected loading = signal(false);
  protected serverError = signal('');

  setLoading(val: boolean): void {
    this.loading.set(val);
  }

  setServerError(msg: string): void {
    this.serverError.set(msg);
  }

  onSubmit(): void {
    this.serverError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.emailSubmit.emit(this.form.getRawValue().email);
  }
}
