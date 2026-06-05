import { Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthLayout } from '../../../../shared/components/auth-layout/auth-layout';
import { ResetEmailStep } from '../../components/reset-email-step/reset-email-step';
import { ResetCodeStep } from '../../components/reset-code-step/reset-code-step';
import { ResetPasswordStep } from '../../components/reset-password-step/reset-password-step';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

type ResetStep = 'email' | 'code' | 'password' | 'success';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [AuthLayout, ResetEmailStep, ResetCodeStep, ResetPasswordStep, TranslatePipe],
  templateUrl: './reset-password-page.html',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected step = signal<ResetStep>('email');

  private email = '';
  private resetCode = '';

  protected emailStepRef = viewChild<ResetEmailStep>('emailStepRef');
  protected codeStepRef = viewChild<ResetCodeStep>('codeStepRef');
  protected passwordStepRef = viewChild<ResetPasswordStep>('passwordStepRef');

  onEmailSubmit(email: string): void {
    this.email = email;
    const ref = this.emailStepRef();
    ref?.setLoading(true);

    this.auth.sendPasswordResetCode({ email, language: this.i18n.lang() }).subscribe({
      next: () => {
        ref?.setLoading(false);
        this.step.set('code');
      },
      error: (err) => {
        ref?.setLoading(false);
        // Still move to code step — we don't reveal if email exists
        this.step.set('code');
      },
    });
  }

  onCodeSubmit(code: string): void {
    // We store the code and move to the password step
    // The actual validation happens when resetting the password
    this.resetCode = code;
    this.step.set('password');
  }

  onResendCode(): void {
    const ref = this.codeStepRef();
    ref?.setLoading(true);

    this.auth.sendPasswordResetCode({ email: this.email, language: this.i18n.lang() }).subscribe({
      next: () => {
        ref?.setLoading(false);
        ref?.resetInput();
      },
      error: () => {
        ref?.setLoading(false);
      },
    });
  }

  onPasswordSubmit(newPassword: string): void {
    const ref = this.passwordStepRef();
    ref?.setLoading(true);

    this.auth
      .resetPassword({
        email: this.email,
        newPassword,
        resetToken: this.resetCode,
      })
      .subscribe({
        next: () => {
          ref?.setLoading(false);
          this.step.set('success');
        },
        error: (err) => {
          ref?.setLoading(false);
          ref?.setServerError(
            err.error?.message ?? this.i18n.t('common.error'),
          );
        },
      });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goBackToEmail(): void {
    this.step.set('email');
  }

  goBackToCode(): void {
    this.step.set('code');
  }
}
