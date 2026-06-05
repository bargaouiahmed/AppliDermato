import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  ConsultationExamResponse,
  ExamFindingCatalogItem,
  SpecificExamSectionKey,
  UpdateConsultationExamRequest,
  UpsertExamFindingCatalogItemRequest,
} from '../models/exam.models';

@Injectable({ providedIn: 'root' })
export class ExamService {
  constructor(private readonly http: HttpClient) {}

  getConsultationExam(consultationId: string): Observable<ConsultationExamResponse> {
    return this.http.get<ConsultationExamResponse>(API.exam.getConsultationById(consultationId));
  }

  updateConsultationExam(
    consultationId: string,
    request: UpdateConsultationExamRequest,
  ): Observable<ConsultationExamResponse> {
    return this.http.patch<ConsultationExamResponse>(
      API.exam.updateConsultation(consultationId),
      request,
    );
  }

  getFindingCatalog(section?: SpecificExamSectionKey): Observable<ExamFindingCatalogItem[]> {
    return this.http.get<ExamFindingCatalogItem[]>(API.exam.getFindingCatalog(section));
  }

  addFindingCatalogItem(
    request: UpsertExamFindingCatalogItemRequest,
  ): Observable<ExamFindingCatalogItem> {
    return this.http.post<ExamFindingCatalogItem>(API.exam.addFindingCatalogItem, request);
  }
}
