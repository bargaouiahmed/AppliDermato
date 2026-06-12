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

  resolveAssetUrl(relativeOrAbsoluteUrl: string, cacheBuster?: string | number | null): string {
    if (!relativeOrAbsoluteUrl) {
      return '';
    }

    const assetUrl = /^https?:\/\//i.test(relativeOrAbsoluteUrl)
      ? relativeOrAbsoluteUrl
      : `${environment.apiUrl}${relativeOrAbsoluteUrl.startsWith('/') ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`}`;

    const normalizedCacheBuster = `${cacheBuster ?? ''}`.trim();
    if (!normalizedCacheBuster) {
      return assetUrl;
    }

    const separator = assetUrl.includes('?') ? '&' : '?';
    return `${assetUrl}${separator}v=${encodeURIComponent(normalizedCacheBuster)}`;
  }
}
