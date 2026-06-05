import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Rdv {
  id?: string;
  cabinetIdentityId?: string;
  patientId?: string | null;
  patient?: {
    id: string;
    firstname: string;
    lastname: string;
    dossierNumber: number;
  } | null;
  patientName?: string;
  patientDossierNumber?: string;
  status?: string;
  date: string;
  time: string;
  duration?: number;
  motifs?: string[];
  isPersonnel: boolean;
  personnelDescription?: string;
  personnelDuration?: number;
}

export interface CreateConsultationRdvRequest {
  date: string;
  time: string;
  duration?: number;
  motifs?: string[];
}

export interface Leave {
  id?: string;
  cabinetIdentityId?: string;
  date: string;
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  type: string;
  name: string;
  description?: string;
  isRecurring?: boolean;
}

export interface CalendarSettings {
  id?: string;
  cabinetIdentityId?: string;
  startHour: number;
  endHour: number;
  timeSlotInterval: number;
}

export interface FixedHoliday {
  date: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgendaService {
  private readonly apiUrl = `${environment.apiUrl}/api/v0/agenda`;

  constructor(private readonly http: HttpClient) {}

  getRdvsByMonth(monthPrefix: string): Observable<Rdv[]> {
    return this.http.get<Rdv[]>(`${this.apiUrl}/rdvs?monthPrefix=${monthPrefix}`);
  }

  createRdv(rdv: Rdv): Observable<Rdv> {
    return this.http.post<Rdv>(`${this.apiUrl}/rdvs`, rdv);
  }

  createConsultationRdv(
    consultationId: string,
    request: CreateConsultationRdvRequest,
  ): Observable<Rdv> {
    return this.http.post<Rdv>(
      `${this.apiUrl}/consultations/${encodeURIComponent(consultationId)}/next-rdv`,
      request,
    );
  }

  updateRdv(id: string, rdv: Rdv): Observable<Rdv> {
    return this.http.put<Rdv>(`${this.apiUrl}/rdvs/${id}`, rdv);
  }

  deleteRdv(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/rdvs/${id}`);
  }

  getLeavesByYear(yearPrefix: string): Observable<Leave[]> {
    return this.http.get<Leave[]>(`${this.apiUrl}/leaves?yearPrefix=${yearPrefix}`);
  }

  createLeave(leave: Leave): Observable<Leave> {
    return this.http.post<Leave>(`${this.apiUrl}/leaves`, leave);
  }

  updateLeave(id: string, leave: Leave): Observable<Leave> {
    return this.http.put<Leave>(`${this.apiUrl}/leaves/${id}`, leave);
  }

  deleteLeave(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/leaves/${id}`);
  }

  getSettings(): Observable<CalendarSettings> {
    return this.http.get<CalendarSettings>(`${this.apiUrl}/settings`);
  }

  updateSettings(settings: CalendarSettings): Observable<CalendarSettings> {
    return this.http.put<CalendarSettings>(`${this.apiUrl}/settings`, settings);
  }

  getHolidays(): Observable<FixedHoliday[]> {
    return this.http.get<FixedHoliday[]>(`${this.apiUrl}/holidays`);
  }
}
