import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DoctorService, DoctorUpdatePayload } from '../../../../core/services/doctor.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Clinic, DoctorPersonalization, DoctorProfile } from '../../../../core/models/doctor.models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../../core/services/i18n.service';
import { ToastService } from '../../../../core/services/toast.service';
import { environment } from '../../../../../environments/environment';

type ActiveSection = 'info' | 'secretaires' | 'security';

type ProfileForm = {
  firstName: string;
  lastName: string;
  firstNameInArabic: string;
  lastNameInArabic: string;
  phoneNumber: string;
  landline: string;
  codeCnam: string;
  city: string;
  postalCode: string;
  cabinetAddress: string;
};

type SecretaryForm = {
  isSecondSecretaryEnabled: boolean;
  firstSecretaryFirstName: string;
  firstSecretaryLastName: string;
  secondSecretaryFirstName: string;
  secondSecretaryLastName: string;
};

type ClinicForm = {
  name: string;
  address: string;
  phoneNumber: string;
  googleMapsLink: string;
};

type PasswordForm = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PersonalizationForm = DoctorPersonalization;

type ProfileField = keyof ProfileForm;
type SecretaryField = keyof SecretaryForm;
type ClinicField = keyof ClinicForm;
type PasswordField = keyof PasswordForm;
type PersonalizationField = keyof PersonalizationForm;
type HeaderPersonalizationField =
  | 'showFirstName'
  | 'showLastName'
  | 'showCodeCnam'
  | 'showFirstNameArabic'
  | 'showLastNameArabic';
type FooterPersonalizationField =
  | 'showFooterCabinetAddress'
  | 'showFooterLandline'
  | 'showFooterMobile'
  | 'showFooterEmail';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage {
  private readonly doctorService = inject(DoctorService);
  private readonly userContext = inject(UserContextService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private identityId: string | null = null;
  private secretaryEditVersion = 0;
  private profileSaveInFlight = false;
  private profileSaveQueued = false;
  private queuedProfileSaveMessage: string | null = null;
  private queuedProfileShowValidationError = false;
  private showAutoDailyNewsQueuedToastAfterSave = false;

  protected readonly loading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly profile = signal<DoctorProfile | null>(null);
  protected readonly activeSection = signal<ActiveSection>('info');
  protected readonly versionFr = signal(true);
  protected readonly versionAr = signal(false);
  protected readonly pathImage = signal<string | null>(null);
  protected readonly clinics = signal<ClinicForm[]>([]);
  protected readonly showClinicForm = signal(false);
  protected readonly editingClinicIndex = signal<number | null>(null);
  protected readonly clinicDraft = signal<ClinicForm>(this.createEmptyClinic());
  protected readonly passwordForm = signal<PasswordForm>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  protected readonly isPasswordSaving = signal(false);
  protected readonly personalization = signal<PersonalizationForm>(
    this.createDefaultPersonalization(),
  );
  readonly selfCheckin = signal({
    enabled: true,
    timeoutSeconds: 90,
  });

  protected readonly personalizationHeaderFields: Array<{
    key: HeaderPersonalizationField;
    labelKey: string;
  }> = [
    { key: 'showFirstName', labelKey: 'profile.personalization.header.firstName' },
    { key: 'showLastName', labelKey: 'profile.personalization.header.lastName' },
    { key: 'showCodeCnam', labelKey: 'profile.personalization.header.codeCnam' },
    { key: 'showFirstNameArabic', labelKey: 'profile.personalization.header.firstNameArabic' },
    { key: 'showLastNameArabic', labelKey: 'profile.personalization.header.lastNameArabic' },
  ];

  protected readonly personalizationFooterFields: Array<{
    key: FooterPersonalizationField;
    labelKey: string;
  }> = [
    { key: 'showFooterCabinetAddress', labelKey: 'profile.personalization.footer.cabinetAddress' },
    { key: 'showFooterLandline', labelKey: 'profile.personalization.footer.landline' },
    { key: 'showFooterMobile', labelKey: 'profile.personalization.footer.mobile' },
    { key: 'showFooterEmail', labelKey: 'profile.personalization.footer.email' },
  ];

  protected readonly form = signal<ProfileForm>({
    firstName: '',
    lastName: '',
    firstNameInArabic: '',
    lastNameInArabic: '',
    phoneNumber: '',
    landline: '',
    codeCnam: '',
    city: '',
    postalCode: '',
    cabinetAddress: '',
  });

  protected readonly secretaries = signal<SecretaryForm>({
    isSecondSecretaryEnabled: false,
    firstSecretaryFirstName: '',
    firstSecretaryLastName: '',
    secondSecretaryFirstName: '',
    secondSecretaryLastName: '',
  });

  constructor() {
    const context = this.userContext.get();

    if (!context?.userId) {
      this.logoutAndRedirect();
      return;
    }

    this.identityId = context.userId;

    this.doctorService.getById(context.userId).subscribe({
      next: (value) => {
        this.profile.set(value);
        this.pathImage.set(this.resolveProfilePictureUrl(value.profilePictureUrl));
        this.form.set({
          firstName: value.firstName ?? '',
          lastName: value.lastName ?? '',
          firstNameInArabic: value.firstNameInArabic ?? '',
          lastNameInArabic: value.lastNameInArabic ?? '',
          phoneNumber: value.phoneNumber ?? '',
          landline: value.landline ?? '',
          codeCnam: value.codeCnam ?? '',
          city: value.city ?? '',
          postalCode: value.postalCode ?? '',
          cabinetAddress: value.cabinetAddress ?? '',
        });

        this.secretaries.set({
          isSecondSecretaryEnabled: !!value.isSecondSecretaryEnabled,
          firstSecretaryFirstName: value.firstSecretary?.firstName ?? '',
          firstSecretaryLastName: value.firstSecretary?.lastName ?? '',
          secondSecretaryFirstName: value.secondSecretary?.firstName ?? '',
          secondSecretaryLastName: value.secondSecretary?.lastName ?? '',
        });
        const sanitizedClinics = this.mapClinicsToForm(value.clinics);
        this.clinics.set(sanitizedClinics);
        this.personalization.set(this.mapPersonalizationToForm(value.personalization));
        this.selfCheckin.set({
          enabled: value.selfCheckinEnabled ?? true,
          timeoutSeconds: value.selfCheckinTimeoutSeconds ?? 90,
        });

        // Auto-cleanup persisted ghost clinics that are fully empty.
        if ((value.clinics?.length ?? 0) !== sanitizedClinics.length) {
          this.scheduleAutosave('profile:all', () => this.saveAutosave());
        }

        this.loading.set(false);
      },
      error: () => this.logoutAndRedirect(),
    });
  }

  protected showVersionFr(): void {
    this.versionFr.set(true);
    this.versionAr.set(false);
  }

  protected showVersionAr(): void {
    this.versionFr.set(false);
    this.versionAr.set(true);
  }

  protected setSection(section: ActiveSection): void {
    this.activeSection.set(section);
  }

  protected updateField(field: ProfileField, value: string): void {
    this.form.update((curr) => ({ ...curr, [field]: value }));
    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected updateSecretaryField(field: SecretaryField, value: string): void {
    this.secretaryEditVersion += 1;
    this.secretaries.update((curr) => ({ ...curr, [field]: value }));
    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected onSecondSecretaryToggle(enabled: boolean): void {
    this.secretaryEditVersion += 1;
    this.secretaries.update((curr) => ({ ...curr, isSecondSecretaryEnabled: enabled }));

    if (!enabled) {
      this.secretaries.update((curr) => ({
        ...curr,
        secondSecretaryFirstName: '',
        secondSecretaryLastName: '',
      }));
    }

    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected onSubmitProfile(): void {
    this.saveAllNow();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toastService.error(this.i18n.t('profile.toast.saveError'));
      input.value = '';
      return;
    }

    this.persist({ profilePicture: file }, this.i18n.t('profile.toast.profileSaved'));
    input.value = '';
  }

  protected openAddClinic(): void {
    this.editingClinicIndex.set(null);
    this.clinicDraft.set(this.createEmptyClinic());
    this.showClinicForm.set(true);
  }

  protected openEditClinic(index: number): void {
    const clinic = this.clinics()[index];
    if (!clinic) {
      return;
    }

    this.editingClinicIndex.set(index);
    this.clinicDraft.set({ ...clinic });
    this.showClinicForm.set(true);
  }

  protected onClinicDraftChange(field: ClinicField, value: string): void {
    this.clinicDraft.update((curr) => ({ ...curr, [field]: value }));
  }

  protected saveClinic(): void {
    const draft = this.clinicDraft();
    if (!draft.name.trim()) {
      this.toastService.error(this.i18n.t('profile.clinics.validation.nameRequired'));
      return;
    }

    const normalized = {
      name: draft.name.trim(),
      address: draft.address.trim(),
      phoneNumber: draft.phoneNumber.trim(),
      googleMapsLink: draft.googleMapsLink.trim(),
    };

    const editingIndex = this.editingClinicIndex();
    if (editingIndex === null) {
      this.clinics.update((curr) => [...curr, normalized]);
    } else {
      this.clinics.update((curr) =>
        curr.map((clinic, index) => (index === editingIndex ? normalized : clinic)),
      );
    }

    this.cancelClinic();
    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected cancelClinic(): void {
    this.showClinicForm.set(false);
    this.editingClinicIndex.set(null);
    this.clinicDraft.set(this.createEmptyClinic());
  }

  protected removeClinic(index: number): void {
    this.clinics.update((curr) => curr.filter((_, idx) => idx !== index));
    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected normalizeMapsUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  protected updatePasswordField(field: PasswordField, value: string): void {
    this.passwordForm.update((curr) => ({ ...curr, [field]: value }));
  }

  protected submitPasswordChange(): void {
    const payload = this.passwordForm();
    const oldPassword = payload.oldPassword.trim();
    const newPassword = payload.newPassword.trim();
    const confirmPassword = payload.confirmPassword.trim();

    if (!oldPassword || !newPassword || !confirmPassword) {
      this.toastService.error(this.i18n.t('profile.password.error.required'));
      return;
    }

    if (newPassword.length < 8) {
      this.toastService.error(this.i18n.t('profile.password.error.length'));
      return;
    }

    if (newPassword !== confirmPassword) {
      this.toastService.error(this.i18n.t('profile.password.error.mismatch'));
      return;
    }

    this.isPasswordSaving.set(true);
    this.doctorService.updatePassword({ oldPassword, newPassword }).subscribe({
      next: () => {
        this.isPasswordSaving.set(false);
        this.passwordForm.set({ oldPassword: '', newPassword: '', confirmPassword: '' });
        this.toastService.success(this.i18n.t('profile.password.success'));
      },
      error: () => {
        this.isPasswordSaving.set(false);
        this.toastService.error(this.i18n.t('profile.password.error.failed'));
      },
    });
  }

  protected updatePersonalizationField(
    field: PersonalizationField,
    value: string | boolean,
  ): void {
    if (field === 'dailyNews' && this.isSuperAdminAutoDailyNewsLocked()) {
      return;
    }

    this.personalization.update((curr) => ({
      ...curr,
      [field]: value,
    } as PersonalizationForm));

    if (field === 'dailyNews') {
      const normalizedValue = String(value ?? '');
      this.personalization.update((curr) => ({
        ...curr,
        dailyNewsFr: normalizedValue,
        dailyNewsEn: normalizedValue,
        dailyNewsAr: normalizedValue,
      }));
      return;
    }

    if (field === 'dailyNewsFr') {
      const normalizedValue = String(value ?? '');
      this.personalization.update((curr) => ({
        ...curr,
        dailyNews: normalizedValue,
      }));
      return;
    }

    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected updateDailyNewsLocalizedField(
    field: 'dailyNewsFr' | 'dailyNewsEn' | 'dailyNewsAr',
    value: string,
  ): void {
    if (this.isSuperAdminAutoDailyNewsLocked()) {
      return;
    }

    const normalizedValue = value ?? '';
    this.personalization.update((curr) => {
      const next = { ...curr, [field]: normalizedValue } as PersonalizationForm;
      if (field === 'dailyNewsFr') {
        next.dailyNews = normalizedValue;
      }
      return next;
    });
  }

  protected onDailyNewsBlur(): void {
    if (this.isSuperAdminAutoDailyNewsLocked()) {
      return;
    }
    this.saveAllNow();
  }

  protected clearDailyNews(): void {
    this.personalization.update((curr) => ({
      ...curr,
      dailyNews: '',
      useSuperAdminDailyNews: false,
    }));
    this.saveAllNow();
  }

  protected onAutoDailyNewsEnabledChanged(enabled: boolean): void {
    const wasEnabled = this.personalization().autoDailyNewsEnabled;
    this.personalization.update((curr) => ({
      ...curr,
      autoDailyNewsEnabled: enabled,
    }));
    this.showAutoDailyNewsQueuedToastAfterSave = !wasEnabled && enabled;
    this.saveAllNow();
  }

  protected isSuperAdminAutoDailyNewsLocked(): boolean {
    return this.profile()?.role === 'super_admin' && this.personalization().autoDailyNewsEnabled;
  }

  protected toggleAllHeader(enabled: boolean): void {
    this.personalization.update((curr) => ({
      ...curr,
      showHeader: enabled,
      showFirstName: enabled,
      showLastName: enabled,
      showCodeCnam: enabled,
      showFirstNameArabic: enabled,
      showLastNameArabic: enabled,
    }));

    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected clearHeader(): void {
    this.toggleAllHeader(false);
  }

  protected onHeaderFieldToggle(
    field: HeaderPersonalizationField,
    enabled: boolean,
  ): void {
    this.personalization.update((curr) => {
      const next = { ...curr, [field]: enabled } as PersonalizationForm;
      next.showHeader =
        next.showFirstName ||
        next.showLastName ||
        next.showCodeCnam ||
        next.showFirstNameArabic ||
        next.showLastNameArabic;
      return next;
    });

    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected headerCheckedCount(): number {
    const p = this.personalization();
    return this.personalizationHeaderFields.reduce(
      (count, item) => (p[item.key] ? count + 1 : count),
      0,
    );
  }

  protected toggleAllFooter(enabled: boolean): void {
    this.personalization.update((curr) => ({
      ...curr,
      showFooter: enabled,
      showFooterCabinetAddress: enabled,
      showFooterLandline: enabled,
      showFooterMobile: enabled,
      showFooterEmail: enabled,
    }));

    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected clearFooter(): void {
    this.toggleAllFooter(false);
  }

  protected onFooterFieldToggle(
    field: FooterPersonalizationField,
    enabled: boolean,
  ): void {
    this.personalization.update((curr) => {
      const next = { ...curr, [field]: enabled } as PersonalizationForm;
      next.showFooter =
        next.showFooterCabinetAddress ||
        next.showFooterLandline ||
        next.showFooterMobile ||
        next.showFooterEmail;
      return next;
    });

    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  protected footerCheckedCount(): number {
    const p = this.personalization();
    return this.personalizationFooterFields.reduce(
      (count, item) => (p[item.key] ? count + 1 : count),
      0,
    );
  }

  updateSelfCheckinEnabled(enabled: boolean): void {
    this.selfCheckin.update((current) => ({ ...current, enabled }));
    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  updateSelfCheckinTimeout(rawValue: number | string): void {
    const parsed = Number(rawValue);
    const safeValue = Number.isFinite(parsed) ? Math.min(3600, Math.max(30, Math.round(parsed))) : 90;
    this.selfCheckin.update((current) => ({ ...current, timeoutSeconds: safeValue }));
    this.scheduleAutosave('profile:all', () => this.saveAutosave());
  }

  kioskLink(): string {
    const profile = this.profile();
    if (!profile?.doctorId || !profile.selfCheckinKey) {
      return '';
    }

    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/self-checkin/${profile.doctorId}/${profile.selfCheckinKey}`;
  }

  copyKioskLink(): void {
    const link = this.kioskLink();
    if (!link || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.toastService.error(this.i18n.t('profile.selfCheckin.linkUnavailable'));
      return;
    }

    navigator.clipboard.writeText(link).then(
      () => this.toastService.success(this.i18n.t('profile.selfCheckin.linkCopied')),
      () => this.toastService.error(this.i18n.t('profile.selfCheckin.linkUnavailable')),
    );
  }

  private scheduleAutosave(key: string, callback: () => void): void {
    const timeoutId = this.autosaveTimers.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const nextTimeout = setTimeout(() => {
      this.autosaveTimers.delete(key);
      callback();
    }, 700);

    this.autosaveTimers.set(key, nextTimeout);
  }

  private cancelAutosave(key: string): void {
    const timeoutId = this.autosaveTimers.get(key);
    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    this.autosaveTimers.delete(key);
  }

  private saveAutosave(): void {
    this.requestProfileSave(this.i18n.t('profile.toast.savedField'), false);
  }

  private saveAllNow(): void {
    this.cancelAutosave('profile:all');
    this.requestProfileSave(this.i18n.t('profile.toast.profileSaved'), true);
  }

  private requestProfileSave(successMessage: string, showValidationError: boolean): void {
    if (!this.identityId || !this.profile()) {
      return;
    }

    if (this.profileSaveInFlight) {
      this.profileSaveQueued = true;
      this.queuedProfileSaveMessage = successMessage;
      this.queuedProfileShowValidationError ||= showValidationError;
      return;
    }

    const payload = this.buildFormattedPayload();
    if (!payload) {
      if (showValidationError) {
        this.toastService.error(this.i18n.t('profile.toast.saveError'));
      }
      return;
    }

    this.persist(payload, successMessage, { profileSave: true });
  }

  private buildFormattedPayload(): DoctorUpdatePayload | null {
    const form = this.form();
    const sec = this.secretaries();
    const normalizedClinics = this.clinics()
      .map((clinic) => ({
        name: clinic.name.trim(),
        address: clinic.address.trim(),
        phoneNumber: clinic.phoneNumber.trim(),
        googleMapsLink: clinic.googleMapsLink.trim(),
      }))
      .filter(
        (clinic) =>
          clinic.name !== '' ||
          clinic.address !== '' ||
          clinic.phoneNumber !== '' ||
          clinic.googleMapsLink !== '',
      );

    const firstSecretaryFirstName = sec.firstSecretaryFirstName.trim();
    const firstSecretaryLastName = sec.firstSecretaryLastName.trim();
    const secondSecretaryFirstName = sec.secondSecretaryFirstName.trim();
    const secondSecretaryLastName = sec.secondSecretaryLastName.trim();
    const firstSecretaryHasAny =
      firstSecretaryFirstName !== '' || firstSecretaryLastName !== '';
    const firstSecretaryComplete =
      firstSecretaryFirstName !== '' && firstSecretaryLastName !== '';
    const firstSecretaryHalfFilled = firstSecretaryHasAny && !firstSecretaryComplete;
    const secondSecretaryHasAny =
      secondSecretaryFirstName !== '' || secondSecretaryLastName !== '';
    const secondSecretaryComplete =
      sec.isSecondSecretaryEnabled &&
      secondSecretaryFirstName !== '' &&
      secondSecretaryLastName !== '';
    const secondSecretaryHalfFilled =
      sec.isSecondSecretaryEnabled && secondSecretaryHasAny && !secondSecretaryComplete;

    if (firstSecretaryHalfFilled || secondSecretaryHalfFilled) {
      return null;
    }

    const payload: DoctorUpdatePayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      firstNameInArabic: form.firstNameInArabic.trim(),
      lastNameInArabic: form.lastNameInArabic.trim(),
      phoneNumber: form.phoneNumber.trim(),
      landline: form.landline.trim(),
      codeCnam: form.codeCnam.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      cabinetAddress: form.cabinetAddress.trim(),
      isSecondSecretaryEnabled: sec.isSecondSecretaryEnabled,
      selfCheckinEnabled: this.selfCheckin().enabled,
      selfCheckinTimeoutSeconds: this.selfCheckin().timeoutSeconds,
      clearFirstSecretary: !firstSecretaryHasAny,
      clearSecondSecretary:
        !sec.isSecondSecretaryEnabled || !secondSecretaryHasAny,
      clearClinics: normalizedClinics.length === 0,
      clinics: normalizedClinics,
      personalization: {
        ...this.personalization(),
      },
    };

    if (!payload.clearFirstSecretary) {
      payload.firstSecretary = {
        firstName: firstSecretaryFirstName,
        lastName: firstSecretaryLastName,
      };
    }

    if (!payload.clearSecondSecretary && sec.isSecondSecretaryEnabled) {
      payload.secondSecretary = {
        firstName: secondSecretaryFirstName,
        lastName: secondSecretaryLastName,
      };
    }

    return payload;
  }

  private persist(
    payload: DoctorUpdatePayload,
    successMessage: string,
    options: { profileSave?: boolean } = {},
  ): void {
    if (!this.identityId) {
      return;
    }

    const secretaryVersionAtRequest = this.secretaryEditVersion;
    const isProfileSave = options.profileSave === true;

    if (isProfileSave) {
      this.profileSaveInFlight = true;
    }
    this.isSaving.set(true);
    this.doctorService.update(this.identityId, payload).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        this.form.set({
          firstName: updated.firstName ?? '',
          lastName: updated.lastName ?? '',
          firstNameInArabic: updated.firstNameInArabic ?? '',
          lastNameInArabic: updated.lastNameInArabic ?? '',
          phoneNumber: updated.phoneNumber ?? '',
          landline: updated.landline ?? '',
          codeCnam: updated.codeCnam ?? '',
          city: updated.city ?? '',
          postalCode: updated.postalCode ?? '',
          cabinetAddress: updated.cabinetAddress ?? '',
        });
        if (secretaryVersionAtRequest === this.secretaryEditVersion) {
          this.secretaries.set({
            isSecondSecretaryEnabled: !!updated.isSecondSecretaryEnabled,
            firstSecretaryFirstName: updated.firstSecretary?.firstName ?? '',
            firstSecretaryLastName: updated.firstSecretary?.lastName ?? '',
            secondSecretaryFirstName: updated.secondSecretary?.firstName ?? '',
            secondSecretaryLastName: updated.secondSecretary?.lastName ?? '',
          });
        }
        this.clinics.set(this.mapClinicsToForm(updated.clinics));
        this.personalization.set(this.mapPersonalizationToForm(updated.personalization));
        this.selfCheckin.set({
          enabled: updated.selfCheckinEnabled ?? true,
          timeoutSeconds: updated.selfCheckinTimeoutSeconds ?? 90,
        });
        this.pathImage.set(this.resolveProfilePictureUrl(updated.profilePictureUrl));
        window.dispatchEvent(new CustomEvent('profile-updated'));
        this.toastService.success(successMessage);
        if (this.showAutoDailyNewsQueuedToastAfterSave) {
          this.toastService.info(this.i18n.t('profile.toast.autoDailyNewsGenerationQueued'));
          this.showAutoDailyNewsQueuedToastAfterSave = false;
        }
        this.finishPersist(isProfileSave);
      },
      error: () => {
        this.showAutoDailyNewsQueuedToastAfterSave = false;
        this.toastService.error(this.i18n.t('profile.toast.saveError'));
        this.finishPersist(isProfileSave);
      },
    });
  }

  private finishPersist(isProfileSave: boolean): void {
    if (!isProfileSave) {
      this.isSaving.set(false);
      return;
    }

    this.profileSaveInFlight = false;

    if (!this.profileSaveQueued) {
      this.isSaving.set(false);
      return;
    }

    const nextMessage = this.queuedProfileSaveMessage ?? this.i18n.t('profile.toast.savedField');
    const nextShowValidationError = this.queuedProfileShowValidationError;
    this.profileSaveQueued = false;
    this.queuedProfileSaveMessage = null;
    this.queuedProfileShowValidationError = false;
    this.requestProfileSave(nextMessage, nextShowValidationError);
  }

  private mapClinicsToForm(clinics: Clinic[] | null | undefined): ClinicForm[] {
    if (!clinics?.length) {
      return [];
    }

    return clinics
      .map((clinic) => ({
        name: clinic.name ?? '',
        address: clinic.address ?? '',
        phoneNumber: clinic.phoneNumber ?? '',
        googleMapsLink: clinic.googleMapsLink ?? '',
      }))
      .filter((clinic) =>
        [clinic.name, clinic.address, clinic.phoneNumber, clinic.googleMapsLink].some(
          (value) => value.trim() !== '',
        ),
      );
  }

  private createEmptyClinic(): ClinicForm {
    return {
      name: '',
      address: '',
      phoneNumber: '',
      googleMapsLink: '',
    };
  }

  private mapPersonalizationToForm(
    personalization: DoctorPersonalization | null | undefined,
  ): PersonalizationForm {
    if (!personalization) {
      return this.createDefaultPersonalization();
    }

    return {
      waitingRoomMessage: personalization.waitingRoomMessage ?? '',
      dailyNews: personalization.dailyNews ?? '',
      dailyNewsFr: personalization.dailyNewsFr ?? personalization.dailyNews ?? '',
      dailyNewsEn: personalization.dailyNewsEn ?? personalization.dailyNews ?? '',
      dailyNewsAr: personalization.dailyNewsAr ?? personalization.dailyNews ?? '',
      useSuperAdminDailyNews: personalization.useSuperAdminDailyNews ?? false,
      autoDailyNewsEnabled: personalization.autoDailyNewsEnabled ?? false,
      showHeader: personalization.showHeader,
      showFirstName: personalization.showFirstName,
      showLastName: personalization.showLastName,
      showCodeCnam: personalization.showCodeCnam,
      showFirstNameArabic: personalization.showFirstNameArabic,
      showLastNameArabic: personalization.showLastNameArabic,
      showFooter: personalization.showFooter,
      showFooterCabinetAddress: personalization.showFooterCabinetAddress,
      showFooterLandline: personalization.showFooterLandline,
      showFooterMobile: personalization.showFooterMobile,
      showFooterEmail: personalization.showFooterEmail,
    };
  }

  private createDefaultPersonalization(): PersonalizationForm {
    return {
      waitingRoomMessage: '',
      dailyNews: '',
      dailyNewsFr: '',
      dailyNewsEn: '',
      dailyNewsAr: '',
      useSuperAdminDailyNews: false,
      autoDailyNewsEnabled: false,
      showHeader: true,
      showFirstName: true,
      showLastName: true,
      showCodeCnam: true,
      showFirstNameArabic: false,
      showLastNameArabic: false,
      showFooter: true,
      showFooterCabinetAddress: true,
      showFooterLandline: true,
      showFooterMobile: true,
      showFooterEmail: true,
    };
  }

  private logoutAndRedirect(): void {
    this.auth.logout();
    this.userContext.clear();
    this.router.navigate(['/login']);
  }

  private resolveProfilePictureUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    if (path.startsWith('/')) {
      return `${environment.apiUrl}${path}`;
    }

    return `${environment.apiUrl}/${path}`;
  }
}
