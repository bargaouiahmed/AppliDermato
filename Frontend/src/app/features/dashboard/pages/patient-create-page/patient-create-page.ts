import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, finalize, switchMap } from 'rxjs';
import { AddPatientRequest } from '../../../../core/models/patient.models';
import { I18nService } from '../../../../core/services/i18n.service';
import { PatientService } from '../../../../core/services/patient.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ProfessionSelectComponent } from '../../../../shared/components/profession-select/profession-select';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-patient-create-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, ProfessionSelectComponent],
  templateUrl: './patient-create-page.html',
  styleUrl: './patient-create-page.css',
})
export class PatientCreatePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly dossierNumber = signal<number | null>(null);
  protected readonly isLoadingDossier = signal(false);
  protected readonly isSubmitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    firstname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    lastname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    dateOfBirth: ['', Validators.required],
    phoneNumber: ['', [Validators.maxLength(30)]],
    country: ['Tunisie', [Validators.maxLength(120)]],
    profession: ['', [Validators.maxLength(120)]],
    workPlace: ['', [Validators.maxLength(180)]],
    sex: ['', Validators.required],
    familialStatus: ['', [Validators.maxLength(120)]],
    city: ['', [Validators.maxLength(120)]],
    address: ['', [Validators.maxLength(240)]],
    postalCode: ['', [Validators.maxLength(20)]],
    email: ['', [Validators.email, Validators.maxLength(160)]],
    apci: ['', [Validators.maxLength(240)]],
    insuranceType: ['', [Validators.maxLength(120)]],
    insuranceEstablishment: ['', [Validators.maxLength(180)]],
  });

  ngOnInit(): void {
    this.loadNextDossierNumber();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: AddPatientRequest = {
      firstname: value.firstname.trim(),
      lastname: value.lastname.trim(),
      dateOfBirth: value.dateOfBirth,
      phoneNumber: value.phoneNumber.trim(),
      country: value.country.trim(),
      profession: value.profession.trim(),
      workPlace: value.workPlace.trim(),
      sex: value.sex.trim(),
      familialStatus: value.familialStatus.trim(),
      city: value.city.trim(),
      address: value.address.trim(),
      postalCode: value.postalCode.trim(),
      email: value.email.trim(),
      apci: value.apci.trim(),
      insuranceType: value.insuranceType.trim(),
      insuranceEstablishment: value.insuranceEstablishment.trim(),
    };

    this.isSubmitting.set(true);
    const dossierNumber = this.dossierNumber();
    if (!dossierNumber || dossierNumber <= 0) {
      this.isSubmitting.set(false);
      this.toast.error(this.i18n.t('patients.create.dossierError'));
      this.loadNextDossierNumber();
      return;
    }

    this.patientService
      .verifyDossierNumber(dossierNumber)
      .pipe(
        switchMap((verification) => {
          if (verification.isUsed) {
            this.toast.error(this.i18n.t('patients.create.dossierAlreadyUsed'));
            this.loadNextDossierNumber();
            return EMPTY;
          }

          return this.patientService.addPatient(payload);
        }),
      )
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('patients.create.success'));
          this.router.navigate(['/patients']);
        },
        error: () => {
          this.toast.error(this.i18n.t('patients.create.error'));
        },
      });
  }

  private loadNextDossierNumber(): void {
    this.isLoadingDossier.set(true);
    this.patientService
      .getNextDossierNumber()
      .pipe(
        finalize(() => {
          this.isLoadingDossier.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.dossierNumber.set(response.nextDossierNumber);
          this.cdr.detectChanges();
        },
        error: () => {
          this.dossierNumber.set(null);
          this.toast.error(this.i18n.t('patients.create.dossierError'));
          this.cdr.detectChanges();
        },
      });
  }
}
