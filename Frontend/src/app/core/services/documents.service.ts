import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API } from '../config/api.config';
import {
  ConsultationDocumentsResponse,
  ConsultationExplorationDocumentResponse,
  CreateExplorationDocumentRequest,
} from '../models/documents.models';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(private readonly http: HttpClient) {}

  getConsultationDocuments(consultationId: string): Observable<ConsultationDocumentsResponse> {
    return this.http.get<ConsultationDocumentsResponse>(API.documents.getConsultation(consultationId));
  }

  createExplorationDocument(
    consultationId: string,
    request: CreateExplorationDocumentRequest,
  ): Observable<ConsultationExplorationDocumentResponse> {
    const formData = new FormData();
    request.typeLabels.forEach((label) => formData.append('typeLabels', label));
    formData.append('clinic', request.clinic);
    formData.append('forfait', request.forfait);
    formData.append('operator', request.operator);
    formData.append('precaution', request.precaution);
    formData.append('additionalInformation', request.additionalInformation);
    formData.append('file', request.file);

    return this.http.post<ConsultationExplorationDocumentResponse>(
      API.documents.createExplorationDocument(consultationId),
      formData,
    );
  }

  deleteExplorationDocument(consultationId: string, documentId: string): Observable<void> {
    return this.http.delete<void>(API.documents.deleteExplorationDocument(consultationId, documentId));
  }

  resolveAssetUrl(relativeOrAbsoluteUrl: string): string {
    if (!relativeOrAbsoluteUrl) {
      return '';
    }

    if (/^https?:\/\//i.test(relativeOrAbsoluteUrl)) {
      return relativeOrAbsoluteUrl;
    }

    return `${environment.apiUrl}${relativeOrAbsoluteUrl.startsWith('/') ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`}`;
  }
}
