import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  CreateTechAssistanceMessagePayload,
  CreateTechAssistanceTicketPayload,
  TechAssistanceTicket,
  TechAssistanceUnreadCountResponse,
  TechLeadReviewRequest,
} from '../models/tech-assistance.models';

@Injectable({ providedIn: 'root' })
export class TechAssistanceService {
  private readonly http = inject(HttpClient);

  getTickets(): Observable<TechAssistanceTicket[]> {
    return this.http.get<TechAssistanceTicket[]>(API.techAssistance.all);
  }

  createTicket(payload: CreateTechAssistanceTicketPayload): Observable<TechAssistanceTicket> {
    return this.http.post<TechAssistanceTicket>(
      API.techAssistance.create,
      this.toFormData(payload.subject, payload.message, payload.attachments),
    );
  }

  addMessage(
    ticketId: string,
    payload: CreateTechAssistanceMessagePayload,
  ): Observable<TechAssistanceTicket> {
    return this.http.post<TechAssistanceTicket>(
      API.techAssistance.message(ticketId),
      this.toFormData('', payload.message, payload.attachments),
    );
  }

  notifyTechLead(ticketId: string): Observable<TechAssistanceTicket> {
    return this.http.post<TechAssistanceTicket>(API.techAssistance.notifyTechLead(ticketId), {});
  }

  closeTicket(ticketId: string): Observable<TechAssistanceTicket> {
    return this.http.patch<TechAssistanceTicket>(API.techAssistance.close(ticketId), {});
  }

  getUnreadCount(): Observable<TechAssistanceUnreadCountResponse> {
    return this.http.get<TechAssistanceUnreadCountResponse>(API.techAssistance.unreadCount);
  }

  getPublicReviewTicket(
    ticketId: string,
    payload: TechLeadReviewRequest,
  ): Observable<TechAssistanceTicket> {
    return this.http.post<TechAssistanceTicket>(API.techAssistance.publicReview(ticketId), payload);
  }

  private toFormData(subject: string, message: string, attachments: File[]): FormData {
    const formData = new FormData();

    if (subject.trim()) {
      formData.append('Subject', subject.trim());
    }

    formData.append('Message', message.trim());
    for (const file of attachments) {
      formData.append('Attachments', file);
    }

    return formData;
  }
}
