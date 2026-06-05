import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  CreateSuggestionRequest,
  DoctorSuggestion,
  ReplyToSuggestionRequest,
  SuggestionUnreadCountResponse,
} from '../models/suggestion.models';

@Injectable({ providedIn: 'root' })
export class SuggestionService {
  constructor(private readonly http: HttpClient) {}

  getSuggestions(): Observable<DoctorSuggestion[]> {
    return this.http.get<DoctorSuggestion[]>(API.suggestions.all);
  }

  createSuggestion(payload: CreateSuggestionRequest): Observable<DoctorSuggestion> {
    return this.http.post<DoctorSuggestion>(API.suggestions.create, payload);
  }

  reply(suggestionId: string, payload: ReplyToSuggestionRequest): Observable<DoctorSuggestion> {
    return this.http.post<DoctorSuggestion>(API.suggestions.reply(suggestionId), payload);
  }

  getUnreadCount(): Observable<SuggestionUnreadCountResponse> {
    return this.http.get<SuggestionUnreadCountResponse>(API.suggestions.unreadCount);
  }
}
