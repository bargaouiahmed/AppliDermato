import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { API } from '../config/api.config';
import { AuthService } from './auth.service';

export interface WaitingRoomRealtimeEvent {
  type: string;
  cabinetIdentityId: string;
  consultationId?: string | null;
  occurredAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class WaitingRoomRealtimeService {
  private readonly updatesSubject = new Subject<WaitingRoomRealtimeEvent>();
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly auth: AuthService) {}

  get updates$(): Observable<WaitingRoomRealtimeEvent> {
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
        .withUrl(API.realtime.waitingRoomHub, {
          accessTokenFactory: () => this.auth.getAccessToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('waitingRoomUpdated', (payload: WaitingRoomRealtimeEvent) => {
        this.updatesSubject.next(payload);
      });

      this.connection.onclose(() => {
        this.startPromise = null;
      });
    }

    this.startPromise = this.connection
      .start()
      .catch((error) => {
        console.error('Waiting room SignalR connection failed', error);
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
