import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  SelfCheckinBootstrapResponse,
  SelfCheckinCreateConsultationRequest,
  SelfCheckinCreateConsultationResponse,
  SelfCheckinCreatePatientRequest,
  SelfCheckinFindPatientRequest,
  SelfCheckinPatchInterrogatoireRequest,
  SelfCheckinPatchMotifRequest,
  SelfCheckinPatientSummary,
} from '../models/self-checkin.models';
import { ConsultationInterrogatoireResponse } from '../models/interrogatoire.models';

@Injectable({ providedIn: 'root' })
export class SelfCheckinService {
  constructor(private readonly http: HttpClient) {}

  bootstrap(doctorId: string, kioskKey: string): Observable<SelfCheckinBootstrapResponse> {
    return this.http.get<SelfCheckinBootstrapResponse>(API.selfCheckin.bootstrap(doctorId, kioskKey));
  }

  getNextDossierNumber(doctorId: string, kioskKey: string): Observable<{ nextDossierNumber: number }> {
    return this.http.get<{ nextDossierNumber: number }>(
      API.selfCheckin.nextDossierNumber(doctorId, kioskKey),
    );
  }

  findPatient(
    doctorId: string,
    kioskKey: string,
    request: SelfCheckinFindPatientRequest,
  ): Observable<{ results: SelfCheckinPatientSummary[] }> {
    return this.http.post<{ results: SelfCheckinPatientSummary[] }>(
      API.selfCheckin.findPatient(doctorId, kioskKey),
      request,
    );
  }

  createPatient(
    doctorId: string,
    kioskKey: string,
    request: SelfCheckinCreatePatientRequest,
  ): Observable<{ patient: SelfCheckinPatientSummary }> {
    return this.http.post<{ patient: SelfCheckinPatientSummary }>(
      API.selfCheckin.createPatient(doctorId, kioskKey),
      request,
    );
  }

  createConsultation(
    doctorId: string,
    kioskKey: string,
    request: SelfCheckinCreateConsultationRequest,
  ): Observable<SelfCheckinCreateConsultationResponse> {
    return this.http.post<SelfCheckinCreateConsultationResponse>(
      API.selfCheckin.createConsultation(doctorId, kioskKey),
      request,
    );
  }

  patchMotif(
    doctorId: string,
    kioskKey: string,
    consultationId: string,
    request: SelfCheckinPatchMotifRequest,
  ): Observable<{ consultationId: string; motifs: string[] }> {
    return this.http.patch<{ consultationId: string; motifs: string[] }>(
      API.selfCheckin.patchMotif(doctorId, kioskKey, consultationId),
      request,
    );
  }

  patchInterrogatoire(
    doctorId: string,
    kioskKey: string,
    consultationId: string,
    request: SelfCheckinPatchInterrogatoireRequest,
  ): Observable<ConsultationInterrogatoireResponse> {
    return this.http.patch<ConsultationInterrogatoireResponse>(
      API.selfCheckin.patchInterrogatoire(doctorId, kioskKey, consultationId),
      request,
    );
  }
}
