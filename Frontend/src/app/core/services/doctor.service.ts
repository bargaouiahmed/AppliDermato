import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API } from '../config/api.config';
import {
  DoctorClinicApiResponse,
  DoctorPersonalization,
  DoctorPersonalizationApiResponse,
  DoctorProfile,
  DoctorProfileApiResponse,
  DoctorSecretaryApiResponse,
} from '../models/doctor.models';

export interface DoctorUpdatePayload {
  firstName?: string;
  lastName?: string;
  firstNameInArabic?: string;
  lastNameInArabic?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  landline?: string;
  cabinetAddress?: string;
  postalCode?: string;
  city?: string;
  codeCnam?: string;
  profilePicture?: File;
  isSecondSecretaryEnabled?: boolean;
  selfCheckinEnabled?: boolean;
  selfCheckinTimeoutSeconds?: number;
  clearFirstSecretary?: boolean;
  clearSecondSecretary?: boolean;
  firstSecretary?: {
    firstName: string;
    lastName: string;
  } | null;
  secondSecretary?: {
    firstName: string;
    lastName: string;
  } | null;
  clearClinics?: boolean;
  clinics?: Array<{
    name: string;
    address: string;
    phoneNumber: string;
    googleMapsLink: string;
  }>;
  personalization?: Partial<DoctorPersonalization>;
}

export interface DoctorPasswordUpdatePayload {
  oldPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  constructor(private readonly http: HttpClient) {}

  getById(id: string): Observable<DoctorProfile> {
    return this.http
      .get<DoctorProfileApiResponse>(API.doctor.getById(id))
      .pipe(map((profile) => this.mapProfile(profile)));
  }

  update(id: string, payload: DoctorUpdatePayload): Observable<DoctorProfile> {
    return this.http
      .put<DoctorProfileApiResponse>(API.doctor.update(id), this.toFormData(id, payload))
      .pipe(map((profile) => this.mapProfile(profile)));
  }

  updatePassword(payload: DoctorPasswordUpdatePayload): Observable<void> {
    return this.http.put<void>(API.doctor.updatePassword, payload);
  }

  private toFormData(identityId: string, payload: DoctorUpdatePayload): FormData {
    const formData = new FormData();

    const append = (key: string, value: unknown): void => {
      if (value === undefined || value === null) {
        return;
      }

      formData.append(key, String(value));
    };

    append('Id', identityId);
    append('Firstname', payload.firstName);
    append('Lastname', payload.lastName);
    append('FirstnameAr', payload.firstNameInArabic);
    append('LastnameAr', payload.lastNameInArabic);
    append('DateOfBirth', payload.dateOfBirth);
    append('PhoneNumber', payload.phoneNumber);
    append('Landline', payload.landline);
    append('Address', payload.cabinetAddress);
    append('PostalCode', payload.postalCode);
    append('City', payload.city);
    append('CodeCnam', payload.codeCnam);
    append('IsSecondSecretaryActive', payload.isSecondSecretaryEnabled);
    append('SelfCheckinEnabled', payload.selfCheckinEnabled);
    append('SelfCheckinTimeoutSeconds', payload.selfCheckinTimeoutSeconds);
    append('ClearFirstSecretary', payload.clearFirstSecretary);
    append('ClearSecondSecretary', payload.clearSecondSecretary);
    append('ClearClinics', payload.clearClinics);

    if (payload.profilePicture) {
      formData.append('Pfp', payload.profilePicture);
    }

    const secretaries: Array<{ firstName: string; lastName: string; index: number }> = [];

    if (
      !payload.clearFirstSecretary &&
      payload.firstSecretary?.firstName &&
      payload.firstSecretary?.lastName
    ) {
      secretaries.push({
        firstName: payload.firstSecretary.firstName,
        lastName: payload.firstSecretary.lastName,
        index: 1,
      });
    }

    if (
      payload.isSecondSecretaryEnabled &&
      !payload.clearSecondSecretary &&
      payload.secondSecretary?.firstName &&
      payload.secondSecretary?.lastName
    ) {
      secretaries.push({
        firstName: payload.secondSecretary.firstName,
        lastName: payload.secondSecretary.lastName,
        index: 2,
      });
    }

    for (let i = 0; i < secretaries.length; i += 1) {
      const sec = secretaries[i];
      append(`Secretaries[${i}].Firstname`, sec.firstName);
      append(`Secretaries[${i}].Lastname`, sec.lastName);
      append(`Secretaries[${i}].Index`, sec.index);
    }

    if (payload.clinics) {
      for (let i = 0; i < payload.clinics.length; i += 1) {
        const clinic = payload.clinics[i];
        append(`Clinics[${i}].Name`, clinic.name);
        append(`Clinics[${i}].Address`, clinic.address);
        append(`Clinics[${i}].PhoneNumber`, clinic.phoneNumber);
        append(`Clinics[${i}].GoogleMapsLink`, clinic.googleMapsLink);
      }
    }

    const personalization = payload.personalization;
    if (personalization) {
      append('Personalization.WaitingRoomMessage', personalization.waitingRoomMessage);
      append('Personalization.DailyNews', personalization.dailyNews);
      append('Personalization.DailyNewsFr', personalization.dailyNewsFr || personalization.dailyNews);
      append('Personalization.DailyNewsEn', personalization.dailyNewsEn || personalization.dailyNews);
      append('Personalization.DailyNewsAr', personalization.dailyNewsAr || personalization.dailyNews);
      append('Personalization.DailyNewsSet', true);
      append('Personalization.AutoDailyNewsEnabled', personalization.autoDailyNewsEnabled);
      append('Personalization.ShowHeader', personalization.showHeader);
      append('Personalization.ShowFirstName', personalization.showFirstName);
      append('Personalization.ShowLastName', personalization.showLastName);
      append('Personalization.ShowCodeCnam', personalization.showCodeCnam);
      append('Personalization.ShowFirstNameArabic', personalization.showFirstNameArabic);
      append('Personalization.ShowLastNameArabic', personalization.showLastNameArabic);
      append('Personalization.ShowFooter', personalization.showFooter);
      append('Personalization.ShowFooterCabinetAddress', personalization.showFooterCabinetAddress);
      append('Personalization.ShowFooterLandline', personalization.showFooterLandline);
      append('Personalization.ShowFooterMobile', personalization.showFooterMobile);
      append('Personalization.ShowFooterEmail', personalization.showFooterEmail);
    }

    return formData;
  }

  private mapProfile(profile: DoctorProfileApiResponse): DoctorProfile {
    const secretaries = (profile.secretaries ?? []).slice();
    const firstSecretary = this.mapSecretary(this.findSecretaryForSlot(secretaries, 1), 1);
    const secondSecretary = this.mapSecretary(this.findSecretaryForSlot(secretaries, 2), 2);
    const clinics = (profile.clinics ?? []).map((clinic, idx) => this.mapClinic(clinic, idx));
    const personalization = this.mapPersonalization(profile.personalization ?? null);

    return {
      id: profile.id ?? '',
      doctorId: profile.doctorId ?? '',
      firstName: profile.firstname ?? '',
      lastName: profile.lastname ?? '',
      email: profile.email ?? '',
      profilePictureUrl: profile.profilePictureUrl ?? null,
      gender: profile.gender ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      nationality: profile.nationality ?? '',
      phoneNumber: profile.phoneNumber ?? '',
      landline: profile.landline ?? '',
      country: profile.country ?? '',
      cabinetAddress: profile.address ?? '',
      postalCode: profile.postalCode ?? '',
      city: profile.city ?? '',
      codeCnam: profile.codeCnam ?? '',
      role: profile.role ?? '',
      verified: undefined,
      isActiveSubscription: undefined,
      isSecondSecretaryEnabled:
        profile.isSecondSecretaryActive ?? secondSecretary !== null,
      selfCheckinEnabled: profile.selfCheckinEnabled ?? true,
      selfCheckinKey: profile.selfCheckinKey ?? null,
      selfCheckinTimeoutSeconds: profile.selfCheckinTimeoutSeconds ?? 90,
      clinics,
      personalization,
      firstSecretary,
      secondSecretary,
      notes: null,
      firstNameInArabic: profile.firstnameAr ?? null,
      lastNameInArabic: profile.lastnameAr ?? null,
      messageSalleAttente: personalization.waitingRoomMessage ?? null,
      actualiteDuJour: personalization.dailyNews ?? null,
    };
  }

  private mapSecretary(sec: DoctorSecretaryApiResponse | undefined, fallbackIndex: number) {
    if (!sec) {
      return null;
    }

    return {
      id: sec.id ?? '',
      firstName: sec.firstname ?? '',
      lastName: sec.lastname ?? '',
      index: sec.index ?? fallbackIndex,
    };
  }

  private findSecretaryForSlot(
    secretaries: DoctorSecretaryApiResponse[],
    slot: 1 | 2,
  ): DoctorSecretaryApiResponse | undefined {
    const hasLegacyZeroBasedSlots = secretaries.some((sec) => sec.index === 0);
    if (hasLegacyZeroBasedSlots) {
      return secretaries.find((sec) => sec.index === slot - 1);
    }

    const canonical = secretaries.find((sec) => sec.index === slot);
    if (canonical) {
      return canonical;
    }

    const hasCanonicalSlots = secretaries.some((sec) => sec.index === 1 || sec.index === 2);
    if (hasCanonicalSlots) {
      return undefined;
    }

    return secretaries
      .slice()
      .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))[slot - 1];
  }

  private mapClinic(clinic: DoctorClinicApiResponse, index: number) {
    return {
      id: clinic.id ?? `clinic-${index}`,
      name: clinic.name ?? '',
      address: clinic.address ?? '',
      phoneNumber: clinic.phoneNumber ?? '',
      googleMapsLink: clinic.googleMapsLink ?? '',
    };
  }

  private mapPersonalization(
    personalization: DoctorPersonalizationApiResponse | null,
  ): DoctorPersonalization {
    return {
      waitingRoomMessage: personalization?.waitingRoomMessage ?? '',
      dailyNews: personalization?.dailyNews ?? '',
      dailyNewsFr: personalization?.dailyNewsFr ?? personalization?.dailyNews ?? '',
      dailyNewsEn: personalization?.dailyNewsEn ?? personalization?.dailyNews ?? '',
      dailyNewsAr: personalization?.dailyNewsAr ?? personalization?.dailyNews ?? '',
      useSuperAdminDailyNews: personalization?.useSuperAdminDailyNews ?? false,
      autoDailyNewsEnabled: personalization?.autoDailyNewsEnabled ?? false,
      showHeader: personalization?.showHeader ?? true,
      showFirstName: personalization?.showFirstName ?? true,
      showLastName: personalization?.showLastName ?? true,
      showCodeCnam: personalization?.showCodeCnam ?? true,
      showFirstNameArabic: personalization?.showFirstNameArabic ?? false,
      showLastNameArabic: personalization?.showLastNameArabic ?? false,
      showFooter: personalization?.showFooter ?? true,
      showFooterCabinetAddress: personalization?.showFooterCabinetAddress ?? true,
      showFooterLandline: personalization?.showFooterLandline ?? true,
      showFooterMobile: personalization?.showFooterMobile ?? true,
      showFooterEmail: personalization?.showFooterEmail ?? true,
    };
  }
}
