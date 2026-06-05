import { Component, output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PasswordInput } from '../../../../shared/components/password-input/password-input';
import { FormError } from '../../../../shared/components/form-error/form-error';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PasswordInput, FormError],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
})
export class LoginForm {
  private readonly fb = inject(FormBuilder);

  /** Emits { email, password } on valid submit */
  formSubmit = output<{ email: string; password: string }>();

  /** Emits when user clicks "Forgot password?" */
  forgotPassword = output<void>();

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected serverError = signal<string>('');
  protected attemptCount = signal(0);
  protected loading = signal(false);

  setServerError(msg: string): void {
    this.serverError.set(msg);
  }

  setLoading(val: boolean): void {
    this.loading.set(val);
  }

  incrementAttempts(): void {
    this.attemptCount.update((c) => c + 1);
  }

  onSubmit(): void {
    this.serverError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.formSubmit.emit(this.form.getRawValue());
  }
}
