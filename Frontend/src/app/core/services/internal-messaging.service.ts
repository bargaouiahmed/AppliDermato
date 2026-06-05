import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../config/api.config';
import {
  DeleteInternalMessageRequest,
  EditInternalMessageRequest,
  InternalMessage,
  InternalMessagingBootstrap,
  MarkInternalRoomSeenRequest,
  SendInternalMessageRequest,
} from '../models/internal-messaging.models';

@Injectable({ providedIn: 'root' })
export class InternalMessagingService {
  constructor(private readonly http: HttpClient) {}

  getBootstrap(): Observable<InternalMessagingBootstrap> {
    return this.http.get<InternalMessagingBootstrap>(API.messages.bootstrap);
  }

  getMessagesByRoom(roomId: string): Observable<InternalMessage[]> {
    return this.http.get<InternalMessage[]>(API.messages.byRoom(roomId));
  }

  sendMessage(payload: SendInternalMessageRequest): Observable<InternalMessage> {
    return this.http.post<InternalMessage>(API.messages.send, payload);
  }

  markRoomSeen(roomId: string, payload: MarkInternalRoomSeenRequest): Observable<InternalMessage[]> {
    return this.http.patch<InternalMessage[]>(API.messages.seen(roomId), payload);
  }

  editMessage(messageId: string, payload: EditInternalMessageRequest): Observable<InternalMessage> {
    return this.http.patch<InternalMessage>(API.messages.edit(messageId), payload);
  }

  deleteMessage(messageId: string, payload: DeleteInternalMessageRequest): Observable<InternalMessage> {
    return this.http.delete<InternalMessage>(API.messages.delete(messageId), { body: payload });
  }
}
