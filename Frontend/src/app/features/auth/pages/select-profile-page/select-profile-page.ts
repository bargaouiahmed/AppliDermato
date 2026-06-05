import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginResponse } from '../../../../core/models/auth.models';
import { I18nService } from '../../../../core/services/i18n.service';
import { RoleSelection, SelectableRole } from '../../components/role-selection/role-selection';
import { Footer } from '../../../../shared/components/footer/footer';
import { LanguageSwitcher } from '../../../../shared/components/language-switcher/language-switcher';
import { AuthSelectionStateService } from '../../services/auth-selection-state.service';
import { UserContextService } from '../../../../core/services/user-context.service';

@Component({
  selector: 'app-select-profile-page',
  standalone: true,
  imports: [RoleSelection, Footer, LanguageSwitcher],
  templateUrl: './select-profile-page.html',
  styleUrl: './select-profile-page.css',
})
export class SelectProfilePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly selectionState = inject(AuthSelectionStateService);
  private readonly userContext = inject(UserContextService);

  protected readonly loading = signal(false);
  protected readonly loginData = signal<LoginResponse | null>(null);

  private readonly credentials: { email: string; password: string } | null;

  constructor() {
    const pending = this.selectionState.get();
    if (!pending) {
      this.credentials = null;
      this.router.navigate(['/login']);
      return;
    }

    this.credentials = pending.credentials;
    this.loginData.set(pending.loginData);
  }

  protected onRoleSelected(role: SelectableRole): void {
    if (!this.credentials) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading.set(true);
    this.auth
      .finalizeAuth({
        email: this.credentials.email,
        password: this.credentials.password,
        role,
      })
      .subscribe({
        next: () => {
          if (this.auth.requiresAutoPasswordChange()) {
            this.loading.set(false);
            this.selectionState.clear();
            this.router.navigate(['/first-login/change-password']);
            return;
          }

          this.auth.getAuthenticatedAccount().subscribe({
            next: (account) => {
              this.userContext.set({
                role: resolveAppRole(role, account.role),
                userId: account.id,
                doctorId: account.doctorId,
                firstName: account.firstname,
                lastName: account.lastname,
              });

              this.loading.set(false);
              this.selectionState.clear();
              this.router.navigate(['/']);
            },
            error: (err) => {
              this.loading.set(false);
              this.selectionState.clear();
              this.router.navigate(['/login'], {
                state: { authError: err.error?.message ?? this.i18n.t('common.error') },
              });
            },
          });
        },
        error: (err) => {
          this.loading.set(false);
          this.selectionState.clear();
          this.router.navigate(['/login'], {
            state: { authError: err.error?.message ?? this.i18n.t('common.error') },
          });
        },
      });
  }
}

function resolveAppRole(selectedRole: SelectableRole, apiRole: string): 'doctor' | 'admin' | 'super_admin' | 'secretary' | 'secretary1' | 'secretary2' {
  if (selectedRole === 'secretary1' || selectedRole === 'secretary2') {
    return selectedRole;
  }

  const normalizedApiRole = apiRole.trim().toLowerCase();
  if (normalizedApiRole === 'admin' || normalizedApiRole === 'super_admin') {
    return normalizedApiRole;
  }

  if (normalizedApiRole === 'secretary') {
    return 'secretary';
  }

  return 'doctor';
}
