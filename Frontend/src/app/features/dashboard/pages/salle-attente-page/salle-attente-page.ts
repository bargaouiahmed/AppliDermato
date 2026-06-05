import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { finalize, interval, Subscription } from 'rxjs';
import { DoctorProfile } from '../../../../core/models/doctor.models';
import { DailyConsultation } from '../../../../core/models/patient.models';
import { DoctorService } from '../../../../core/services/doctor.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { PatientService } from '../../../../core/services/patient.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { WaitingRoomRealtimeService } from '../../../../core/services/waiting-room-realtime.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-salle-attente-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './salle-attente-page.html',
  styleUrl: './salle-attente-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalleAttentePage implements OnInit, OnDestroy {
  private readonly patientService = inject(PatientService);
  private readonly doctorService = inject(DoctorService);
  private readonly userContext = inject(UserContextService);
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly waitingRoomRealtime = inject(WaitingRoomRealtimeService);

  protected consultations: WaitingRoomConsultation[] = [];
  protected doctor: DoctorProfile | null = null;
  protected currentDate = new Date();
  protected runningText = '';
  protected readonly welcomeTextFr = 'Bienvenue!';
  protected readonly welcomeTextEn = 'Welcome!';
  protected isFullscreen = false;
  protected isLoading = false;

  private clockSubscription?: Subscription;
  private refreshSubscription?: Subscription;
  private realtimeSubscription?: Subscription;

  ngOnInit(): void {
    this.currentDate = new Date();
    this.isFullscreen = Boolean(document.fullscreenElement);
    this.loadDoctor();
    this.loadConsultations();
    void this.waitingRoomRealtime.connect();

    this.realtimeSubscription = this.waitingRoomRealtime.updates$.subscribe(() => {
      this.loadConsultations(false);
    });

    this.clockSubscription = interval(1000).subscribe(() => {
      this.currentDate = new Date();
      this.updateRemainingTimes();
      this.sortConsultations();
      this.cdr.markForCheck();
    });

    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadConsultations(false);
    });
  }

  ngOnDestroy(): void {
    this.clockSubscription?.unsubscribe();
    this.refreshSubscription?.unsubscribe();
    this.realtimeSubscription?.unsubscribe();
    void this.waitingRoomRealtime.disconnect();
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void document.documentElement.requestFullscreen();
  }

  protected trackConsultation(index: number, consultation: WaitingRoomConsultation): string {
    return consultation.id || `${consultation.patientId}-${consultation.consultationDate}-${index}`;
  }

  protected statusLabel(status: string): string {
    if (status === 'consultation_completed') {
      return this.i18n.t('dashboard.daily.status.completed');
    }

    switch (status) {
      case 'consultation_paused':
        return this.i18n.t('dashboard.daily.status.paused');
      case 'consultation_en_cours':
        return this.i18n.t('dashboard.daily.status.inProgress');
      case 'consultation_completed':
        return this.i18n.t('dashboard.daily.status.completed');
      case 'consultation_not_started':
      case 'created':
      default:
        return this.i18n.t('dashboard.daily.status.pending');
    }
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'consultation_paused':
        return 'badge-paused';
      case 'consultation_en_cours':
        return 'badge-en-cours';
      case 'consultation_completed':
        return 'badge-completed';
      case 'consultation_not_started':
      case 'created':
      default:
        return 'badge-created';
    }
  }

  protected isCriticalTime(consultation: WaitingRoomConsultation): boolean {
    return consultation.remainingMinutes > 0 && consultation.remainingMinutes <= 5;
  }

  protected isDoneTime(consultation: WaitingRoomConsultation): boolean {
    return consultation.remainingMinutes === 0;
  }

  @HostListener('document:fullscreenchange')
  protected onFullscreenChange(): void {
    this.isFullscreen = Boolean(document.fullscreenElement);
    this.cdr.markForCheck();
  }

  private loadDoctor(): void {
    const context = this.userContext.get();
    if (!context?.doctorId) {
      this.runningText = this.i18n.t('waitingRoom.defaultBanner');
      this.cdr.markForCheck();
      return;
    }

    this.doctorService.getById(context.doctorId).subscribe({
      next: (doctor) => {
        this.doctor = doctor;
        this.runningText = this.buildRunningText(doctor);
        this.cdr.markForCheck();
      },
      error: () => {
        this.runningText = this.i18n.t('waitingRoom.defaultBanner');
        this.cdr.markForCheck();
      },
    });
  }

  private loadConsultations(markLoading = true): void {
    if (markLoading) {
      this.isLoading = true;
      this.cdr.markForCheck();
    }

    this.patientService
      .getDailyConsultations(this.toIsoDate(new Date()))
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.consultations = [...(response.consultations ?? [])]
            .sort((left, right) => left.consultationDate.localeCompare(right.consultationDate))
            .map((consultation) => this.mapWaitingRoomConsultation(consultation));
          this.updateRemainingTimes();
          this.sortConsultations();
          this.cdr.markForCheck();
        },
        error: () => {
          this.consultations = [];
          this.cdr.markForCheck();
        },
      });
  }

  private updateRemainingTimes(): void {
    this.consultations = this.consultations.map((consultation) =>
      this.computeRemainingTime(consultation),
    );
  }

  private sortConsultations(): void {
    this.consultations = [...this.consultations].sort((left, right) =>
      left.consultationDate.localeCompare(right.consultationDate),
    );
  }

  private mapWaitingRoomConsultation(consultation: DailyConsultation): WaitingRoomConsultation {
    return this.computeRemainingTime({
      ...consultation,
      remainingTime: '00:00',
      remainingMinutes: 0,
    });
  }

  private computeRemainingTime(
    consultation: WaitingRoomConsultation,
  ): WaitingRoomConsultation {
    const status = consultation.status;
    if (
      status === 'consultation_en_cours' ||
      status === 'consultation_paused' ||
      status === 'consultation_completed'
    ) {
      return {
        ...consultation,
        remainingTime: '00:00',
        remainingMinutes: 0,
      };
    }

    const consultationTime = new Date(consultation.consultationDate).getTime();
    if (!Number.isFinite(consultationTime)) {
      return {
        ...consultation,
        remainingTime: '00:00',
        remainingMinutes: 0,
      };
    }

    const now = Date.now();
    const timeDifference = consultationTime - now;

    if (timeDifference <= 0) {
      return {
        ...consultation,
        remainingTime: '00:00',
        remainingMinutes: 0,
      };
    }

    const totalMinutes = Math.floor(timeDifference / (1000 * 60));
    const adjustedMinutes = totalMinutes + 1;
    const hours = Math.floor(adjustedMinutes / 60);
    const minutes = adjustedMinutes % 60;

    return {
      ...consultation,
      remainingTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      remainingMinutes: adjustedMinutes,
    };
  }

  private buildRunningText(doctor: DoctorProfile): string {
    const doctorName = `Dr ${doctor.firstName} ${doctor.lastName}`.trim();
    const messageParts = [`Bienvenue au cabinet ${doctorName}`.trim()];

    if (doctor.cabinetAddress?.trim()) {
      messageParts.push(doctor.cabinetAddress.trim());
    }

    if (doctor.phoneNumber?.trim()) {
      messageParts.push(doctor.phoneNumber.trim());
    }

    if (doctor.email?.trim()) {
      messageParts.push(doctor.email.trim());
    }

    if (doctor.messageSalleAttente?.trim()) {
      messageParts.push(doctor.messageSalleAttente.trim());
    }

    return messageParts.join('   •   ');
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

interface WaitingRoomConsultation extends DailyConsultation {
  remainingTime: string;
  remainingMinutes: number;
}

