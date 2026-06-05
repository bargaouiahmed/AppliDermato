import { Component, input, output, signal } from '@angular/core';
import { LoginResponse } from '../../../../core/models/auth.models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

export type SelectableRole = 'doctor' | 'secretary1' | 'secretary2';

@Component({
  selector: 'app-role-selection',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './role-selection.html',
  styleUrl: './role-selection.css',
})
export class RoleSelection {
  /** The login response containing doctor + secretary info */
  loginData = input.required<LoginResponse>();
  loading = input(false);

  /** Emits the chosen role: 'doctor', 'secretary1', 'secretary2' */
  roleSelected = output<SelectableRole>();

  protected selectedRole = signal<SelectableRole | null>(null);

  protected selectRole(role: SelectableRole): void {
    if (this.loading()) {
      return;
    }
    this.selectedRole.set(role);
  }

  protected continue(): void {
    const role = this.selectedRole();
    if (!role || this.loading()) {
      return;
    }
    this.roleSelected.emit(role);
  }
}
