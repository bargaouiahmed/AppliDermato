import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { API } from '../config/api.config';
import { DoctorSuggestion, SuggestionUnreadCountEvent } from '../models/suggestion.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SuggestionRealtimeService {
  private readonly createdSubject = new Subject<DoctorSuggestion>();
  private readonly updatedSubject = new Subject<DoctorSuggestion>();
  private readonly repliedSubject = new Subject<DoctorSuggestion>();
  private readonly unreadCountSubject = new Subject<SuggestionUnreadCountEvent>();
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly auth: AuthService) {}

  get suggestionCreated$(): Observable<DoctorSuggestion> {
    return this.createdSubject.asObservable();
  }

  get suggestionUpdated$(): Observable<DoctorSuggestion> {
    return this.updatedSubject.asObservable();
  }

  get suggestionReplied$(): Observable<DoctorSuggestion> {
    return this.repliedSubject.asObservable();
  }

  get unreadCountChanged$(): Observable<SuggestionUnreadCountEvent> {
    return this.unreadCountSubject.asObservable();
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
        .withUrl(API.realtime.suggestionHub, {
          accessTokenFactory: () => this.auth.getAccessToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('suggestionCreated', (payload: DoctorSuggestion) => {
        this.createdSubject.next(payload);
      });
      this.connection.on('suggestionUpdated', (payload: DoctorSuggestion) => {
        this.updatedSubject.next(payload);
      });
      this.connection.on('suggestionReplied', (payload: DoctorSuggestion) => {
        this.repliedSubject.next(payload);
      });
      this.connection.on('suggestionUnreadCountChanged', (payload: SuggestionUnreadCountEvent) => {
        this.unreadCountSubject.next(payload);
      });
      this.connection.onclose(() => {
        this.startPromise = null;
      });
    }

    this.startPromise = this.connection
      .start()
      .catch((error) => {
        console.error('Suggestion SignalR connection failed', error);
      })
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise;
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
}
