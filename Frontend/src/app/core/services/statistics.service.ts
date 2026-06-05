import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '../config/api.config';
import {
  StatisticsBucket,
  StatisticsCnamCoverage,
  StatisticsConsultationSection,
  StatisticsOverview,
  StatisticsOverviewQuery,
  StatisticsPagination,
  StatisticsPatientSection,
} from '../models/statistics.models';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  constructor(private readonly http: HttpClient) {}

  getOverview(query: StatisticsOverviewQuery = {}): Observable<StatisticsOverview> {
    let params = new HttpParams();

    if (query.period) params = params.set('period', query.period);
    if (query.startDate) params = params.set('startDate', query.startDate);
    if (query.endDate) params = params.set('endDate', query.endDate);
    for (const diagnostic of query.diagnostics ?? []) {
      const value = diagnostic.trim();
      if (value) params = params.append('diagnostics', value);
    }
    if (query.sex?.trim()) params = params.set('sex', query.sex.trim());
    if (query.cnamStatus?.trim()) params = params.set('cnamStatus', query.cnamStatus.trim());
    if (query.ageGroup?.trim()) params = params.set('ageGroup', query.ageGroup.trim());
    if (query.minAge !== null && query.minAge !== undefined) params = params.set('minAge', String(query.minAge));
    if (query.maxAge !== null && query.maxAge !== undefined) params = params.set('maxAge', String(query.maxAge));
    if (query.pageNumber !== null && query.pageNumber !== undefined) params = params.set('pageNumber', String(query.pageNumber));
    if (query.pageSize !== null && query.pageSize !== undefined) params = params.set('pageSize', String(query.pageSize));

    return this.http.get<unknown>(API.statistics.overview, { params }).pipe(
      map((response) => this.mapOverview(response)),
    );
  }

  getDiagnosticsCatalog(): Observable<string[]> {
    return this.http.get<unknown>(API.statistics.diagnostics).pipe(
      map((response) => {
        const rawItems = Array.isArray(response)
          ? response
          : this.readArray(this.unwrapPayload(response), 'diagnostics', 'Diagnostics');

        return rawItems
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
      }),
    );
  }

  private mapOverview(payload: unknown): StatisticsOverview {
    const source = this.unwrapPayload(payload);

    return {
      consultationStatistics: this.mapConsultationSection(
        source['consultationStatistics'] ?? source['ConsultationStatistics'] ?? source,
      ),
      patientStatistics: this.mapPatientSection(
        source['patientStatistics'] ?? source['PatientStatistics'] ?? source,
      ),
    };
  }

  private mapPatient(payload: unknown) {
    return {
      id: this.readString(payload, ['id', 'Id']),
      dossierNumber: this.readNumber(payload, ['dossierNumber', 'DossierNumber'], 0),
      firstname: this.readString(payload, ['firstname', 'Firstname']),
      lastname: this.readString(payload, ['lastname', 'Lastname']),
      sex: this.readString(payload, ['sex', 'Sex']),
      age: this.readNumber(payload, ['age', 'Age'], 0),
      insuranceType: this.readString(payload, ['insuranceType', 'InsuranceType']),
      insuranceEstablishment: this.readString(payload, ['insuranceEstablishment', 'InsuranceEstablishment']),
      hasCnam: this.readBoolean(payload, ['hasCnam', 'HasCnam'], false),
      matchingConsultationCount: this.readNumber(payload, ['matchingConsultationCount', 'MatchingConsultationCount'], 0),
      consultations: this.readArray(payload, 'consultations', 'Consultations').map((consultation) => ({
        id: this.readString(consultation, ['id', 'Id']),
        consultationDate: this.readString(consultation, ['consultationDate', 'ConsultationDate']),
        duration: this.readString(consultation, ['duration', 'Duration']) || '00:00:00',
        isTimerPaused: this.readBoolean(consultation, ['isTimerPaused', 'IsTimerPaused'], false),
        isDone: this.readBoolean(consultation, ['isDone', 'IsDone'], false),
        motifs: this.readArray(consultation, 'motifs', 'Motifs').map((item) => String(item)),
        diagnostics: this.readArray(consultation, 'diagnostics', 'Diagnostics').map((item) => String(item)),
        conduiteActions: this.readArray(consultation, 'conduiteActions', 'ConduiteActions').map((item) => String(item)),
      })),
    };
  }

  private mapConsultationSection(payload: unknown): StatisticsConsultationSection {
    return {
      period: this.readString(payload, ['period', 'Period']) || 'all_time',
      chartGranularity: this.readString(payload, ['chartGranularity', 'ChartGranularity']) || 'year',
      startDate: this.readString(payload, ['startDate', 'StartDate']) || undefined,
      endDate: this.readString(payload, ['endDate', 'EndDate']) || undefined,
      timeline: this.mapBuckets(payload, 'timeline', 'Timeline'),
      totalConsultations: this.readNumber(payload, ['totalConsultations', 'TotalConsultations'], 0),
      completedConsultations: this.readNumber(payload, ['completedConsultations', 'CompletedConsultations'], 0),
      notCompletedConsultations: this.readNumber(payload, ['notCompletedConsultations', 'NotCompletedConsultations', 'activeConsultations', 'ActiveConsultations'], 0),
      averageDurationSeconds: this.readNumber(payload, ['averageDurationSeconds', 'AverageDurationSeconds'], 0),
      averageDuration: this.readString(payload, ['averageDuration', 'AverageDuration']) || '00:00:00',
      diagnosticFrequency: this.mapBuckets(payload, 'diagnosticFrequency', 'DiagnosticFrequency', 'topDiagnostics', 'TopDiagnostics'),
      cnamForms: this.mapBuckets(payload, 'cnamForms', 'CnamForms'),
    };
  }

  private mapPatientSection(payload: unknown): StatisticsPatientSection {
    return {
      totalPatients: this.readNumber(payload, ['totalPatients', 'TotalPatients', 'matchingPatients', 'MatchingPatients'], 0),
      patientsWithDiagnostics: this.readNumber(payload, ['patientsWithDiagnostics', 'PatientsWithDiagnostics'], 0),
      cnamCoverage: this.mapCnamCoverage((payload as Record<string, unknown>)?.['cnamCoverage'] ?? (payload as Record<string, unknown>)?.['CnamCoverage']),
      sexDistribution: this.mapBuckets(payload, 'sexDistribution', 'SexDistribution'),
      ageGroupDistribution: this.mapBuckets(payload, 'ageGroupDistribution', 'AgeGroupDistribution'),
      pagination: this.mapPagination((payload as Record<string, unknown>)?.['pagination'] ?? (payload as Record<string, unknown>)?.['Pagination'], payload),
      patients: this.readArray(payload, 'patients', 'Patients').map((patient) => this.mapPatient(patient)),
    };
  }

  private mapCnamCoverage(payload: unknown): StatisticsCnamCoverage {
    return {
      withCnam: this.readNumber(payload, ['withCnam', 'WithCnam'], 0),
      withoutCnam: this.readNumber(payload, ['withoutCnam', 'WithoutCnam'], 0),
      withCnamPercentage: this.readNumber(payload, ['withCnamPercentage', 'WithCnamPercentage'], 0),
      withoutCnamPercentage: this.readNumber(payload, ['withoutCnamPercentage', 'WithoutCnamPercentage'], 0),
    };
  }

  private mapPagination(payload: unknown, fallbackSource: unknown): StatisticsPagination {
    const totalCount = this.readNumber(
      payload,
      ['totalCount', 'TotalCount'],
      this.readNumber(fallbackSource, ['totalPatients', 'TotalPatients', 'matchingPatients', 'MatchingPatients'], 0),
    );
    const pageSize = this.readNumber(payload, ['pageSize', 'PageSize'], 10);

    return {
      pageNumber: this.readNumber(payload, ['pageNumber', 'PageNumber'], 1),
      pageSize,
      totalCount,
      totalPages: this.readNumber(payload, ['totalPages', 'TotalPages'], Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)))),
    };
  }

  private mapBuckets(source: unknown, ...keys: string[]): StatisticsBucket[] {
    return this.readArray(source, ...keys).map((item) => ({
      label: this.readString(item, ['label', 'Label']),
      count: this.readNumber(item, ['count', 'Count'], 0),
      percentage: this.readNumber(item, ['percentage', 'Percentage'], 0),
    }));
  }

  private unwrapPayload(payload: unknown): Record<string, unknown> {
    const source = (payload as Record<string, unknown>) ?? {};
    return (
      (source['result'] as Record<string, unknown> | undefined) ??
      (source['data'] as Record<string, unknown> | undefined) ??
      (source['value'] as Record<string, unknown> | undefined) ??
      source
    );
  }

  private readArray(source: unknown, ...keys: string[]): unknown[] {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  private readString(source: unknown, keys: string[]): string {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
    }
    return '';
  }

  private readNumber(source: unknown, keys: string[], fallback: number): number {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return fallback;
  }

  private readBoolean(source: unknown, keys: string[], fallback: boolean): boolean {
    const record = (source as Record<string, unknown>) ?? {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true';
      if (typeof value === 'number') return value !== 0;
    }
    return fallback;
  }
}
