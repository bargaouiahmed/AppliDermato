import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  AiChatCompletionRequest,
  AiChatCompletionResponse,
  AiChatSession,
  CreateAiChatSessionRequest,
  SendAiChatMessageRequest,
} from '../models/ai-chat.models';

@Injectable({ providedIn: 'root' })
export class AiChatService {
  constructor(private readonly http: HttpClient) {}

  complete(payload: AiChatCompletionRequest): Observable<AiChatCompletionResponse> {
    return this.http.post<AiChatCompletionResponse>(API.aiChat.complete, payload);
  }

  getSessions(): Observable<AiChatSession[]> {
    return this.http.get<AiChatSession[]>(API.aiChat.sessions);
  }

  createSession(payload: CreateAiChatSessionRequest): Observable<AiChatSession> {
    return this.http.post<AiChatSession>(API.aiChat.sessions, payload);
  }

  getSession(sessionId: string): Observable<AiChatSession> {
    return this.http.get<AiChatSession>(API.aiChat.session(sessionId));
  }

  deleteSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(API.aiChat.session(sessionId));
  }

  sendMessage(sessionId: string, payload: SendAiChatMessageRequest): Observable<AiChatSession> {
    return this.http.post<AiChatSession>(API.aiChat.messages(sessionId), payload);
  }

  deleteMessage(sessionId: string, messageId: string): Observable<void> {
    return this.http.delete<void>(API.aiChat.message(sessionId, messageId));
  }
}
