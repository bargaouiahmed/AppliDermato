import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { API } from '../config/api.config';
import { AuthService } from './auth.service';

export interface ConsultationAiRealtimeEvent {
  type: string;
  cabinetIdentityId: string;
  consultationId: string;
  jobId: string;
  actionKey: string;
  operation: string;
  status: string;
  error?: string | null;
  occurredAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class ConsultationAiRealtimeService {
  private readonly updatesSubject = new Subject<ConsultationAiRealtimeEvent>();
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly auth: AuthService) {}

  get updates$(): Observable<ConsultationAiRealtimeEvent> {
    return this.updatesSubject.asObservable();
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
        .withUrl(API.realtime.consultationAiHub, {
          accessTokenFactory: () => this.auth.getAccessToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('consultationAiJobUpdated', (payload: ConsultationAiRealtimeEvent) => {
        this.updatesSubject.next(payload);
      });

      this.connection.onclose(() => {
        this.startPromise = null;
      });
    }

    this.startPromise = this.connection
      .start()
      .catch((error) => {
        console.error('Consultation AI SignalR connection failed', error);
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
