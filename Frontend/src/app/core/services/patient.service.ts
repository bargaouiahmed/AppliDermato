import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '../config/api.config';
import {
  AddPatientRequest,
  GetPatientProfessionsQuery,
  GetPatientsQuery,
  NextPatientDossierNumberResponse,
  DailyConsultation,
  DailyConsultationListResponse,
  ConsultationDatesResponse,
  Patient,
  PatientConsultationListResponse,
  PatientProfessionListResponse,
  PatientListResponse,
  UpdatePatientRequest,
  VerifyPatientDossierNumberResponse,
} from '../models/patient.models';

@Injectable({ providedIn: 'root' })
export class PatientService {
  constructor(private readonly http: HttpClient) {}

  addPatient(request: AddPatientRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(API.patients.add, request);
  }

  getNextDossierNumber(): Observable<NextPatientDossierNumberResponse> {
    return this.http.get<unknown>(API.patients.nextDossierNumber).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const nextDossierNumber = this.readNumber(
          source,
          ['nextDossierNumber', 'NextDossierNumber', 'nextNumFiche', 'NextNumFiche'],
          0,
        );

        return { nextDossierNumber };
      }),
    );
  }

  getPatientById(patientId: string): Observable<Patient> {
    return this.http.get<unknown>(API.patients.getById(patientId)).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const nestedPatient =
          (source['patient'] as Record<string, unknown> | undefined) ??
          (source['Patient'] as Record<string, unknown> | undefined);
        return this.mapPatient(nestedPatient ?? source);
      }),
    );
  }

  updatePatient(patientId: string, request: UpdatePatientRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(API.patients.update(patientId), request);
  }

  deletePatient(patientId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(API.patients.delete(patientId));
  }

  getAllPatients(query: GetPatientsQuery = {}): Observable<PatientListResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 10));

    if (query.searchQuery) {
      params = params.set('searchQuery', query.searchQuery);
    }
    if (query.dateOfBirth) {
      params = params.set('dateOfBirth', query.dateOfBirth);
    }
    if (query.name) {
      params = params.set('name', query.name);
    }
    if (query.firstname) {
      params = params.set('firstname', query.firstname);
    }
    if (query.lastname) {
      params = params.set('lastname', query.lastname);
    }
    if (query.email) {
      params = params.set('email', query.email);
    }
    if (query.phoneNumber) {
      params = params.set('phoneNumber', query.phoneNumber);
    }
    if (query.dossierNumber !== undefined) {
      params = params.set('dossierNumber', String(query.dossierNumber));
    }
    if (query.age !== undefined) {
      params = params.set('age', String(query.age));
    }
    if (query.sortBy) {
      params = params.set('sortBy', query.sortBy);
    }
    if (query.sortDirection) {
      params = params.set('sortDirection', query.sortDirection);
    }

    return this.http.get<unknown>(API.patients.getAll, { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const rawPatients = this.readArray(
          source,
          'patients',
          'Patients',
          'results',
          'Results',
          'items',
          'Items',
          'rows',
          'Rows',
        );
        const patients = rawPatients.map((patient) => this.mapPatient(patient));
        const totalCount = this.readNumber(
          source,
          [
            'totalCount',
            'TotalCount',
            'count',
            'Count',
            'totalPatients',
            'TotalPatients',
            'total',
            'Total',
          ],
          patients.length,
        );

        return { patients, totalCount };
      }),
    );
  }

  getRecentPatients(query: Pick<GetPatientsQuery, 'pageNumber' | 'pageSize'> = {}): Observable<PatientListResponse> {
    const params = new HttpParams()
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 10));

    return this.http.get<unknown>(API.patients.getRecent, { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const rawPatients = this.readArray(
          source,
          'patients',
          'Patients',
          'results',
          'Results',
          'items',
          'Items',
          'rows',
          'Rows',
        );
        const patients = rawPatients.map((patient) => this.mapPatient(patient));
        const totalCount = this.readNumber(
          source,
          [
            'totalCount',
            'TotalCount',
            'count',
            'Count',
            'totalPatients',
            'TotalPatients',
            'total',
            'Total',
          ],
          patients.length,
        );

        return { patients, totalCount };
      }),
    );
  }

  getPatientProfessions(query: GetPatientProfessionsQuery = {}): Observable<PatientProfessionListResponse> {
    let params = new HttpParams()
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 25));

    if (query.searchQuery) {
      params = params.set('searchQuery', query.searchQuery);
    }

    return this.http.get<unknown>(API.patients.professions, { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const professions = this.readArray(source, 'professions', 'Professions')
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
        const totalCount = this.readNumber(source, ['totalCount', 'TotalCount', 'count', 'Count', 'total', 'Total'], professions.length);

        return {
          professions,
          totalCount,
        };
      }),
    );
  }

  verifyDossierNumber(dossierNumber: number): Observable<VerifyPatientDossierNumberResponse> {
    return this.http
      .post<unknown>(API.patients.verifyDossierNumber, { dossierNumber })
      .pipe(
        map((response) => {
          const source = this.unwrapPayload(response);
          const isUsedRaw = source['isUsed'] ?? source['IsUsed'];
          const message = this.readString(source, ['message', 'Message']) || '';

          return {
            isUsed: typeof isUsedRaw === 'boolean' ? isUsedRaw : false,
            message,
          };
        }),
      );
  }

  exportPatientsCsv(searchQuery?: string, dateOfBirth?: string, name?: string, email?: string, phoneNumber?: string, dossierNumber?: number, firstname?: string, lastname?: string, age?: number): Observable<Blob> {
    let params = new HttpParams();
    if (searchQuery && searchQuery.trim()) {
      params = params.set('searchQuery', searchQuery.trim());
    }
    if (dateOfBirth && dateOfBirth.trim()) {
      params = params.set('dateOfBirth', dateOfBirth.trim());
    }
    if (name && name.trim()) {
      params = params.set('name', name.trim());
    }
    if (firstname && firstname.trim()) {
      params = params.set('firstname', firstname.trim());
    }
    if (lastname && lastname.trim()) {
      params = params.set('lastname', lastname.trim());
    }
    if (email && email.trim()) {
      params = params.set('email', email.trim());
    }
    if (phoneNumber && phoneNumber.trim()) {
      params = params.set('phoneNumber', phoneNumber.trim());
    }
    if (dossierNumber !== undefined) {
      params = params.set('dossierNumber', String(dossierNumber));
    }
    if (age !== undefined) {
      params = params.set('age', String(age));
    }

    return this.http.get(API.patients.exportCsv, {
      params,
      responseType: 'blob',
    });
  }

  getPatientConsultations(
    patientId: string,
    pageNumber = 1,
    pageSize = 10,
  ): Observable<PatientConsultationListResponse> {
    const params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));

    return this.http.get<unknown>(API.patients.getConsultations(patientId), { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const rawConsultations = this.readArray(source, 'consultations', 'Consultations');
        const consultations = rawConsultations.map((item) => ({
          id: this.readString(item, ['id', 'Id']),
          consultationDate: this.readString(item, ['consultationDate', 'ConsultationDate']),
          duration: this.readString(item, ['duration', 'Duration']) || '00:00:00',
          isTimerPaused: this.readBoolean(item, ['isTimerPaused', 'IsTimerPaused'], false),
          isDone: this.readBoolean(item, ['isDone', 'IsDone'], false),
          motifs: this.readArray(item, 'motifs', 'Motifs', 'motif', 'Motif').map((motif) =>
            String(motif),
          ),
          diagnostics: this.readArray(item, 'diagnostics', 'Diagnostics').map((d) =>
            String(d),
          ),
          conduiteActions: this.readArray(item, 'conduiteActions', 'ConduiteActions').map((a) =>
            String(a),
          ),
        }));

        const totalCount = this.readNumber(
          source,
          [
            'totalCount',
            'TotalCount',
            'count',
            'Count',
            'totalConsultations',
            'TotalConsultations',
            'total',
            'Total',
          ],
          consultations.length,
        );

        return { consultations, totalCount };
      }),
    );
  }

  getDailyConsultations(date?: string): Observable<DailyConsultationListResponse> {
    let params = new HttpParams();
    if (date && date.trim()) {
      params = params.set('date', date.trim());
    }

    return this.http.get<unknown>(API.patients.getConsultationsByDate, { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const dateValue = this.readString(source, ['date', 'Date']) || '';
        const consultationsRaw = this.readArray(source, 'consultations', 'Consultations', 'results', 'Results');
        const consultations: DailyConsultation[] = consultationsRaw.map((item) => ({
          id: this.readString(item, ['id', 'Id']),
          patientId: this.readString(item, ['patientId', 'PatientId']),
          patientDossierNumber: this.readNumber(item, ['patientDossierNumber', 'PatientDossierNumber'], 0),
          patientFirstname: this.readString(item, ['patientFirstname', 'PatientFirstname']),
          patientLastname: this.readString(item, ['patientLastname', 'PatientLastname']),
          patientProfession: this.readString(item, ['patientProfession', 'PatientProfession']),
          patientAge: this.readNumber(item, ['patientAge', 'PatientAge'], 0),
          patientConsultationCount: this.readNumber(item, ['patientConsultationCount', 'PatientConsultationCount'], 0),
          consultationDate: this.readString(item, ['consultationDate', 'ConsultationDate']),
          duration: this.readString(item, ['duration', 'Duration']) || '00:00:00',
          isTimerPaused: this.readBoolean(item, ['isTimerPaused', 'IsTimerPaused'], false),
          isDone: this.readBoolean(item, ['isDone', 'IsDone'], false),
          status: this.readString(item, ['status', 'Status']) || 'consultation_not_started',
          motifs: this.readArray(item, 'motifs', 'Motifs').map((motif) => String(motif)),
        }));

        const totalCount = this.readNumber(source, ['totalCount', 'TotalCount', 'count', 'Count'], consultations.length);
        return {
          date: dateValue,
          consultations,
          totalCount,
        };
      }),
    );
  }

  getConsultationDates(year: number, month: number): Observable<ConsultationDatesResponse> {
    const params = new HttpParams()
      .set('year', String(year))
      .set('month', String(month));

    return this.http.get<unknown>(API.patients.getConsultationDates, { params }).pipe(
      map((response) => {
        const source = this.unwrapPayload(response);
        const dates = this.readArray(source, 'dates', 'Dates').map((date) => String(date));
        return {
          year: this.readNumber(source, ['year', 'Year'], year),
          month: this.readNumber(source, ['month', 'Month'], month),
          dates,
          totalCount: this.readNumber(source, ['totalCount', 'TotalCount', 'count', 'Count'], dates.length),
        };
      }),
    );
  }

  private mapPatient(payload: unknown): Patient {
    const source = this.unwrapPayload(payload);

    const city =
      this.readString(source, ['city', 'City']) ||
      this.readNestedString(source, ['adresse', 'adressePatient'], ['ville', 'city']);
    const address =
      this.readString(source, ['address', 'Address']) ||
      this.readNestedString(source, ['adresse', 'adressePatient'], ['adresse', 'address']);
    const postalCode =
      this.readString(source, ['postalCode', 'PostalCode']) ||
      this.readNestedString(source, ['adresse', 'adressePatient'], ['codePostal', 'postalCode']);
    const insuranceType =
      this.readString(source, ['insuranceType', 'InsuranceType']) ||
      this.readNestedString(source, ['orgSante'], ['typeOrg', 'insuranceType']);
    const insuranceEstablishment =
      this.readString(source, ['insuranceEstablishment', 'InsuranceEstablishment']) ||
      this.readNestedString(source, ['orgSante'], ['nomEtablissement', 'insuranceEstablishment']);

    return {
      id: this.readString(source, ['id', 'Id', '_id']),
      dossierNumber: this.readNumber(source, ['dossierNumber', 'DossierNumber', 'numFiche'], 0),
      consultationCount: this.readNumber(
        source,
        ['consultationCount', 'ConsultationCount', 'countExams', 'CountExams'],
        0,
      ),
      firstname: this.readString(source, ['firstname', 'Firstname', 'firstName', 'FirstName', 'prenom']),
      lastname: this.readString(source, ['lastname', 'Lastname', 'lastName', 'LastName', 'nom']),
      dateOfBirth: this.readString(source, ['dateOfBirth', 'DateOfBirth', 'dateAnniversaire']),
      phoneNumber: this.readString(source, ['phoneNumber', 'PhoneNumber', 'tel']),
      country: this.readString(source, ['country', 'Country']),
      profession: this.readString(source, ['profession', 'Profession']),
      workPlace: this.readString(source, ['workPlace', 'WorkPlace', 'lieuProfession']),
      sex: this.readString(source, ['sex', 'Sex', 'sexe']),
      familialStatus: this.readString(source, ['familialStatus', 'FamilialStatus', 'statusFamilial']),
      city,
      address,
      postalCode,
      email: this.readString(source, ['email', 'Email']),
      apci: this.readString(source, ['apci', 'APCI']),
      insuranceType,
      insuranceEstablishment,
    };
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

  private readBoolean(source: unknown, keys: string[], fallback: boolean): boolean {
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
    return fallback;
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

  private readNestedString(source: unknown, parentKeys: string[], childKeys: string[]): string {
    const record = (source as Record<string, unknown>) ?? {};
    for (const parentKey of parentKeys) {
      const parentValue = record[parentKey];
      if (!parentValue || typeof parentValue !== 'object') {
        continue;
      }

      const childRecord = parentValue as Record<string, unknown>;
      for (const childKey of childKeys) {
        const value = childRecord[childKey];
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'number') {
          return String(value);
        }
      }
    }
    return '';
  }
}
