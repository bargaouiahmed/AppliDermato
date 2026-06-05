import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { IssuableDoctorRole } from '../../../../core/models/admin.models';
import { AdminService } from '../../../../core/services/admin.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-medecins-create-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './medecins-create-page.html',
  styleUrl: './medecins-create-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedecinsCreatePage {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isSubmitting = signal(false);
  protected readonly isAdminMode = signal(false);
  protected readonly roleOptions: IssuableDoctorRole[] = ['doctor', 'admin'];
  protected readonly subscriptionPresetOptions = [1, 2, 3, 4, 5];
  protected readonly languageOptions: Array<'fr' | 'en' | 'ar'> = ['fr', 'en', 'ar'];

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(120)]],
    lastName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    nationality: ['', [Validators.required, Validators.maxLength(120)]],
    role: ['doctor' as IssuableDoctorRole, Validators.required],
    phoneNumber: ['', [Validators.required, Validators.maxLength(30)]],
    landline: ['', [Validators.required, Validators.maxLength(30)]],
    cabinetCountry: ['Tunisie', [Validators.required, Validators.maxLength(120)]],
    cabinetCity: ['', [Validators.required, Validators.maxLength(120)]],
    cabinetAddress: ['', [Validators.required, Validators.maxLength(240)]],
    languagePreference: ['fr' as 'fr' | 'en' | 'ar', Validators.required],
    cabinetPostalCode: ['', [Validators.required, Validators.maxLength(20)]],
    notesFromAdmin: ['', [Validators.maxLength(500)]],
    subscriptionDurationInYears: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
  });

  constructor() {
    const requestedRole = this.route.snapshot.queryParamMap.get('role');
    if (requestedRole === 'admin') {
      this.isAdminMode.set(true);
      this.form.controls.role.setValue('admin');
    }
  }

  protected usePresetDuration(years: number): void {
    this.form.controls.subscriptionDurationInYears.setValue(years);
    this.form.controls.subscriptionDurationInYears.markAsDirty();
    this.form.controls.subscriptionDurationInYears.markAsTouched();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.isSubmitting.set(true);
    this.adminService
      .createDoctor({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        nationality: value.nationality,
        role: value.role,
        phoneNumber: value.phoneNumber,
        landline: value.landline,
        cabinetCountry: value.cabinetCountry,
        cabinetCity: value.cabinetCity,
        cabinetAddress: value.cabinetAddress,
        languagePreference: value.languagePreference,
        cabinetPostalCode: value.cabinetPostalCode,
        notesFromAdmin: value.notesFromAdmin,
        subscriptionDurationInMonths: Number(value.subscriptionDurationInYears) * 12,
      })
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.toast.success(response.message || this.i18n.t('medecins.success'));
          this.router.navigate(['/medecins']);
        },
        error: (error) => {
          const message = this.extractApiErrorMessage(error) || this.i18n.t('medecins.error');
          this.toast.error(message);
        },
      });
  }

  private extractApiErrorMessage(error: unknown): string {
    const unknownError = error as {
      error?: { message?: string } | string;
      message?: string;
    };

    if (typeof unknownError?.error === 'string' && unknownError.error.trim() !== '') {
      return unknownError.error;
    }

    const errorMessage =
      unknownError?.error && typeof unknownError.error === 'object'
        ? unknownError.error.message
        : null;

    if (typeof errorMessage === 'string' && errorMessage.trim() !== '') {
      return errorMessage;
    }

    if (typeof unknownError?.message === 'string' && unknownError.message.trim() !== '') {
      return unknownError.message;
    }

    return '';
  }
}
