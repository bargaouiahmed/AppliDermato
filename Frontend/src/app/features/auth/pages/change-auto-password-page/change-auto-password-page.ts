import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { AppRole } from '../../../../core/models/user-context.models';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthLayout } from '../../../../shared/components/auth-layout/auth-layout';
import { PasswordInput } from '../../../../shared/components/password-input/password-input';
import { FormError } from '../../../../shared/components/form-error/form-error';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { passwordStrengthValidator } from '../../../../shared/validators/password-strength.validator';

@Component({
  selector: 'app-change-auto-password-page',
  standalone: true,
  imports: [AuthLayout, ReactiveFormsModule, PasswordInput, FormError, TranslatePipe],
  templateUrl: './change-auto-password-page.html',
  styleUrl: './change-auto-password-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeAutoPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly userContext = inject(UserContextService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly loading = signal(false);
  protected readonly serverError = signal('');

  protected readonly form = this.fb.nonNullable.group(
    {
      oldPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [this.passwordMatchValidator] },
  );

  protected submit(): void {
    this.serverError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.loading.set(true);
    this.auth
      .changeAutoAssignedPassword({
        oldPassword: value.oldPassword,
        newPassword: value.newPassword,
      })
      .pipe(
        switchMap(() => this.auth.getAuthenticatedAccount()),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (account) => {
          this.userContext.set({
            role: this.resolveAppRole(account.role),
            userId: account.id,
            doctorId: account.doctorId,
            firstName: account.firstname,
            lastName: account.lastname,
          });

          this.router.navigate(['/']);
        },
        error: (error) => {
          this.serverError.set(error?.error?.message ?? this.i18n.t('common.error'));
        },
      });
  }

  private resolveAppRole(apiRole: string): AppRole {
    const normalized = apiRole.trim().toLowerCase();

    if (
      normalized === 'admin' ||
      normalized === 'super_admin' ||
      normalized === 'secretary' ||
      normalized === 'secretary1' ||
      normalized === 'secretary2'
    ) {
      return normalized;
    }

    return 'doctor';
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const nextPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (nextPassword && confirmPassword && nextPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }
}
