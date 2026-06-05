import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  ChangeDoctorRoleRequest,
  CreateDoctorApiResponse,
  CreateDoctorRequest,
  CreateDoctorResult,
  DoctorListItem,
  DoctorSubscriptionStatus,
  ListDoctorsQuery,
  ListDoctorsResponse,
  UpdateDoctorByAdminRequest,
} from '../models/admin.models';
import { API } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly http: HttpClient) {}

  suspendDoctor(doctorId: string): Observable<{ message: string }> {
    return this.http
      .patch<CreateDoctorApiResponse>(API.admin.suspendDoctor(doctorId), {})
      .pipe(map((response) => ({ message: response.message ?? response.Message ?? '' })));
  }

  reactivateDoctor(
    doctorId: string,
    subscriptionDurationInMonths?: number,
  ): Observable<{ message: string }> {
    return this.http
      .patch<CreateDoctorApiResponse>(API.admin.reactivateDoctor(doctorId), {
        subscriptionDurationInMonths,
      })
      .pipe(map((response) => ({ message: response.message ?? response.Message ?? '' })));
  }

  changeDoctorRole(
    doctorId: string,
    payload: ChangeDoctorRoleRequest,
  ): Observable<{ message: string }> {
    return this.http
      .patch<CreateDoctorApiResponse>(API.admin.changeDoctorRole(doctorId), payload)
      .pipe(map((response) => ({ message: response.message ?? response.Message ?? '' })));
  }

  removeAdmin(doctorId: string): Observable<{ message: string }> {
    return this.http
      .delete<CreateDoctorApiResponse>(API.admin.removeAdmin(doctorId))
      .pipe(map((response) => ({ message: response.message ?? response.Message ?? '' })));
  }

  deleteDoctor(doctorId: string): Observable<{ message: string }> {
    return this.http
      .delete<CreateDoctorApiResponse>(API.admin.deleteDoctor(doctorId))
      .pipe(map((response) => ({ message: response.message ?? response.Message ?? '' })));
  }

  getDoctorById(doctorId: string): Observable<DoctorListItem> {
    return this.http
      .get<unknown>(API.admin.getDoctor(doctorId))
      .pipe(map((response) => this.mapDoctor(response)));
  }

  updateDoctorByAdmin(
    doctorId: string,
    payload: UpdateDoctorByAdminRequest,
  ): Observable<DoctorListItem> {
    return this.http
      .put<unknown>(API.admin.updateDoctor(doctorId), payload)
      .pipe(map((response) => this.mapDoctor(response)));
  }

  createDoctor(payload: CreateDoctorRequest): Observable<CreateDoctorResult> {
    const requestBody = {
      firstname: payload.firstName.trim(),
      lastname: payload.lastName.trim(),
      email: payload.email.trim(),
      nationality: payload.nationality.trim(),
      role: payload.role,
      phoneNumber: payload.phoneNumber.trim(),
      landline: payload.landline.trim(),
      cabinetCountry: payload.cabinetCountry.trim(),
      cabinetCity: payload.cabinetCity.trim(),
      cabinetAddress: payload.cabinetAddress.trim(),
      languagePreference: payload.languagePreference,
      cabinetPostalCode: payload.cabinetPostalCode.trim(),
      notesFromAdmin: payload.notesFromAdmin?.trim() || null,
      subscriptionDurationInMonths: Math.max(1, Math.trunc(payload.subscriptionDurationInMonths)),
    };

    return this.http
      .post<CreateDoctorApiResponse>(API.admin.createDoctor, requestBody)
      .pipe(map((response) => ({ message: response.message ?? response.Message ?? '' })));
  }

  getDoctors(query: ListDoctorsQuery = {}): Observable<ListDoctorsResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 10));

    if (query.searchQuery) {
      params = params.set('searchQuery', query.searchQuery.trim());
    }
    if (query.sortBy) {
      params = params.set('sortBy', query.sortBy);
    }
    if (query.sortDirection) {
      params = params.set('sortDirection', query.sortDirection);
    }
    if (query.roleFilter) {
      params = params.set('roleFilter', query.roleFilter);
    }
    if (query.statusFilter) {
      params = params.set('statusFilter', query.statusFilter);
    }

    return this.http.get<unknown>(API.admin.listDoctors, { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const rawDoctors = this.readArray(source, 'doctors', 'Doctors', 'items', 'Items');
        const doctors = rawDoctors.map((doctor) => this.mapDoctor(doctor));
        const totalCount = this.readNumber(source, ['totalCount', 'TotalCount', 'count', 'Count'], doctors.length);

        return { doctors, totalCount };
      }),
    );
  }

  private mapDoctor(payload: unknown): DoctorListItem {
    const source = this.unwrapPayload(payload);
    const sourceRole = this.readString(source, ['role', 'Role']);
    const role = this.normalizeRole(sourceRole);
    const isSuperAdmin =
      this.readBoolean(source, ['isSuperAdmin', 'IsSuperAdmin']) ||
      sourceRole.trim().toLowerCase().startsWith('super_admin');

    return {
      id: this.readString(source, ['id', 'Id']),
      cabinetIdentityId: this.readString(source, ['cabinetIdentityId', 'CabinetIdentityId']),
      firstName: this.readString(source, ['firstname', 'Firstname', 'firstName', 'FirstName']),
      lastName: this.readString(source, ['lastname', 'Lastname', 'lastName', 'LastName']),
      email: this.readString(source, ['email', 'Email']),
      nationality: this.readString(source, ['nationality', 'Nationality']),
      role,
      isSuperAdmin,
      phoneNumber: this.readString(source, ['phoneNumber', 'PhoneNumber']),
      landline: this.readString(source, ['landline', 'Landline']),
      languagePreference: this.normalizeLanguage(this.readString(source, ['languagePreference', 'LanguagePreference'])),
      cabinetCountry: this.readString(source, ['cabinetCountry', 'CabinetCountry']),
      cabinetCity: this.readString(source, ['cabinetCity', 'CabinetCity']),
      cabinetAddress: this.readString(source, ['cabinetAddress', 'CabinetAddress']),
      cabinetPostalCode: this.readString(source, ['cabinetPostalCode', 'CabinetPostalCode']),
      notesFromAdmin: this.readString(source, ['notesFromAdmin', 'NotesFromAdmin']),
      profilePictureUrl: this.readString(source, ['profilePictureUrl', 'ProfilePictureUrl']),
      isCabinetActive: this.readBoolean(source, ['isCabinetActive', 'IsCabinetActive']),
      isFlaggedForDeletion: this.readBoolean(source, ['isFlaggedForDeletion', 'IsFlaggedForDeletion']),
      subscriptionStartDate: this.readString(source, ['subscriptionStartDate', 'SubscriptionStartDate']),
      subscriptionEndDate: this.readString(source, ['subscriptionEndDate', 'SubscriptionEndDate']),
      subscriptionDurationInMonths: this.readNumber(source, ['subscriptionDurationInMonths', 'SubscriptionDurationInMonths'], 0),
      subscriptionIsActive: this.readBoolean(source, ['subscriptionIsActive', 'SubscriptionIsActive']),
      subscriptionType: this.readString(source, ['subscriptionType', 'SubscriptionType']),
      subscriptionStatus: this.normalizeSubscriptionStatus(this.readString(source, ['subscriptionStatus', 'SubscriptionStatus'])),
      subscriptionDaysRemaining: this.readNullableNumber(source, ['subscriptionDaysRemaining', 'SubscriptionDaysRemaining']),
      createdAt: this.readString(source, ['createdAt', 'CreatedAt']),
    };
  }

  private normalizeRole(role: string): 'doctor' | 'admin' {
    const normalized = role.trim().toLowerCase();
    return normalized.startsWith('admin') || normalized.startsWith('super_admin')
      ? 'admin'
      : 'doctor';
  }

  private normalizeLanguage(language: string): 'fr' | 'en' | 'ar' {
    const normalized = language.trim().toLowerCase();
    if (normalized === 'en' || normalized === 'ar') {
      return normalized;
    }
    return 'fr';
  }

  private normalizeSubscriptionStatus(status: string): DoctorSubscriptionStatus {
    const normalized = status.trim().toLowerCase();
    if (
      normalized === 'active' ||
      normalized === 'expiring_soon' ||
      normalized === 'expired' ||
      normalized === 'suspended' ||
      normalized === 'admin' ||
      normalized === 'deleted'
    ) {
      return normalized;
    }
    return 'expired';
  }

  private unwrapPayload(payload: unknown): Record<string, unknown> {
    const source = (payload as Record<string, unknown>) ?? {};
    const wrapped =
      (source['result'] as Record<string, unknown> | undefined) ??
      (source['data'] as Record<string, unknown> | undefined) ??
      (source['value'] as Record<string, unknown> | undefined);

    return wrapped ?? source;
  }

  private readString(source: unknown, keys: string[]): string {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
    return '';
  }

  private readNumber(source: unknown, keys: string[], fallback: number): number {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return fallback;
  }

  private readNullableNumber(source: unknown, keys: string[]): number | null {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (value === null || value === undefined || value === '') {
        return null;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private readBoolean(source: unknown, keys: string[]): boolean {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
          return true;
        }
        if (normalized === 'false') {
          return false;
        }
      }
      if (typeof value === 'number') {
        return value !== 0;
      }
    }
    return false;
  }

  private readArray(source: unknown, ...keys: string[]): unknown[] {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  }
}
