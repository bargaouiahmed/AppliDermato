import { Injectable, inject } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { API } from '../config/api.config';
import {
  TechAssistanceTicket,
  TechAssistanceUnreadCountEvent,
} from '../models/tech-assistance.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TechAssistanceRealtimeService {
  private readonly auth = inject(AuthService);
  private readonly createdSubject = new Subject<TechAssistanceTicket>();
  private readonly updatedSubject = new Subject<TechAssistanceTicket>();
  private readonly unreadCountSubject = new Subject<TechAssistanceUnreadCountEvent>();
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  get ticketCreated$(): Observable<TechAssistanceTicket> {
    return this.createdSubject.asObservable();
  }

  get ticketUpdated$(): Observable<TechAssistanceTicket> {
    return this.updatedSubject.asObservable();
  }

  get unreadCountChanged$(): Observable<TechAssistanceUnreadCountEvent> {
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
        .withUrl(API.realtime.techAssistanceHub, {
          accessTokenFactory: () => this.auth.getAccessToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('techTicketCreated', (payload: TechAssistanceTicket) => {
        this.createdSubject.next(payload);
      });
      this.connection.on('techTicketUpdated', (payload: TechAssistanceTicket) => {
        this.updatedSubject.next(payload);
      });
      this.connection.on(
        'techTicketUnreadCountChanged',
        (payload: TechAssistanceUnreadCountEvent) => {
          this.unreadCountSubject.next(payload);
        },
      );
      this.connection.onclose(() => {
        this.startPromise = null;
      });
    }

    this.startPromise = this.connection
      .start()
      .catch((error) => {
        console.error('Tech assistance SignalR connection failed', error);
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
