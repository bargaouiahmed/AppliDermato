import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  ConsultationInterrogatoireResponse,
  InterrogatoireAnomalyCatalogItem,
  InitializeConsultationRequest,
  InterrogatoireOrdonnanceHistoryResponse,
  TreatmentCatalogRelation,
  TreatmentCatalogItem,
  UpsertTreatmentCatalogItemRequest,
  UpdateConsultationDataRequest,
  UpdateConsultationTimerRequest,
} from '../models/interrogatoire.models';

@Injectable({ providedIn: 'root' })
export class InterrogatoireService {
  constructor(private readonly http: HttpClient) {}

  initializeConsultation(
    request: InitializeConsultationRequest,
  ): Observable<ConsultationInterrogatoireResponse> {
    return this.http.post<ConsultationInterrogatoireResponse>(
      API.interrogatoire.initializeConsultation,
      request,
    );
  }

  getConsultationInterrogatoire(
    consultationId: string,
  ): Observable<ConsultationInterrogatoireResponse> {
    return this.http.get<ConsultationInterrogatoireResponse>(
      API.interrogatoire.getConsultationById(consultationId),
    );
  }

  getOrdonnanceHistory(
    consultationId: string,
  ): Observable<InterrogatoireOrdonnanceHistoryResponse[]> {
    return this.http.get<InterrogatoireOrdonnanceHistoryResponse[]>(
      API.interrogatoire.getOrdonnanceHistory(consultationId),
    );
  }

  getDiagnosticsCatalog(consultationId: string): Observable<string[]> {
    return this.http.get<string[]>(
      API.interrogatoire.getDiagnosticsCatalog(consultationId),
    );
  }

  getAnomalyCatalog(section?: 'medical' | 'family' | 'surgical'): Observable<InterrogatoireAnomalyCatalogItem[]> {
    return this.http.get<InterrogatoireAnomalyCatalogItem[]>(
      API.interrogatoire.getAnomalyCatalog(section),
    );
  }

  hideCustomAnomalyFromCatalog(
    section: 'medical' | 'family' | 'surgical',
    label: string,
  ): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      API.interrogatoire.hideCustomAnomalyFromCatalog(section, label),
    );
  }

  addCustomAnomalyToCatalog(
    section: 'medical' | 'family' | 'surgical',
    label: string,
    templateKey?: string | null,
  ): Observable<InterrogatoireAnomalyCatalogItem> {
    return this.http.post<InterrogatoireAnomalyCatalogItem>(
      API.interrogatoire.addCustomAnomalyToCatalog,
      {
        section,
        label,
        templateKey: templateKey ?? null,
      },
    );
  }

  getTreatmentMedicineCatalog(): Observable<TreatmentCatalogItem[]> {
    return this.http.get<TreatmentCatalogItem[]>(
      API.interrogatoire.getTreatmentMedicineCatalog,
    );
  }

  addTreatmentMedicineCatalogItem(
    request: UpsertTreatmentCatalogItemRequest,
  ): Observable<TreatmentCatalogItem> {
    return this.http.post<TreatmentCatalogItem>(
      API.interrogatoire.addTreatmentMedicineCatalogItem,
      request,
    );
  }

  getTherapeuticClassCatalog(): Observable<TreatmentCatalogItem[]> {
    return this.http.get<TreatmentCatalogItem[]>(
      API.interrogatoire.getTherapeuticClassCatalog,
    );
  }

  addTherapeuticClassCatalogItem(
    request: UpsertTreatmentCatalogItemRequest,
  ): Observable<TreatmentCatalogItem> {
    return this.http.post<TreatmentCatalogItem>(
      API.interrogatoire.addTherapeuticClassCatalogItem,
      request,
    );
  }

  getTreatmentCategoryCatalog(): Observable<TreatmentCatalogItem[]> {
    return this.http.get<TreatmentCatalogItem[]>(
      API.interrogatoire.getTreatmentCategoryCatalog,
    );
  }

  getTreatmentCatalogRelations(): Observable<TreatmentCatalogRelation[]> {
    return this.http.get<TreatmentCatalogRelation[]>(
      API.interrogatoire.getTreatmentCatalogRelations,
    );
  }

  addTreatmentCategoryCatalogItem(
    request: UpsertTreatmentCatalogItemRequest,
  ): Observable<TreatmentCatalogItem> {
    return this.http.post<TreatmentCatalogItem>(
      API.interrogatoire.addTreatmentCategoryCatalogItem,
      request,
    );
  }

  updateConsultationTimer(
    consultationId: string,
    request: UpdateConsultationTimerRequest,
  ): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      API.interrogatoire.updateConsultationTimer(consultationId),
      request,
    );
  }

  updateConsultationData(
    consultationId: string,
    request: UpdateConsultationDataRequest,
  ): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      API.interrogatoire.updateConsultationData(consultationId),
      request,
    );
  }

  deleteConsultation(consultationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      API.interrogatoire.deleteConsultation(consultationId),
    );
  }
}
