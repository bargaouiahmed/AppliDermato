import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { API } from '../config/api.config';
import {
  InternalMessage,
  InternalMessagingMessageEvent,
  InternalMessagingSeenEvent,
  InternalMessagingTypingPayload,
} from '../models/internal-messaging.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class InternalMessagingRealtimeService {
  private readonly messageSubject = new Subject<InternalMessage>();
  private readonly typingSubject = new Subject<InternalMessagingTypingPayload>();
  private readonly stopTypingSubject = new Subject<InternalMessagingTypingPayload>();
  private readonly messagesSeenSubject = new Subject<InternalMessagingSeenEvent>();
  private readonly messageUpdatedSubject = new Subject<InternalMessagingMessageEvent>();
  private readonly messageDeletedSubject = new Subject<InternalMessagingMessageEvent>();
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly auth: AuthService) {}

  get message$(): Observable<InternalMessage> {
    return this.messageSubject.asObservable();
  }

  get typing$(): Observable<InternalMessagingTypingPayload> {
    return this.typingSubject.asObservable();
  }

  get stopTyping$(): Observable<InternalMessagingTypingPayload> {
    return this.stopTypingSubject.asObservable();
  }

  get messagesSeen$(): Observable<InternalMessagingSeenEvent> {
    return this.messagesSeenSubject.asObservable();
  }

  get messageUpdated$(): Observable<InternalMessagingMessageEvent> {
    return this.messageUpdatedSubject.asObservable();
  }

  get messageDeleted$(): Observable<InternalMessagingMessageEvent> {
    return this.messageDeletedSubject.asObservable();
  }

  async connect(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const token = this.auth.getAccessToken();
    if (!token) {
      return;
    }

    if (!this.connection) {
      this.connection = new HubConnectionBuilder()
        .withUrl(API.realtime.internalMessagingHub, {
          accessTokenFactory: () => this.auth.getAccessToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('messageReceived', (payload: InternalMessage) => {
        this.messageSubject.next(payload);
      });
      this.connection.on('typing', (payload: InternalMessagingTypingPayload) => {
        this.typingSubject.next(payload);
      });
      this.connection.on('stopTyping', (payload: InternalMessagingTypingPayload) => {
        this.stopTypingSubject.next(payload);
      });
      this.connection.on('messagesSeen', (payload: InternalMessagingSeenEvent) => {
        this.messagesSeenSubject.next(payload);
      });
      this.connection.on('messageUpdated', (payload: InternalMessagingMessageEvent) => {
        this.messageUpdatedSubject.next(payload);
      });
      this.connection.on('messageDeleted', (payload: InternalMessagingMessageEvent) => {
        this.messageDeletedSubject.next(payload);
      });
      this.connection.onclose(() => {
        this.startPromise = null;
      });
    }

    this.startPromise = this.connection
      .start()
      .catch((error) => {
        console.error('Internal messaging SignalR connection failed', error);
      })
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise;
  }

  async join(roomId: string): Promise<void> {
    await this.connect();
    if (!roomId || this.connection?.state !== HubConnectionState.Connected) {
      return;
    }

    await this.connection.invoke('Join', roomId);
  }

  emitTyping(payload: InternalMessagingTypingPayload): void {
    this.invokeFireAndForget('Typing', payload);
  }

  emitStopTyping(payload: InternalMessagingTypingPayload): void {
    this.invokeFireAndForget('StopTyping', payload);
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return;
    }

    if (this.connection.state !== HubConnectionState.Disconnected) {
      await this.connection.stop();
    }

    this.startPromise = null;
  }

  private invokeFireAndForget(methodName: string, payload: InternalMessagingTypingPayload): void {
    if (!payload.roomId || this.connection?.state !== HubConnectionState.Connected) {
      return;
    }

    void this.connection.invoke(methodName, payload).catch((error) => {
      console.error(`Internal messaging ${methodName} failed`, error);
    });
  }
}
