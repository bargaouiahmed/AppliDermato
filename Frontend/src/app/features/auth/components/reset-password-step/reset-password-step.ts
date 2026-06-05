import { Component, output, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PasswordInput } from '../../../../shared/components/password-input/password-input';
import { FormError } from '../../../../shared/components/form-error/form-error';
import { passwordStrengthValidator } from '../../../../shared/validators/password-strength.validator';

@Component({
  selector: 'app-reset-password-step',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PasswordInput, FormError],
  templateUrl: './reset-password-step.html',
})
export class ResetPasswordStep {
  private readonly fb = inject(FormBuilder);

  /** Emits the new password on valid submit */
  passwordSubmit = output<string>();

  /** Back navigation */
  back = output<void>();

  protected form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [this.passwordMatchValidator] },
  );

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
    this.passwordSubmit.emit(this.form.getRawValue().password);
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const pw = control.get('password')?.value;
    const cpw = control.get('confirmPassword')?.value;
    if (pw && cpw && pw !== cpw) {
      return { passwordMismatch: true };
    }
    return null;
  }
}
