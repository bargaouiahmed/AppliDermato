import { Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthLayout } from '../../../../shared/components/auth-layout/auth-layout';
import { LoginForm } from '../../components/login-form/login-form';
import { AuthSelectionStateService } from '../../services/auth-selection-state.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [AuthLayout, LoginForm],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly selectionState = inject(AuthSelectionStateService);

  protected loginForm = viewChild<LoginForm>('loginFormRef');

  onLogin(data: { email: string; password: string }): void {
    const form = this.loginForm();
    form?.setLoading(true);

    this.auth.login(data).subscribe({
      next: (response) => {
        form?.setLoading(false);
        this.selectionState.set({
          credentials: data,
          loginData: response,
        });
        this.router.navigate(['/select-profile']);
      },
      error: (err) => {
        form?.setLoading(false);
        form?.incrementAttempts();
        const msg =
          err.error?.message ?? this.i18n.t('login.invalidCredentials');
        form?.setServerError(msg);
      },
    });
  }

  onForgotPassword(): void {
    this.router.navigate(['/reset-password']);
  }
}
