import { Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { PatientService } from './patient.service';

@Injectable({ providedIn: 'root' })
export class ConsultationCreationGuardService {
  constructor(private readonly patientService: PatientService) {}

  hasSameDayConsultation(patientId: string, date: Date | string): Observable<boolean> {
    if (!patientId) {
      return of(false);
    }

    const isoDate = this.toIsoDate(date);
    return this.patientService.getDailyConsultations(isoDate).pipe(
      map((response) =>
        (response.consultations ?? []).some((consultation) => consultation.patientId === patientId),
      ),
    );
  }

  private toIsoDate(value: Date | string): string {
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      }
    }

    const date = value instanceof Date ? value : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
