import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  CnamPrintDataResponse,
  CorrectLettreConfrereAiRequest,
  ConduiteCatalogItemResponse,
  ConduiteOrdonnanceTypeCatalogItemResponse,
  ConsultationConduiteActionResponse,
  ConsultationConduiteResponse,
  GenerateLettreConfrereAiRequest,
  LettreConfrereAiJobResponse,
  PrintableConduiteDocumentResponse,
  SaveOrdonnanceTypeCatalogItemRequest,
  UpsertConsultationConduiteRequest,
} from '../models/conduite.models';
import { Lang } from '../models/i18n.models';

type ParacliniquePdfRequest = {
  sections: string[];
};

@Injectable({ providedIn: 'root' })
export class ConduiteService {
  constructor(private readonly http: HttpClient) {}

  getConduiteCatalog(): Observable<ConduiteCatalogItemResponse[]> {
    return this.http.get<ConduiteCatalogItemResponse[]>(API.conduite.getActionCatalog);
  }

  getConsigneCatalog(): Observable<string[]> {
    return this.http.get<string[]>(API.conduite.getConsigneCatalog);
  }

  getOrdonnanceTypeCatalog(): Observable<ConduiteOrdonnanceTypeCatalogItemResponse[]> {
    return this.http.get<ConduiteOrdonnanceTypeCatalogItemResponse[]>(
      API.conduite.getOrdonnanceTypeCatalog,
    );
  }

  getConsultationConduite(consultationId: string): Observable<ConsultationConduiteResponse> {
    return this.http.get<ConsultationConduiteResponse>(
      API.conduite.getConsultationById(consultationId),
    );
  }

  getLatestPreviousOrdonnance(
    consultationId: string,
  ): Observable<ConsultationConduiteActionResponse | null> {
    return this.http.get<ConsultationConduiteActionResponse | null>(
      API.conduite.getLatestPreviousOrdonnance(consultationId),
    );
  }

  upsertConsultationConduite(
    consultationId: string,
    request: UpsertConsultationConduiteRequest,
  ): Observable<ConsultationConduiteResponse> {
    return this.http.patch<ConsultationConduiteResponse>(
      API.conduite.updateConsultation(consultationId),
      request,
    );
  }

  saveOrdonnanceTypeCatalogItem(
    request: SaveOrdonnanceTypeCatalogItemRequest,
  ): Observable<ConduiteOrdonnanceTypeCatalogItemResponse> {
    return this.http.post<ConduiteOrdonnanceTypeCatalogItemResponse>(
      API.conduite.saveOrdonnanceTypeCatalogItem,
      request,
    );
  }

  generateLettreConfrereAi(
    consultationId: string,
    request: GenerateLettreConfrereAiRequest,
  ): Observable<LettreConfrereAiJobResponse> {
    return this.http.post<LettreConfrereAiJobResponse>(
      API.conduite.generateLettreConfrereAi(consultationId),
      request,
    );
  }

  correctLettreConfrereAi(
    consultationId: string,
    request: CorrectLettreConfrereAiRequest,
  ): Observable<LettreConfrereAiJobResponse> {
    return this.http.post<LettreConfrereAiJobResponse>(
      API.conduite.correctLettreConfrereAi(consultationId),
      request,
    );
  }

  getLettreConfrereAiJob(
    consultationId: string,
    jobId: string,
  ): Observable<LettreConfrereAiJobResponse> {
    return this.http.get<LettreConfrereAiJobResponse>(
      API.conduite.lettreConfrereAiJob(consultationId, jobId),
    );
  }

  printDocument(
    consultationId: string,
    documentType: string,
    lang: Lang,
    sections?: string[],
  ): Observable<PrintableConduiteDocumentResponse> {
    return this.http.get<PrintableConduiteDocumentResponse>(
      API.conduite.printDocument(consultationId, documentType, lang, sections),
    );
  }

  printParacliniquePdf(
    consultationId: string,
    request: ParacliniquePdfRequest,
    lang: Lang,
  ): Observable<Blob> {
    return this.http.post(
      API.conduite.printParacliniquePdf(consultationId, lang),
      request,
      { responseType: 'blob' },
    );
  }

  getCnamPrintData(consultationId: string): Observable<CnamPrintDataResponse> {
    return this.http.get<CnamPrintDataResponse>(API.conduite.printCnamData(consultationId));
  }
}
