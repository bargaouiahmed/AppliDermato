import { Injectable, NgZone } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { ConsultationExamPayload } from '../models/exam.models';
import { API } from '../config/api.config';
import { AuthService } from './auth.service';

export interface ConsultationExamRealtimeEvent {
  cabinetIdentityId: string;
  consultationId: string;
  payload: ConsultationExamPayload;
  occurredAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class ExamRealtimeService {
  private readonly updatesSubject = new Subject<ConsultationExamRealtimeEvent>();
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly ngZone: NgZone,
  ) {}

  get updates$(): Observable<ConsultationExamRealtimeEvent> {
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
        .withUrl(API.realtime.examHub, {
          accessTokenFactory: () => this.auth.getAccessToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('examUpdated', (payload: ConsultationExamRealtimeEvent) => {
        this.ngZone.run(() => {
          this.updatesSubject.next(payload);
        });
      });

      this.connection.onclose(() => {
        this.startPromise = null;
      });
    }

    this.startPromise = this.connection
      .start()
      .catch((error) => {
        console.error('Exam SignalR connection failed', error);
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
