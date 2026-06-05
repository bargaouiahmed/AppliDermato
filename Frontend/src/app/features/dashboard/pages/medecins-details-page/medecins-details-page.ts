import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { ToastService } from '../../../../core/services/toast.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { DoctorListItem, UpdateDoctorByAdminRequest } from '../../../../core/models/admin.models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-medecins-details-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './medecins-details-page.html',
  styleUrl: './medecins-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedecinsDetailsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly doctor = signal<DoctorListItem | null>(null);
  protected readonly profileImageUrl = signal<string | null>(null);

  private doctorId = '';

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(120)]],
    lastName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    nationality: ['', [Validators.required, Validators.maxLength(120)]],
    phoneNumber: ['', [Validators.required, Validators.maxLength(30)]],
    landline: ['', [Validators.required, Validators.maxLength(30)]],
    cabinetCountry: ['', [Validators.required, Validators.maxLength(120)]],
    cabinetCity: ['', [Validators.required, Validators.maxLength(120)]],
    cabinetAddress: ['', [Validators.required, Validators.maxLength(240)]],
    cabinetPostalCode: ['', [Validators.required, Validators.maxLength(20)]],
    notesFromAdmin: ['', [Validators.maxLength(500)]],
    languagePreference: ['fr' as 'fr' | 'en' | 'ar', Validators.required],
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (!id) {
          this.router.navigate(['/medecins']);
          return;
        }

        this.doctorId = id;
        this.loadDoctor();
      });
  }

  protected save(): void {
    if (!this.doctorId) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: UpdateDoctorByAdminRequest = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      nationality: value.nationality.trim(),
      phoneNumber: value.phoneNumber.trim(),
      landline: value.landline.trim(),
      cabinetCountry: value.cabinetCountry.trim(),
      cabinetCity: value.cabinetCity.trim(),
      cabinetAddress: value.cabinetAddress.trim(),
      cabinetPostalCode: value.cabinetPostalCode.trim(),
      notesFromAdmin: value.notesFromAdmin.trim(),
      languagePreference: value.languagePreference,
    };

    this.saving.set(true);
    this.adminService
      .updateDoctorByAdmin(this.doctorId, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (doctor) => {
          this.doctor.set(doctor);
          this.patchForm(doctor);
          this.toast.success(this.i18n.t('medecins.details.updateSuccess'));
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.details.updateError'));
        },
      });
  }

  protected getStatusLabelKey(): string {
    const status = this.doctor()?.subscriptionStatus;
    switch (status) {
      case 'active':
        return 'medecins.list.status.active';
      case 'expiring_soon':
        return 'medecins.list.status.expiringSoon';
      case 'admin':
        return 'medecins.list.status.admin';
      case 'suspended':
        return 'medecins.list.status.suspended';
      case 'deleted':
        return 'medecins.list.status.deleted';
      default:
        return 'medecins.list.status.expired';
    }
  }

  private loadDoctor(): void {
    this.loading.set(true);
    this.adminService
      .getDoctorById(this.doctorId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (doctor) => {
          this.doctor.set(doctor);
          this.patchForm(doctor);
          this.profileImageUrl.set(this.resolveProfilePictureUrl(doctor.profilePictureUrl));
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.details.loadError'));
          this.router.navigate(['/medecins']);
        },
      });
  }

  private patchForm(doctor: DoctorListItem): void {
    this.form.patchValue({
      firstName: doctor.firstName ?? '',
      lastName: doctor.lastName ?? '',
      email: doctor.email ?? '',
      nationality: doctor.nationality ?? '',
      phoneNumber: doctor.phoneNumber ?? '',
      landline: doctor.landline ?? '',
      cabinetCountry: doctor.cabinetCountry ?? '',
      cabinetCity: doctor.cabinetCity ?? '',
      cabinetAddress: doctor.cabinetAddress ?? '',
      cabinetPostalCode: doctor.cabinetPostalCode ?? '',
      notesFromAdmin: doctor.notesFromAdmin ?? '',
      languagePreference: doctor.languagePreference ?? 'fr',
    });
  }

  private resolveProfilePictureUrl(rawUrl: string): string | null {
    const url = rawUrl.trim();
    if (!url) {
      return null;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('/')) {
      return `${environment.apiUrl}${url}`;
    }

    return `${environment.apiUrl}/${url}`;
  }
}
