import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AddPatientRequest, Patient } from '../../../../core/models/patient.models';
import { AgendaService, CalendarSettings, FixedHoliday, Leave, Rdv } from '../../../../core/services/agenda.service';
import { DoctorMotifService } from '../../../../core/services/doctor-motif.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { Lang } from '../../../../core/models/i18n.models';
import { PatientService } from '../../../../core/services/patient.service';
import { ToastService } from '../../../../core/services/toast.service';
import { WaitingRoomRealtimeService } from '../../../../core/services/waiting-room-realtime.service';
import { ConsultationCreationGuardService } from '../../../../core/services/consultation-creation-guard.service';
import { ConsultationInitModal } from '../../../../shared/components/consultation-init-modal/consultation-init-modal';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

type CalendarViewMode = 'day' | 'week' | 'month';
type CalendarFilter = 'morning' | 'afternoon' | 'full';
type RdvModalMode = 'create' | 'edit';
type RdvType = 'normal' | 'personnel';
type RdvModalSubmitAction = 'save' | 'goToExam';

type PatientLabelSource = {
  id: string;
  firstname: string;
  lastname: string;
  dossierNumber: number;
};

type PatientOption = {
  id: string;
  displayName: string;
};

type RdvFormState = {
  date: string;
  time: string;
  type: RdvType;
  patientId: string | null;
  description: string;
  motifs: string[];
  duration: number;
};

type RdvNewPatientFormState = {
  sex: string;
  lastname: string;
  firstname: string;
  dateOfBirth: string;
  phoneNumber: string;
};

type LeaveFormState = {
  date: string;
  isFullDay: boolean;
  startTime: string;
  endTime: string;
  type: string;
  name: string;
  description: string;
  isRecurring: boolean;
};

type VariableHolidayFormState = {
  date: string;
  name: string;
  description: string;
  isRecurring: boolean;
};

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent, TranslatePipe, ConsultationInitModal],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.css',
})
export class CalendarPage implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly agendaService = inject(AgendaService);
  private readonly patientService = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly motifService = inject(DoctorMotifService);
  private readonly router = inject(Router);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly waitingRoomRealtime = inject(WaitingRoomRealtimeService);
  private readonly consultationCreationGuard = inject(ConsultationCreationGuardService);
  private readonly holidayFixedLeaveType = 'holiday-fixed';
  private readonly holidayVariableLeaveType = 'holiday-variable';
  private readonly slotPixelHeight = 60;
  private readonly dateLocaleByLang: Record<Lang, string> = {
    fr: 'fr',
    en: 'en-US',
    ar: 'ar-TN',
  };
  private clockIntervalId: ReturnType<typeof setInterval> | null = null;
  private patientSearchToken = 0;
  private resizeStartY = 0;
  private resizeInitialDuration = 0;
  private resizeChanged = false;
  private suppressMonthDayCellClick = false;

  public viewMode: CalendarViewMode = 'week';
  public filter: CalendarFilter = 'morning';
  public currentTime = new Date();

  public timeSlotInterval = 15;
  public isIntervalDropdownOpen = false;
  public readonly intervalOptions = [15, 30, 45, 60];
  public startHour = 8;
  public endHour = 17;

  public weekStart = this.stripTime(new Date());
  public weekEnd = this.stripTime(new Date());
  public weekDays: Date[] = [];
  public selectedDay = this.stripTime(new Date());
  public currentMonthDate = this.stripTime(new Date());
  public monthWeeks: { date: Date; isCurrentMonth: boolean }[][] = [];

  public readonly monthDayLabelKeys = [
    'agenda.weekday.monShort',
    'agenda.weekday.tueShort',
    'agenda.weekday.wedShort',
    'agenda.weekday.thuShort',
    'agenda.weekday.friShort',
    'agenda.weekday.satShort',
    'agenda.weekday.sunShort',
  ];

  private readonly weekDayLabelByIndex = [
    'agenda.weekday.sunShort',
    'agenda.weekday.monShort',
    'agenda.weekday.tueShort',
    'agenda.weekday.wedShort',
    'agenda.weekday.thuShort',
    'agenda.weekday.friShort',
    'agenda.weekday.satShort',
  ];

  public fullTimeSlots: string[] = [];
  public timeSlots: string[] = [];

  public rdvs: Rdv[] = [];
  public leaves: Leave[] = [];
  public regularLeaves: Leave[] = [];
  public holidayLeaves: Leave[] = [];
  public visibleLeaves: Leave[] = [];
  public holidayByDate: Record<string, string[]> = {};
  public holidays: Record<string, string> = {};
  public fixedHolidayCatalog: FixedHoliday[] = [];

  public isRdvModalOpen = false;
  public rdvModalMode: RdvModalMode = 'create';
  public activeRdvId: string | null = null;
  public rdvForm = this.createDefaultRdvForm();
  public isSavingRdv = false;
  public isRdvPatientLoading = false;
  public patientOptions: PatientOption[] = [];
  public isRdvNewPatientFormOpen = false;
  public isCreatingRdvPatient = false;
  public isRdvNewPatientValidationTouched = false;
  public rdvNewPatientForm = this.createDefaultRdvNewPatientForm();
  public readonly rdvNewPatientMaxBirthDate = this.toDateKey(new Date());
  public availableMotifs: string[] = [];
  public showTimeSlotPicker = false;
  public selectedDateForTimeSlot: Date | null = null;

  public isLeaveModalOpen = false;
  public leaveForm = this.createDefaultLeaveForm();
  public isSavingLeave = false;
  public deletingLeaveId: string | null = null;

  // Leave management modal (full Inaya Local clone)
  public isLeaveManageModalOpen = false;
  public leaveManageYear = new Date().getFullYear();
  public leaveManageYears: number[] = [];
  public leaveManageList: Leave[] = [];
  public isLeaveManageLoading = false;
  public isLeaveManageEditing = false;
  public editingLeaveId: string | null = null;

  // Holidays modal (fixed + variable holiday/day-off management)
  public isHolidayManageModalOpen = false;
  public holidayManageYear = new Date().getFullYear();
  public holidayFixedChoices: Array<{ date: string; name: string; checked: boolean; leaveId: string | null }> = [];
  public variableHolidayList: Leave[] = [];
  public variableHolidayForm = this.createDefaultVariableHolidayForm();
  public editingVariableHolidayId: string | null = null;
  public isHolidaySaving = false;

  // Drag & resize RDV interactions
  public draggingRdvId: string | null = null;
  public dragOverSlotKey: string | null = null;
  public dragOverMonthDayKey: string | null = null;
  public resizingRdvId: string | null = null;

  // Consultation init modal (go to examen)
  public isConsultationInitOpen = false;
  public consultationInitPatientId = '';
  public consultationInitMotifs: string[] = [];
  public consultationInitDate = '';
  public isRdvExamValidationModalOpen = false;
  public rdvExamMissingPatient = false;
  public rdvExamMissingMotifs = false;
  public isWorkingHoursModalOpen = false;
  public isSavingWorkingHours = false;
  public workingHoursForm = {
    startHour: '08:00',
    endHour: '17:00',
  };
  public readonly workingHourOptions = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, '0')}:00`);

  public openGoToExamen(rdv: Rdv): void {
    const patientId = rdv.patientId;
    if (!patientId) {
      this.toast.error(this.i18n.t('agenda.errors.patientRequired'));
      return;
    }

    const motifs = rdv.motifs ?? [];

    // If motifs already provided — create consultation directly, no modal
    if (motifs.length > 0) {
      const consultationDate = this.buildConsultationDateTime(rdv.date);
      this.consultationCreationGuard
        .hasSameDayConsultation(patientId, rdv.date)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (hasSameDayConsultation) => {
            if (hasSameDayConsultation) {
              window.alert(this.i18n.t('consultation.creation.sameDayExists'));
              return;
            }

            this.interrogatoireService
              .initializeConsultation({ patientId, consultationDate, motifs })
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (response) => {
                  this.toast.success(this.i18n.t('patients.consultationModal.createSuccess'));
                  const url = this.router.serializeUrl(this.router.createUrlTree(['/consultations', response.consultationId]));
                  window.open(url, '_blank', 'noopener,noreferrer');
                },
                error: (error) => {
                  this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
                },
              });
          },
          error: () => {
            this.toast.error(this.i18n.t('common.error'));
          },
        });
      return;
    }

    // No motifs — open motif picker modal
    this.consultationInitPatientId = patientId;
    this.consultationInitMotifs = [];
    this.consultationInitDate = rdv.date;
    this.isConsultationInitOpen = true;
  }

  private buildConsultationDateTime(dateIso: string): string {
    const now = new Date();
    const d = new Date(`${dateIso}T00:00:00`);
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    return d.toISOString();
  }

  public onConsultationCreated(consultationId: string): void {
    this.isConsultationInitOpen = false;
    if (consultationId) {
      const url = this.router.serializeUrl(this.router.createUrlTree(['/consultations', consultationId]));
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.clockIntervalId) {
        clearInterval(this.clockIntervalId);
      }
      void this.waitingRoomRealtime.disconnect();
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isIntervalDropdownOpen) {
      this.isIntervalDropdownOpen = false;
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    this.handleResizeMove(event);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.completeResize();
  }

  ngOnInit(): void {
    this.startClock();
    this.generateTimeSlots();
    this.applyFilter();
    this.availableMotifs = this.motifService.getAllMotifs();

    const today = this.stripTime(new Date());
    this.selectedDay = today;
    this.currentMonthDate = today;
    this.setCurrentWeek(today);
    this.setCurrentMonth(today);

    this.loadSettings();
    this.loadFixedHolidays();
    this.reloadCurrentView();
    void this.waitingRoomRealtime.connect();
    this.waitingRoomRealtime.updates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.reloadCurrentViewRdvs();
      });
  }

  public generateTimeSlots(): void {
    this.fullTimeSlots = [];
    for (let h = this.startHour; h < this.endHour; h++) {
      for (let m = 0; m < 60; m += this.timeSlotInterval) {
        this.fullTimeSlots.push(`${this.pad(h)}:${this.pad(m)}`);
      }
    }
    this.fullTimeSlots.push(`${this.pad(this.endHour)}:00`);
  }

  public applyFilter(): void {
    if (this.filter === 'morning') {
      this.timeSlots = this.fullTimeSlots.filter((time) => time < '12:30');
    } else if (this.filter === 'afternoon') {
      this.timeSlots = this.fullTimeSlots.filter((time) => time >= '12:30');
    } else {
      this.timeSlots = [...this.fullTimeSlots];
    }
  }

  public setFilter(filter: CalendarFilter): void {
    this.filter = filter;
    this.applyFilter();
  }

  public setCurrentWeek(date: Date): void {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const weekStart = this.stripTime(date);
    weekStart.setDate(weekStart.getDate() + diffToMonday);

    this.weekStart = weekStart;
    this.weekEnd = new Date(this.weekStart);
    this.weekEnd.setDate(this.weekStart.getDate() + 5); // Monday -> Saturday

    this.weekDays = [];
    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(this.weekStart);
      dayDate.setDate(this.weekStart.getDate() + i);
      this.weekDays.push(dayDate);
    }
  }

  public setCurrentMonth(date: Date): void {
    this.currentMonthDate = this.stripTime(date);

    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay() === 0 ? 7 : monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - (firstDayOfWeek - 1));

    this.monthWeeks = [];
    const cursor = new Date(gridStart);

    for (let week = 0; week < 6; week++) {
      const weekDays: { date: Date; isCurrentMonth: boolean }[] = [];
      for (let day = 0; day < 7; day++) {
        weekDays.push({
          date: new Date(cursor),
          isCurrentMonth: cursor.getMonth() === date.getMonth(),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      this.monthWeeks.push(weekDays);
    }
  }

  public isSameDateStr(date: Date, dateStr: string): boolean {
    return this.toDateKey(date) === dateStr;
  }

  public isHoliday(date: Date): boolean {
    const dateKey = this.toDateKey(date);
    return (this.holidayByDate[dateKey]?.length ?? 0) > 0;
  }

  public getHolidayName(date: Date): string {
    const dateKey = this.toDateKey(date);
    const labels = this.holidayByDate[dateKey] ?? [];
    return labels.join(', ');
  }

  public isLeave(date: Date): boolean {
    const dateKey = this.toDateKey(date);
    return this.regularLeaves.some((leave) => leave.date === dateKey);
  }

  public isLeaveTimeSlot(date: Date, time: string): boolean {
    const dateKey = this.toDateKey(date);
    return this.regularLeaves.some((leave) => {
      if (leave.date !== dateKey) {
        return false;
      }
      if (leave.isFullDay) {
        return true;
      }
      if (!leave.startTime || !leave.endTime) {
        return false;
      }
      return time >= leave.startTime && time < leave.endTime;
    });
  }

  public isToday(date: Date): boolean {
    return this.toDateKey(date) === this.toDateKey(new Date());
  }

  public isPast(date: Date, time = ''): boolean {
    const now = new Date();
    const target = new Date(date);

    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      target.setHours(hours, minutes, 0, 0);
    } else {
      target.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
    }

    return target < now;
  }

  public getRdv(date: Date, time: string): Rdv | undefined {
    const min = this.timeToMinutes(time);
    const max = min + this.timeSlotInterval;
    return this.rdvs.find(
      (rdv) =>
        this.isSameDateStr(date, rdv.date) &&
        this.timeToMinutes(rdv.time) >= min &&
        this.timeToMinutes(rdv.time) < max,
    );
  }

  public getRdvsForSlot(date: Date, time: string): Rdv[] {
    const min = this.timeToMinutes(time);
    const max = min + this.timeSlotInterval;
    return this.rdvs.filter(
      (rdv) =>
        this.isSameDateStr(date, rdv.date) &&
        this.timeToMinutes(rdv.time) >= min &&
        this.timeToMinutes(rdv.time) < max,
    );
  }

  public expandedSlots: Record<string, boolean> = {};

  public isSlotExpanded(date: Date, time: string): boolean {
    return !!this.expandedSlots[`${this.toDateKey(date)}-${time}`];
  }

  public toggleSlotExpanded(date: Date, time: string): void {
    const key = `${this.toDateKey(date)}-${time}`;
    this.expandedSlots[key] = !this.expandedSlots[key];
  }

  public getRdvsForDate(date: Date): Rdv[] {
    return this.rdvs.filter((rdv) => this.isSameDateStr(date, rdv.date));
  }

  public timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return 0;
    }
    return hours * 60 + minutes;
  }

  public setView(view: CalendarViewMode): void {
    this.viewMode = view;
    if (view === 'week') {
      this.setCurrentWeek(this.selectedDay);
    } else if (view === 'month') {
      this.setCurrentMonth(this.currentMonthDate);
    }
    this.reloadCurrentView();
  }

  public goToToday(): void {
    const today = this.stripTime(new Date());
    this.selectedDay = today;
    this.currentMonthDate = today;
    this.setCurrentWeek(today);
    this.setCurrentMonth(today);
    this.reloadCurrentView();
  }

  public setTimeSlotInterval(interval: number): void {
    this.timeSlotInterval = interval;
    this.isIntervalDropdownOpen = false;
    this.applyCalendarSettingsLocally();
    this.saveCalendarSettings({ showSuccessToast: false });
  }

  public toggleIntervalDropdown(): void {
    this.isIntervalDropdownOpen = !this.isIntervalDropdownOpen;
  }

  public previousWeek(): void {
    const previous = new Date(this.weekStart);
    previous.setDate(previous.getDate() - 7);
    this.setCurrentWeek(previous);
    this.selectedDay = new Date(this.weekStart);
    this.reloadCurrentView();
  }

  public nextWeek(): void {
    const next = new Date(this.weekStart);
    next.setDate(next.getDate() + 7);
    this.setCurrentWeek(next);
    this.selectedDay = new Date(this.weekStart);
    this.reloadCurrentView();
  }

  public previousDay(): void {
    const previous = new Date(this.selectedDay);
    previous.setDate(previous.getDate() - 1);
    this.selectedDay = this.stripTime(previous);
    this.setCurrentWeek(this.selectedDay);
    this.currentMonthDate = this.stripTime(this.selectedDay);
    this.reloadCurrentView();
  }

  public nextDay(): void {
    const next = new Date(this.selectedDay);
    next.setDate(next.getDate() + 1);
    this.selectedDay = this.stripTime(next);
    this.setCurrentWeek(this.selectedDay);
    this.currentMonthDate = this.stripTime(this.selectedDay);
    this.reloadCurrentView();
  }

  public previousMonth(): void {
    const previous = new Date(this.currentMonthDate);
    previous.setMonth(previous.getMonth() - 1);
    this.setCurrentMonth(previous);
    this.reloadCurrentView();
  }

  public nextMonth(): void {
    const next = new Date(this.currentMonthDate);
    next.setMonth(next.getMonth() + 1);
    this.setCurrentMonth(next);
    this.reloadCurrentView();
  }

  public openAddRdv(date: Date, time: string): void {
    const startMinutes = this.timeToMinutes(time);
    const duration = this.timeSlotInterval;
    if (!this.canPlaceRdv(this.toDateKey(date), startMinutes, duration)) {
      return;
    }
    this.rdvModalMode = 'create';
    this.activeRdvId = null;
    this.rdvForm = this.createDefaultRdvForm(this.toDateKey(date), time);
    this.openRdvModal();
  }

  public openAddRdvWithTimeSlotPicker(date: Date): void {
    if (!this.canPlaceRdv(this.toDateKey(date), this.timeToMinutes(this.getDefaultSlotTime()), this.timeSlotInterval)) {
      return;
    }
    // Open modal with empty time — time slot grid shows inside the modal
    this.rdvModalMode = 'create';
    this.activeRdvId = null;
    this.rdvForm = this.createDefaultRdvForm(this.toDateKey(date), '');
    this.openRdvModal();
  }

  public expandedDays: Record<string, boolean> = {};

  public get currentDateLocale(): string {
    return this.dateLocaleByLang[this.i18n.lang()] ?? 'fr';
  }

  public isExpanded(date: Date): boolean {
    return !!this.expandedDays[this.toDateKey(date)];
  }

  public toggleExpanded(date: Date): void {
    const key = this.toDateKey(date);
    this.expandedDays[key] = !this.expandedDays[key];
  }

  public selectTimeSlot(time: string): void {
    this.rdvForm.time = time;
  }

  public closeTimeSlotPicker(): void {
    this.showTimeSlotPicker = false;
    this.selectedDateForTimeSlot = null;
  }

  public openEditRdv(rdv: Rdv): void {
    if (!rdv.id) {
      return;
    }

    const type: RdvType = rdv.isPersonnel ? 'personnel' : 'normal';
    this.rdvModalMode = 'edit';
    this.activeRdvId = rdv.id;
    this.rdvForm = {
      date: rdv.date,
      time: rdv.time,
      type,
      patientId: type === 'normal' ? (rdv.patientId ?? null) : null,
      description: type === 'personnel' ? (rdv.personnelDescription ?? '') : (rdv.patientName ?? ''),
      motifs: rdv.motifs ?? [],
      duration: rdv.duration ?? this.timeSlotInterval,
    };

    const selectedPatient = rdv.patient
      ? this.mapPatientToOption(rdv.patient as PatientLabelSource)
      : null;

    this.openRdvModal(selectedPatient);
  }

  public deleteRdv(id?: string): void {
    if (!id) {
      return;
    }
    if (!window.confirm(this.i18n.t('agenda.confirm.deleteRdv'))) {
      return;
    }

    this.agendaService
      .deleteRdv(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('agenda.toast.rdvDeleted'));
          this.reloadCurrentViewRdvs();
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  public openAddLeaveModal(date?: Date): void {
    const dateKey = date ? this.toDateKey(date) : this.toDateKey(this.selectedDay);
    this.leaveForm = this.createDefaultLeaveForm(dateKey);
    // Build year list for the manage modal
    const currentYear = new Date().getFullYear();
    this.leaveManageYears = [currentYear - 1, currentYear, currentYear + 1];
    this.leaveManageYear = currentYear;
    this.isLeaveManageEditing = false;
    this.editingLeaveId = null;
    this.isLeaveManageModalOpen = true;
    this.loadLeaveManageList();
  }

  public closeLeaveManageModal(): void {
    this.isLeaveManageModalOpen = false;
    this.isLeaveManageEditing = false;
    this.editingLeaveId = null;
    this.leaveForm = this.createDefaultLeaveForm();
    this.reloadLeavesForCurrentRange();
  }

  public onLeaveManageYearChange(): void {
    this.loadLeaveManageList();
  }

  public loadLeaveManageList(): void {
    this.isLeaveManageLoading = true;
    this.agendaService.getLeavesByYear(String(this.leaveManageYear))
      .pipe(
        finalize(() => { this.isLeaveManageLoading = false; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (leaves) => {
          this.leaveManageList = leaves
            .filter((leave) => !this.isHolidayLeaveType(leave.type))
            .sort((left, right) => left.date.localeCompare(right.date));
        },
        error: () => { this.leaveManageList = []; },
      });
  }

  public startEditLeave(leave: Leave): void {
    this.isLeaveManageEditing = true;
    this.editingLeaveId = leave.id ?? null;
    this.leaveForm = {
      date: leave.date,
      isFullDay: leave.isFullDay,
      startTime: leave.startTime ?? '',
      endTime: leave.endTime ?? '',
      type: leave.type,
      name: leave.name,
      description: leave.description ?? '',
      isRecurring: leave.isRecurring ?? false,
    };
  }

  public cancelEditLeave(): void {
    this.isLeaveManageEditing = false;
    this.editingLeaveId = null;
    this.leaveForm = this.createDefaultLeaveForm();
  }

  public resetLeaveForm(): void {
    this.leaveForm = this.createDefaultLeaveForm();
  }

  public getLeaveTypeLabel(type: string): string {
    const map: Record<string, string> = {
      annual: this.i18n.t('agenda.leave.type.annual'),
      sick: this.i18n.t('agenda.leave.type.sick'),
      personal: this.i18n.t('agenda.leave.type.personal'),
      training: this.i18n.t('agenda.leave.type.training'),
      other: this.i18n.t('agenda.leave.type.other'),
    };
    return map[type] ?? type;
  }

  public getLeaveTypeBadgeClass(type: string): string {
    const map: Record<string, string> = {
      annual: 'badge bg-primary',
      sick: 'badge bg-danger',
      personal: 'badge bg-warning text-dark',
      training: 'badge bg-info',
      other: 'badge bg-secondary',
    };
    return map[type] ?? 'badge bg-secondary';
  }

  public getLeaveDurationDisplay(leave: Leave): string {
    if (leave.isFullDay) return this.i18n.t('agenda.leave.fullDay');
    if (leave.startTime && leave.endTime) return `${leave.startTime} - ${leave.endTime}`;
    return this.i18n.t('agenda.leave.fullDay');
  }

  public getLeaveStats(): { total: number; annual: number; sick: number; personal: number } {
    return {
      total: this.leaveManageList.length,
      annual: this.leaveManageList.filter(l => l.type === 'annual').length,
      sick: this.leaveManageList.filter(l => l.type === 'sick').length,
      personal: this.leaveManageList.filter(l => l.type === 'personal').length,
    };
  }

  public closeLeaveModal(): void {
    if (this.isSavingLeave) {
      return;
    }
    this.isLeaveModalOpen = false;
    this.leaveForm = this.createDefaultLeaveForm();
  }

  public onLeaveFullDayToggle(): void {
    if (this.leaveForm.isFullDay) {
      this.leaveForm.startTime = '';
      this.leaveForm.endTime = '';
    }
  }

  public saveLeaveFromModal(): void {
    if (this.isSavingLeave) return;

    if (!this.leaveForm.date) {
      this.toast.error(this.i18n.t('agenda.errors.dateRequired'));
      return;
    }
    if (!this.leaveForm.name?.trim()) {
      this.toast.error(this.i18n.t('agenda.errors.nameRequired'));
      return;
    }
    if (!this.leaveForm.isFullDay) {
      if (!this.leaveForm.startTime || !this.leaveForm.endTime) {
        this.toast.error(this.i18n.t('agenda.errors.timeRequired'));
        return;
      }
      if (this.leaveForm.startTime >= this.leaveForm.endTime) {
        this.toast.error(this.i18n.t('agenda.errors.invalidLeaveTime'));
        return;
      }
    }

    const leave: Leave = {
      date: this.leaveForm.date,
      isFullDay: this.leaveForm.isFullDay,
      startTime: this.leaveForm.isFullDay ? undefined : this.leaveForm.startTime,
      endTime: this.leaveForm.isFullDay ? undefined : this.leaveForm.endTime,
      type: this.leaveForm.type || 'annual',
      name: this.leaveForm.name.trim(),
      description: this.normalizeOptionalString(this.leaveForm.description),
      isRecurring: this.leaveForm.isRecurring || false,
    };

    const isEditing = this.isLeaveManageEditing && !!this.editingLeaveId;
    const request$ = isEditing
      ? this.agendaService.updateLeave(this.editingLeaveId as string, leave)
      : this.agendaService.createLeave(leave);

    this.isSavingLeave = true;
    request$
      .pipe(
        finalize(() => { this.isSavingLeave = false; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(
            this.i18n.t(isEditing ? 'agenda.toast.leaveUpdated' : 'agenda.toast.leaveCreated'),
          );
          this.cancelEditLeave();
          this.loadLeaveManageList();
          this.reloadLeavesForCurrentRange();
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  public deleteLeave(id?: string): void {
    if (!id || this.deletingLeaveId === id) return;
    if (!window.confirm(this.i18n.t('agenda.confirm.deleteLeave'))) return;

    this.deletingLeaveId = id;
    this.agendaService.deleteLeave(id)
      .pipe(
        finalize(() => { this.deletingLeaveId = null; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('agenda.toast.leaveDeleted'));
          if (this.isLeaveManageModalOpen) {
            this.loadLeaveManageList();
          } else {
            this.reloadLeavesForCurrentRange();
          }
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  public dateFromKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return new Date(dateKey);
    }
    return new Date(year, month - 1, day);
  }

  public formatLeaveSummary(leave: Leave): string {
    if (leave.isFullDay) {
      return this.i18n.t('agenda.leave.fullDay');
    }
    if (leave.startTime && leave.endTime) {
      return `${leave.startTime} - ${leave.endTime}`;
    }
    return this.i18n.t('agenda.leave.fullDay');
  }

  public getVisibleHolidayCount(): number {
    const range = this.getCurrentRange();
    const startKey = this.toDateKey(range.start);
    const endKey = this.toDateKey(range.end);
    return Object.keys(this.holidayByDate).filter((dateKey) => dateKey >= startKey && dateKey <= endKey).length;
  }

  public openHolidayManageModal(): void {
    this.holidayManageYear = this.currentMonthDate.getFullYear();
    this.leaveManageYears = [
      this.holidayManageYear - 1,
      this.holidayManageYear,
      this.holidayManageYear + 1,
    ];
    this.isHolidayManageModalOpen = true;
    this.loadHolidayManageState();
  }

  public closeHolidayManageModal(): void {
    this.isHolidayManageModalOpen = false;
    this.editingVariableHolidayId = null;
    this.variableHolidayForm = this.createDefaultVariableHolidayForm();
  }

  public openWorkingHoursModal(): void {
    this.workingHoursForm = {
      startHour: `${this.pad(this.startHour)}:00`,
      endHour: `${this.pad(this.endHour)}:00`,
    };
    this.isWorkingHoursModalOpen = true;
  }

  public closeWorkingHoursModal(): void {
    if (this.isSavingWorkingHours) {
      return;
    }

    this.isWorkingHoursModalOpen = false;
    this.workingHoursForm = {
      startHour: `${this.pad(this.startHour)}:00`,
      endHour: `${this.pad(this.endHour)}:00`,
    };
  }

  public saveWorkingHours(): void {
    if (this.isSavingWorkingHours) {
      return;
    }

    const startHour = this.parseHourValue(this.workingHoursForm.startHour);
    const endHour = this.parseHourValue(this.workingHoursForm.endHour);

    if (startHour === null || endHour === null || startHour >= endHour) {
      this.toast.error(this.i18n.t('agenda.errors.invalidWorkingHours'));
      return;
    }

    this.startHour = startHour;
    this.endHour = endHour;
    this.applyCalendarSettingsLocally();
    this.saveCalendarSettings({
      onSuccess: () => {
        this.isWorkingHoursModalOpen = false;
      },
    });
  }

  public onHolidayManageYearChange(): void {
    this.loadHolidayManageState();
  }

  public saveFixedHolidaySelection(): void {
    if (this.isHolidaySaving) {
      return;
    }

    const createRequests = this.holidayFixedChoices
      .filter((item) => item.checked && !item.leaveId)
      .map((item) => this.agendaService.createLeave({
        date: `${this.holidayManageYear}-${item.date}`,
        isFullDay: true,
        type: this.holidayFixedLeaveType,
        name: item.name,
        description: 'Fixed public holiday',
        isRecurring: true,
      }));

    const deleteRequests = this.holidayFixedChoices
      .filter((item) => !item.checked && item.leaveId)
      .map((item) => this.agendaService.deleteLeave(item.leaveId as string));

    const requests = [...createRequests, ...deleteRequests];
    if (requests.length === 0) {
      return;
    }

    this.isHolidaySaving = true;
    forkJoin(requests)
      .pipe(
        finalize(() => { this.isHolidaySaving = false; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('agenda.toast.holidaysUpdated'));
          this.loadHolidayManageState();
          this.reloadLeavesForCurrentRange();
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  public editVariableHoliday(leave: Leave): void {
    this.editingVariableHolidayId = leave.id ?? null;
    this.variableHolidayForm = {
      date: leave.date,
      name: leave.name,
      description: leave.description ?? '',
      isRecurring: leave.isRecurring ?? false,
    };
  }

  public resetVariableHolidayForm(): void {
    this.editingVariableHolidayId = null;
    this.variableHolidayForm = this.createDefaultVariableHolidayForm();
  }

  public saveVariableHoliday(): void {
    if (this.isHolidaySaving) {
      return;
    }

    if (!this.variableHolidayForm.date || !this.variableHolidayForm.name.trim()) {
      this.toast.error(this.i18n.t('agenda.errors.holidayDateAndNameRequired'));
      return;
    }

    const payload: Leave = {
      date: this.variableHolidayForm.date,
      isFullDay: true,
      type: this.holidayVariableLeaveType,
      name: this.variableHolidayForm.name.trim(),
      description: this.normalizeOptionalString(this.variableHolidayForm.description),
      isRecurring: this.variableHolidayForm.isRecurring,
    };

    const request$ = this.editingVariableHolidayId
      ? this.agendaService.updateLeave(this.editingVariableHolidayId, payload)
      : this.agendaService.createLeave(payload);

    this.isHolidaySaving = true;
    request$
      .pipe(
        finalize(() => { this.isHolidaySaving = false; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('agenda.toast.variableHolidaySaved'));
          this.resetVariableHolidayForm();
          this.loadHolidayManageState();
          this.reloadLeavesForCurrentRange();
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  public deleteVariableHoliday(id?: string): void {
    if (!id || this.isHolidaySaving) {
      return;
    }

    this.isHolidaySaving = true;
    this.agendaService.deleteLeave(id)
      .pipe(
        finalize(() => { this.isHolidaySaving = false; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('agenda.toast.variableHolidayDeleted'));
          this.loadHolidayManageState();
          this.reloadLeavesForCurrentRange();
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  public onRdvDragStart(event: DragEvent, rdv: Rdv): void {
    if (!rdv.id || this.resizingRdvId) {
      event.preventDefault();
      return;
    }

    this.draggingRdvId = rdv.id;
    this.dragOverSlotKey = null;
    this.dragOverMonthDayKey = null;
    event.dataTransfer?.setData('text/plain', rdv.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  public onRdvDragEnd(): void {
    this.draggingRdvId = null;
    this.dragOverSlotKey = null;
    this.dragOverMonthDayKey = null;
  }

  public onSlotDragOver(event: DragEvent, date: Date, time: string): void {
    if (!this.draggingRdvId) {
      return;
    }

    const rdv = this.rdvs.find((item) => item.id === this.draggingRdvId);
    if (!rdv) {
      return;
    }

    const dateKey = this.toDateKey(date);
    const startMinutes = this.timeToMinutes(time);
    const duration = this.getRdvDuration(rdv);

    if (!this.canPlaceRdv(dateKey, startMinutes, duration, rdv.id)) {
      return;
    }

    event.preventDefault();
    this.dragOverSlotKey = `${dateKey}-${time}`;
  }

  public onSlotDragLeave(date: Date, time: string): void {
    const key = `${this.toDateKey(date)}-${time}`;
    if (this.dragOverSlotKey === key) {
      this.dragOverSlotKey = null;
    }
  }

  public onSlotDrop(event: DragEvent, date: Date, time: string): void {
    event.preventDefault();

    const rdvId = this.draggingRdvId || event.dataTransfer?.getData('text/plain');
    this.draggingRdvId = null;
    this.dragOverSlotKey = null;
    this.dragOverMonthDayKey = null;

    if (!rdvId) {
      return;
    }

    const rdv = this.rdvs.find((item) => item.id === rdvId);
    if (!rdv || !rdv.id) {
      return;
    }

    const dateKey = this.toDateKey(date);
    const duration = this.getRdvDuration(rdv);
    const startMinutes = this.timeToMinutes(time);
    if (!this.canPlaceRdv(dateKey, startMinutes, duration, rdv.id)) {
      this.toast.error(this.i18n.t('agenda.errors.slotUnavailable'));
      return;
    }

    const previousDate = rdv.date;
    const previousTime = rdv.time;

    rdv.date = dateKey;
    rdv.time = time;
    this.cdr.detectChanges();

    this.persistRdvMoveOrResize(rdv, () => {
      rdv.date = previousDate;
      rdv.time = previousTime;
    });
  }

  public isDragOverSlot(date: Date, time: string): boolean {
    return this.dragOverSlotKey === `${this.toDateKey(date)}-${time}`;
  }

  public onMonthDayDragOver(event: DragEvent, date: Date): void {
    if (!this.draggingRdvId) {
      return;
    }

    const rdv = this.rdvs.find((item) => item.id === this.draggingRdvId);
    if (!rdv) {
      return;
    }

    const dateKey = this.toDateKey(date);
    const startMinutes = this.timeToMinutes(rdv.time);
    const duration = this.getRdvDuration(rdv);

    if (!this.canPlaceRdv(dateKey, startMinutes, duration, rdv.id)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverMonthDayKey = dateKey;
  }

  public onMonthDayDragLeave(date: Date): void {
    const dateKey = this.toDateKey(date);
    if (this.dragOverMonthDayKey === dateKey) {
      this.dragOverMonthDayKey = null;
    }
  }

  public onMonthDayDrop(event: DragEvent, date: Date): void {
    event.preventDefault();

    const rdvId = this.draggingRdvId || event.dataTransfer?.getData('text/plain');
    this.draggingRdvId = null;
    this.dragOverSlotKey = null;
    this.dragOverMonthDayKey = null;

    if (!rdvId) {
      return;
    }

    const rdv = this.rdvs.find((item) => item.id === rdvId);
    if (!rdv || !rdv.id) {
      return;
    }

    const dateKey = this.toDateKey(date);
    const startMinutes = this.timeToMinutes(rdv.time);
    const duration = this.getRdvDuration(rdv);
    if (!this.canPlaceRdv(dateKey, startMinutes, duration, rdv.id)) {
      this.toast.error(this.i18n.t('agenda.errors.slotUnavailable'));
      return;
    }

    this.suppressMonthDayCellClick = true;
    setTimeout(() => {
      this.suppressMonthDayCellClick = false;
    }, 0);

    const previousDate = rdv.date;
    rdv.date = dateKey;
    this.cdr.detectChanges();

    this.persistRdvMoveOrResize(rdv, () => {
      rdv.date = previousDate;
      this.cdr.detectChanges();
    });
  }

  public isDragOverMonthDay(date: Date): boolean {
    return this.dragOverMonthDayKey === this.toDateKey(date);
  }

  public onMonthDayCellClick(date: Date): void {
    if (this.suppressMonthDayCellClick) {
      this.suppressMonthDayCellClick = false;
      return;
    }

    if (this.isHoliday(date) || this.isLeave(date)) {
      return;
    }

    this.openAddRdvWithTimeSlotPicker(date);
  }

  public startResizeRdv(event: MouseEvent, rdv: Rdv): void {
    if (!rdv.id) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.resizingRdvId = rdv.id;
    this.resizeStartY = event.clientY;
    this.resizeInitialDuration = this.getRdvDuration(rdv);
    this.resizeChanged = false;
  }

  public getRdvBadgeHeight(rdv: Rdv): string {
    const span = Math.max(1, Math.ceil(this.getRdvDuration(rdv) / this.timeSlotInterval));
    const height = (span * this.slotPixelHeight) - 8;
    return `${Math.max(44, height)}px`;
  }

  public getRdvEndTime(rdv: Rdv): string {
    const start = this.timeToMinutes(rdv.time);
    const end = start + this.getRdvDuration(rdv);
    return this.minutesToTime(end);
  }

  public shouldOpenSlotPanelLeft(day: Date): boolean {
    if (this.viewMode !== 'week' || this.weekDays.length === 0) {
      return false;
    }

    const dayKey = this.toDateKey(day);
    const dayIndex = this.weekDays.findIndex((weekDay) => this.toDateKey(weekDay) === dayKey);
    if (dayIndex < 0) {
      return false;
    }

    return dayIndex >= this.weekDays.length - 2;
  }

  public getWeekdayLabelKey(date: Date): string {
    return this.weekDayLabelByIndex[date.getDay()] ?? 'agenda.weekday.monShort';
  }

  public getRdvLabel(rdv: Rdv): string {
    if (rdv.isPersonnel) {
      return rdv.personnelDescription?.trim() || this.i18n.t('agenda.rdv.personalDefaultLabel');
    }

    if (rdv.patient) {
      return this.formatPatientLabel(rdv.patient as PatientLabelSource);
    }

    if (rdv.patientName?.trim()) {
      return rdv.patientName.trim();
    }

    return this.i18n.t('agenda.rdv.normalDefaultLabel');
  }

  public onPatientSearch(event: { term: string }): void {
    this.loadPatientOptions(event.term ?? '', null);
  }

  public onPatientDropdownOpen(): void {
    if (this.patientOptions.length > 0 || this.isRdvPatientLoading) {
      return;
    }
    this.loadPatientOptions('', null);
  }

  public onRdvTypeChange(): void {
    this.closeRdvExamValidationModal();
    if (this.rdvForm.type === 'personnel') {
      this.rdvForm.patientId = null;
      this.resetRdvNewPatientFormState();
    }
  }

  public toggleRdvNewPatientForm(): void {
    if (this.isCreatingRdvPatient) {
      return;
    }

    this.isRdvNewPatientFormOpen = !this.isRdvNewPatientFormOpen;
    this.isRdvNewPatientValidationTouched = false;

    if (!this.isRdvNewPatientFormOpen) {
      this.rdvNewPatientForm = this.createDefaultRdvNewPatientForm();
    }
  }

  public cancelRdvNewPatientForm(): void {
    if (this.isCreatingRdvPatient) {
      return;
    }

    this.resetRdvNewPatientFormState();
  }

  public saveRdvNewPatientFromModal(): void {
    if (this.isCreatingRdvPatient) {
      return;
    }

    this.isRdvNewPatientValidationTouched = true;
    const form = this.getNormalizedRdvNewPatientForm();
    const validationErrorKey = this.validateRdvNewPatientForm(form);

    if (validationErrorKey) {
      this.toast.error(this.i18n.t(validationErrorKey));
      return;
    }

    const payload: AddPatientRequest = {
      firstname: form.firstname,
      lastname: form.lastname,
      dateOfBirth: form.dateOfBirth,
      phoneNumber: form.phoneNumber,
      country: 'Tunisie',
      profession: '',
      workPlace: '',
      sex: form.sex,
      familialStatus: '',
      city: '',
      address: '',
      postalCode: '',
      email: '',
      apci: '',
      insuranceType: '',
      insuranceEstablishment: '',
    };

    this.isCreatingRdvPatient = true;
    this.patientService
      .addPatient(payload)
      .pipe(
        switchMap(() => this.resolveCreatedPatientOption(form)),
        finalize(() => {
          this.isCreatingRdvPatient = false;
          this.cdr.detectChanges();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (createdOption) => {
          if (!createdOption) {
            this.toast.error(this.i18n.t('agenda.errors.patientAutoAssign'));
            this.loadPatientOptions(`${form.lastname} ${form.firstname}`.trim(), null);
            return;
          }

          this.patientOptions = this.mergePinnedPatient(this.patientOptions, createdOption);
          this.rdvForm.patientId = createdOption.id;
          this.resetRdvNewPatientFormState();
          this.toast.success(this.i18n.t('agenda.toast.patientCreated'));
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('agenda.errors.patientCreate'));
        },
      });
  }

  public closeRdvModal(): void {
    if (this.isSavingRdv || this.isCreatingRdvPatient) {
      return;
    }
    this.isRdvModalOpen = false;
    this.closeRdvExamValidationModal();
    this.activeRdvId = null;
    this.rdvModalMode = 'create';
    this.rdvForm = this.createDefaultRdvForm();
    this.resetRdvNewPatientFormState();
  }

  public closeRdvExamValidationModal(): void {
    this.isRdvExamValidationModalOpen = false;
    this.rdvExamMissingPatient = false;
    this.rdvExamMissingMotifs = false;
  }

  public openGoToExamFromModal(): void {
    if (this.rdvForm.type !== 'normal') {
      return;
    }

    this.closeRdvExamValidationModal();

    this.rdvExamMissingPatient = !this.rdvForm.patientId;
    this.rdvExamMissingMotifs = this.rdvForm.motifs.length < 1;

    if (this.rdvExamMissingPatient || this.rdvExamMissingMotifs) {
      this.isRdvExamValidationModalOpen = true;
      return;
    }

    if (this.rdvModalMode === 'edit') {
      this.openGoToExamen({
        patientId: this.rdvForm.patientId,
        motifs: this.rdvForm.motifs,
        date: this.rdvForm.date,
        time: this.rdvForm.time,
        isPersonnel: false,
      });
      return;
    }

    this.saveRdvFromModal('goToExam');
  }

  public saveRdvFromModal(action: RdvModalSubmitAction = 'save'): void {
    if (this.isSavingRdv) {
      return;
    }

    if (!this.rdvForm.date) {
      this.toast.error(this.i18n.t('agenda.errors.dateRequired'));
      return;
    }
    if (!this.rdvForm.time) {
      this.toast.error(this.i18n.t('agenda.errors.timeRequired'));
      return;
    }

    const computedDuration = this.rdvModalMode === 'create'
      ? this.normalizeDuration(this.timeSlotInterval)
      : this.normalizeDuration(this.rdvForm.duration || this.timeSlotInterval);
    const startMinutes = this.timeToMinutes(this.rdvForm.time);
    const blocked = !this.canPlaceRdv(
      this.rdvForm.date,
      startMinutes,
      computedDuration,
      this.rdvModalMode === 'edit' ? this.activeRdvId ?? undefined : undefined,
    );

    if (blocked) {
      this.toast.error(this.i18n.t('agenda.errors.slotUnavailable'));
      return;
    }

    const payload: Rdv = {
      date: this.rdvForm.date,
      time: this.rdvForm.time,
      duration: computedDuration,
      motifs: this.rdvForm.type === 'normal' && this.rdvForm.motifs.length > 0 ? this.rdvForm.motifs : undefined,
      isPersonnel: this.rdvForm.type === 'personnel',
      patientId: this.rdvForm.type === 'normal' ? (this.rdvForm.patientId ?? null) : null,
      patientName:
        this.rdvForm.type === 'normal'
          ? this.normalizeOptionalString(this.rdvForm.description)
          : undefined,
      personnelDescription:
        this.rdvForm.type === 'personnel'
          ? this.normalizeOptionalString(this.rdvForm.description)
          : undefined,
      personnelDuration:
        this.rdvForm.type === 'personnel' ? computedDuration : undefined,
    };

    const isEditMode = this.rdvModalMode === 'edit' && !!this.activeRdvId;
    const request$ = isEditMode
      ? this.agendaService.updateRdv(this.activeRdvId as string, payload)
      : this.agendaService.createRdv(payload);

    this.isSavingRdv = true;
    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.isSavingRdv = false;
          const rdvForExam = action === 'goToExam' && this.rdvForm.type === 'normal'
            ? {
                patientId: this.rdvForm.patientId,
                motifs: [...this.rdvForm.motifs],
                date: this.rdvForm.date,
                time: this.rdvForm.time,
                isPersonnel: false,
              }
            : null;
          this.toast.success(
            this.i18n.t(isEditMode ? 'agenda.toast.rdvUpdated' : 'agenda.toast.rdvCreated'),
          );
          this.closeRdvModal();
          this.reloadCurrentViewRdvs();
          if (rdvForExam) {
            this.openGoToExamen(rdvForExam);
          }
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.isSavingRdv = false;
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
          this.cdr.detectChanges();
        },
      });
  }

  private openRdvModal(pinnedOption?: PatientOption | null): void {
    this.isRdvModalOpen = true;
    this.resetRdvNewPatientFormState();
    this.loadPatientOptions('', pinnedOption ?? null);
  }

  private loadPatientOptions(searchTerm = '', pinnedOption: PatientOption | null): void {
    const token = ++this.patientSearchToken;
    this.isRdvPatientLoading = true;

    this.patientService
      .getAllPatients({
        pageNumber: 1,
        pageSize: 50,
        name: searchTerm.trim() || undefined,
      })
      .pipe(
        finalize(() => {
          if (token === this.patientSearchToken) {
            this.isRdvPatientLoading = false;
            this.cdr.detectChanges();
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (token !== this.patientSearchToken) {
            return;
          }

          const mapped = response.patients.map((patient) => this.mapPatientToOption(patient));
          this.patientOptions = this.mergePinnedPatient(mapped, pinnedOption);
        },
        error: () => {
          if (token !== this.patientSearchToken) {
            return;
          }

          this.patientOptions = pinnedOption ? [pinnedOption] : [];
          this.toast.error(this.i18n.t('agenda.errors.patientLoad'));
        },
      });
  }

  private loadSettings(): void {
    this.agendaService
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings: CalendarSettings) => {
          if (settings) {
            this.timeSlotInterval = settings.timeSlotInterval;
            this.startHour = settings.startHour;
            this.endHour = settings.endHour;
          }
          this.applyCalendarSettingsLocally();
          this.cdr.detectChanges();
        },
        error: () => {
          this.applyCalendarSettingsLocally();
          this.toast.error(this.i18n.t('agenda.errors.settingsLoad'));
        },
      });
  }

  private saveCalendarSettings(options?: { onSuccess?: () => void; showSuccessToast?: boolean }): void {
    const request: CalendarSettings = {
      startHour: this.startHour,
      endHour: this.endHour,
      timeSlotInterval: this.timeSlotInterval,
    };

    this.isSavingWorkingHours = true;
    this.agendaService
      .updateSettings(request)
      .pipe(
        finalize(() => {
          this.isSavingWorkingHours = false;
          this.cdr.detectChanges();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (settings) => {
          if (settings) {
            this.startHour = settings.startHour;
            this.endHour = settings.endHour;
            this.timeSlotInterval = settings.timeSlotInterval;
          }
          this.applyCalendarSettingsLocally();
          this.reloadCurrentView();
          if (options?.showSuccessToast !== false) {
            this.toast.success(this.i18n.t('agenda.toast.settingsUpdated'));
          }
          options?.onSuccess?.();
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  private applyCalendarSettingsLocally(): void {
    this.generateTimeSlots();
    this.applyFilter();
  }

  private loadFixedHolidays(): void {
    this.agendaService
      .getHolidays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (holidays: FixedHoliday[]) => {
          const mapped: Record<string, string> = {};
          holidays.forEach((holiday) => {
            if (holiday.date) {
              mapped[holiday.date] = holiday.name ?? '';
            }
          });
          this.fixedHolidayCatalog = holidays ?? [];
          this.holidays = mapped;
          this.cdr.detectChanges();
        },
        error: () => {
          this.holidays = {};
          this.toast.error(this.i18n.t('agenda.errors.holidaysLoad'));
        },
      });
  }

  private startClock(): void {
    this.clockIntervalId = setInterval(() => {
      this.currentTime = new Date();
      this.cdr.detectChanges();
    }, 60000);
  }

  private reloadCurrentView(): void {
    this.reloadCurrentViewRdvs();
    this.reloadLeavesForCurrentRange();
  }

  private reloadCurrentViewRdvs(): void {
    const range = this.getCurrentRange();
    this.loadRdvsForRange(range.start, range.end);
  }

  private reloadLeavesForCurrentRange(): void {
    const range = this.getCurrentRange();
    this.loadLeavesForRange(range.start, range.end);
  }

  private getCurrentRange(): { start: Date; end: Date } {
    if (this.viewMode === 'day') {
      return { start: this.stripTime(this.selectedDay), end: this.stripTime(this.selectedDay) };
    }

    if (this.viewMode === 'week') {
      return { start: this.stripTime(this.weekStart), end: this.stripTime(this.weekEnd) };
    }

    const monthStart = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth(),
      1,
    );
    const monthEnd = new Date(
      this.currentMonthDate.getFullYear(),
      this.currentMonthDate.getMonth() + 1,
      0,
    );
    return { start: monthStart, end: monthEnd };
  }

  private loadRdvsForRange(start: Date, end: Date): void {
    const monthPrefixes = this.getMonthPrefixes(start, end);
    const requests = monthPrefixes.map((prefix) => this.agendaService.getRdvsByMonth(prefix));
    const request$ = requests.length > 0 ? forkJoin(requests) : of([[] as Rdv[]]);
    const startKey = this.toDateKey(start);
    const endKey = this.toDateKey(end);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (responses) => {
          const merged = responses
            .flat()
            .filter((rdv) => rdv.date >= startKey && rdv.date <= endKey);

          this.rdvs = this.uniqueRdvsById(merged).sort((left, right) => {
            if (left.date === right.date) {
              return left.time.localeCompare(right.time);
            }
            return left.date.localeCompare(right.date);
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.rdvs = [];
          this.toast.error(this.i18n.t('agenda.errors.rdvsLoad'));
          this.cdr.detectChanges();
        },
      });
  }

  private loadLeavesForRange(start: Date, end: Date): void {
    const yearPrefixes = this.getYearPrefixes(start, end);
    const requests = yearPrefixes.map((yearPrefix) =>
      this.agendaService.getLeavesByYear(yearPrefix),
    );
    const request$ = requests.length > 0 ? forkJoin(requests) : of([[] as Leave[]]);
    const startKey = this.toDateKey(start);
    const endKey = this.toDateKey(end);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (responses) => {
          const mergedByRange = responses
            .flat()
            .filter((leave) => leave.date >= startKey && leave.date <= endKey);
          this.leaves = this.uniqueLeavesById(mergedByRange).sort((left, right) =>
            left.date.localeCompare(right.date),
          );
          this.holidayLeaves = this.leaves.filter((leave) => this.isHolidayLeaveType(leave.type));
          this.regularLeaves = this.leaves.filter((leave) => !this.isHolidayLeaveType(leave.type));
          this.rebuildHolidayByDate();
          this.updateVisibleLeaves();
          this.cdr.detectChanges();
        },
        error: () => {
          this.leaves = [];
          this.regularLeaves = [];
          this.holidayLeaves = [];
          this.visibleLeaves = [];
          this.holidayByDate = {};
          this.toast.error(this.i18n.t('agenda.errors.leavesLoad'));
          this.cdr.detectChanges();
        },
      });
  }

  private updateVisibleLeaves(): void {
    const { start, end } = this.getCurrentRange();
    const startKey = this.toDateKey(start);
    const endKey = this.toDateKey(end);

    this.visibleLeaves = this.regularLeaves
      .filter((leave) => leave.date >= startKey && leave.date <= endKey)
      .sort((left, right) => {
        if (left.date === right.date) {
          const leftTime = left.startTime ?? '00:00';
          const rightTime = right.startTime ?? '00:00';
          return leftTime.localeCompare(rightTime);
        }
        return left.date.localeCompare(right.date);
      });
  }

  private uniqueRdvsById(rdvs: Rdv[]): Rdv[] {
    const map = new Map<string, Rdv>();
    rdvs.forEach((rdv) => {
      const key =
        rdv.id ??
        `${rdv.date}-${rdv.time}-${rdv.patientId ?? 'no-patient'}-${rdv.isPersonnel ? '1' : '0'}`;
      map.set(key, rdv);
    });
    return Array.from(map.values());
  }

  private uniqueLeavesById(leaves: Leave[]): Leave[] {
    const map = new Map<string, Leave>();
    leaves.forEach((leave) => {
      const key = leave.id ?? `${leave.date}-${leave.startTime ?? 'full'}-${leave.endTime ?? ''}`;
      map.set(key, leave);
    });
    return Array.from(map.values());
  }

  private getMonthPrefixes(start: Date, end: Date): string[] {
    const prefixes: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endCursor) {
      prefixes.push(`${cursor.getFullYear()}-${this.pad(cursor.getMonth() + 1)}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return prefixes;
  }

  private getYearPrefixes(start: Date, end: Date): string[] {
    const years: string[] = [];
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      years.push(String(year));
    }
    return years;
  }

  private mapPatientToOption(patient: PatientLabelSource): PatientOption {
    return {
      id: patient.id,
      displayName: this.formatPatientLabel(patient),
    };
  }

  private mergePinnedPatient(
    patientOptions: PatientOption[],
    pinnedOption: PatientOption | null,
  ): PatientOption[] {
    if (!pinnedOption) {
      return patientOptions;
    }

    const exists = patientOptions.some((patient) => patient.id === pinnedOption.id);
    if (exists) {
      return patientOptions;
    }

    return [pinnedOption, ...patientOptions];
  }

  private formatPatientLabel(patient: PatientLabelSource): string {
    const fullName = `${patient.firstname ?? ''} ${patient.lastname ?? ''}`.trim();
    if (patient.dossierNumber && fullName) {
      return `#${patient.dossierNumber} - ${fullName}`;
    }
    if (fullName) {
      return fullName;
    }
    if (patient.dossierNumber) {
      return `#${patient.dossierNumber}`;
    }
    return this.i18n.t('agenda.rdv.normalDefaultLabel');
  }

  private createDefaultRdvForm(date?: string, time?: string): RdvFormState {
    return {
      date: date ?? this.toDateKey(this.selectedDay),
      time: time ?? this.getDefaultSlotTime(),
      type: 'normal',
      patientId: null,
      description: '',
      motifs: [],
      duration: this.timeSlotInterval,
    };
  }

  private createDefaultRdvNewPatientForm(): RdvNewPatientFormState {
    return {
      sex: '',
      lastname: '',
      firstname: '',
      dateOfBirth: '',
      phoneNumber: '',
    };
  }

  private getNormalizedRdvNewPatientForm(): RdvNewPatientFormState {
    return {
      sex: this.rdvNewPatientForm.sex.trim(),
      lastname: this.rdvNewPatientForm.lastname.trim(),
      firstname: this.rdvNewPatientForm.firstname.trim(),
      dateOfBirth: this.rdvNewPatientForm.dateOfBirth.trim(),
      phoneNumber: this.rdvNewPatientForm.phoneNumber.trim(),
    };
  }

  private validateRdvNewPatientForm(form: RdvNewPatientFormState): string | null {
    if (
      !form.sex
      || form.lastname.length < 2
      || form.firstname.length < 2
      || !form.dateOfBirth
    ) {
      return 'agenda.errors.newPatientRequiredFields';
    }

    if (this.normalizeDateKey(form.dateOfBirth) > this.rdvNewPatientMaxBirthDate) {
      return 'agenda.errors.newPatientBirthDateInvalid';
    }

    return null;
  }

  private resolveCreatedPatientOption(form: RdvNewPatientFormState) {
    const fullName = `${form.lastname} ${form.firstname}`.trim();

    const selectOption = (patients: Patient[]): PatientOption | null => {
      const matchedPatient = this.pickMatchingPatient(patients, form);
      return matchedPatient ? this.mapPatientToOption(matchedPatient) : null;
    };

    return this.patientService.getRecentPatients({ pageNumber: 1, pageSize: 30 }).pipe(
      map((response) => selectOption(response.patients)),
      switchMap((option) => {
        if (option) {
          return of(option);
        }

        if (!fullName) {
          return of(null);
        }

        return this.patientService.getAllPatients({
          pageNumber: 1,
          pageSize: 50,
          name: fullName,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        }).pipe(
          map((response) => selectOption(response.patients)),
          catchError(() => of(null)),
        );
      }),
      catchError(() => of(null)),
    );
  }

  private pickMatchingPatient(patients: Patient[], form: RdvNewPatientFormState): Patient | null {
    const targetLastname = this.normalizeComparable(form.lastname);
    const targetFirstname = this.normalizeComparable(form.firstname);
    const targetSex = this.normalizeComparable(form.sex);
    const targetDateOfBirth = this.normalizeDateKey(form.dateOfBirth);
    const targetPhoneNumber = this.normalizePhone(form.phoneNumber);

    const exactMatch = patients.find((patient) =>
      this.normalizeComparable(patient.lastname) === targetLastname
      && this.normalizeComparable(patient.firstname) === targetFirstname
      && this.normalizeComparable(patient.sex) === targetSex
      && this.normalizeDateKey(patient.dateOfBirth) === targetDateOfBirth
      && this.normalizePhone(patient.phoneNumber) === targetPhoneNumber,
    );
    if (exactMatch) {
      return exactMatch;
    }

    const nameAndBirthDateMatch = patients.find((patient) =>
      this.normalizeComparable(patient.lastname) === targetLastname
      && this.normalizeComparable(patient.firstname) === targetFirstname
      && this.normalizeDateKey(patient.dateOfBirth) === targetDateOfBirth,
    );
    if (nameAndBirthDateMatch) {
      return nameAndBirthDateMatch;
    }

    return patients.find((patient) =>
      this.normalizeComparable(patient.lastname) === targetLastname
      && this.normalizeComparable(patient.firstname) === targetFirstname,
    ) ?? null;
  }

  private resetRdvNewPatientFormState(): void {
    this.isRdvNewPatientFormOpen = false;
    this.isRdvNewPatientValidationTouched = false;
    this.rdvNewPatientForm = this.createDefaultRdvNewPatientForm();
  }

  private createDefaultLeaveForm(date?: string): LeaveFormState {
    return {
      date: date ?? this.toDateKey(this.selectedDay),
      isFullDay: true,
      startTime: '',
      endTime: '',
      type: 'annual',
      name: '',
      description: '',
      isRecurring: false,
    };
  }

  private createDefaultVariableHolidayForm(): VariableHolidayFormState {
    return {
      date: `${this.holidayManageYear}-${this.pad(this.currentMonthDate.getMonth() + 1)}-${this.pad(this.currentMonthDate.getDate())}`,
      name: '',
      description: '',
      isRecurring: false,
    };
  }

  private getDefaultSlotTime(): string {
    if (this.fullTimeSlots.length > 0) {
      return this.fullTimeSlots[0];
    }
    return `${this.pad(this.startHour)}:00`;
  }

  private parseHourValue(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value.split(':')[0] ?? '', 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
      return null;
    }

    return parsed;
  }

  private stripTime(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private normalizeOptionalString(value: string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeComparable(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private normalizePhone(value: string | null | undefined): string {
    return (value ?? '').replace(/\D+/g, '');
  }

  private normalizeDateKey(value: string | null | undefined): string {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return `${parsed.getFullYear()}-${this.pad(parsed.getMonth() + 1)}-${this.pad(parsed.getDate())}`;
  }

  private extractApiErrorMessage(error: unknown): string {
    const unknownError = error as {
      error?: { message?: string; Message?: string } | string;
      message?: string;
    };

    if (typeof unknownError?.error === 'string' && unknownError.error.trim() !== '') {
      return unknownError.error;
    }

    const nestedMessage =
      unknownError?.error && typeof unknownError.error === 'object'
        ? unknownError.error.message ?? unknownError.error.Message
        : null;

    if (typeof nestedMessage === 'string' && nestedMessage.trim() !== '') {
      return nestedMessage;
    }

    if (typeof unknownError?.message === 'string' && unknownError.message.trim() !== '') {
      return unknownError.message;
    }

    return '';
  }

  private isHolidayLeaveType(type?: string): boolean {
    return type === this.holidayFixedLeaveType || type === this.holidayVariableLeaveType;
  }

  private rebuildHolidayByDate(): void {
    const mapped: Record<string, string[]> = {};

    this.holidayLeaves.forEach((leave) => {
      if (!leave.date) {
        return;
      }

      if (!mapped[leave.date]) {
        mapped[leave.date] = [];
      }

      const label = leave.name?.trim() || this.i18n.t('agenda.badge.holiday');
      if (!mapped[leave.date].includes(label)) {
        mapped[leave.date].push(label);
      }
    });

    this.holidayByDate = mapped;
  }

  private loadHolidayManageState(): void {
    const fixedCatalog$ = this.fixedHolidayCatalog.length > 0
      ? of(this.fixedHolidayCatalog)
      : this.agendaService.getHolidays();

    this.isHolidaySaving = true;
    forkJoin([fixedCatalog$, this.agendaService.getLeavesByYear(String(this.holidayManageYear))])
      .pipe(
        finalize(() => { this.isHolidaySaving = false; this.cdr.detectChanges(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ([catalog, leaves]) => {
          this.fixedHolidayCatalog = catalog;
          const holidayLeaves = leaves.filter((leave) => this.isHolidayLeaveType(leave.type));

          this.holidayFixedChoices = catalog.map((holiday) => {
            const existing = holidayLeaves.find((leave) =>
              leave.type === this.holidayFixedLeaveType
              && leave.date.endsWith(holiday.date),
            );

            return {
              date: holiday.date,
              name: holiday.name,
              checked: !!existing,
              leaveId: existing?.id ?? null,
            };
          });

          this.variableHolidayList = holidayLeaves
            .filter((leave) => leave.type === this.holidayVariableLeaveType)
            .sort((left, right) => left.date.localeCompare(right.date));
        },
        error: (error) => {
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  private getRdvDuration(rdv: Rdv): number {
    const value = rdv.duration ?? this.timeSlotInterval;
    return this.normalizeDuration(value);
  }

  private normalizeDuration(duration: number): number {
    const slot = this.timeSlotInterval > 0 ? this.timeSlotInterval : 15;
    const rounded = Math.max(slot, Math.round(duration / slot) * slot);
    const maxDuration = Math.max(slot, (this.endHour - this.startHour) * 60);
    return Math.min(rounded, maxDuration);
  }

  private canPlaceRdv(dateKey: string, startMinutes: number, duration: number, _ignoreRdvId?: string): boolean {
    const endMinutes = startMinutes + duration;
    if (startMinutes < (this.startHour * 60) || endMinutes > (this.endHour * 60)) {
      return false;
    }

    if ((this.holidayByDate[dateKey]?.length ?? 0) > 0) {
      return false;
    }

    const blockedByLeave = this.regularLeaves.some((leave) => {
      if (leave.date !== dateKey) {
        return false;
      }

      if (leave.isFullDay) {
        return true;
      }

      if (!leave.startTime || !leave.endTime) {
        return false;
      }

      const leaveStart = this.timeToMinutes(leave.startTime);
      const leaveEnd = this.timeToMinutes(leave.endTime);
      return startMinutes < leaveEnd && endMinutes > leaveStart;
    });

    if (blockedByLeave) {
      return false;
    }

    return true;
  }

  private handleResizeMove(event: MouseEvent): void {
    if (!this.resizingRdvId) {
      return;
    }

    const rdv = this.rdvs.find((item) => item.id === this.resizingRdvId);
    if (!rdv) {
      return;
    }

    const deltaY = event.clientY - this.resizeStartY;
    const slotDelta = Math.round(deltaY / this.slotPixelHeight);
    const nextDuration = this.normalizeDuration(this.resizeInitialDuration + (slotDelta * this.timeSlotInterval));
    const currentDuration = this.getRdvDuration(rdv);

    if (nextDuration === currentDuration) {
      return;
    }

    const startMinutes = this.timeToMinutes(rdv.time);
    if (!this.canPlaceRdv(rdv.date, startMinutes, nextDuration, rdv.id)) {
      return;
    }

    rdv.duration = nextDuration;
    if (rdv.isPersonnel) {
      rdv.personnelDuration = nextDuration;
    }
    this.resizeChanged = true;
    this.cdr.detectChanges();
  }

  private completeResize(): void {
    if (!this.resizingRdvId) {
      return;
    }

    const rdvId = this.resizingRdvId;
    const rdv = this.rdvs.find((item) => item.id === rdvId);
    const rollbackDuration = this.resizeInitialDuration;
    const didChange = this.resizeChanged;

    this.resizingRdvId = null;
    this.resizeChanged = false;

    if (!rdv || !rdv.id || !didChange) {
      return;
    }

    this.persistRdvMoveOrResize(rdv, () => {
      rdv.duration = rollbackDuration;
      if (rdv.isPersonnel) {
        rdv.personnelDuration = rollbackDuration;
      }
      this.cdr.detectChanges();
    });
  }

  private persistRdvMoveOrResize(rdv: Rdv, rollback: () => void): void {
    if (!rdv.id) {
      rollback();
      return;
    }

    const payload: Rdv = {
      date: rdv.date,
      time: rdv.time,
      duration: this.getRdvDuration(rdv),
      motifs: rdv.motifs ?? [],
      isPersonnel: rdv.isPersonnel,
      patientId: rdv.isPersonnel ? null : (rdv.patientId ?? null),
      patientName: rdv.patientName,
      personnelDescription: rdv.personnelDescription,
      personnelDuration: rdv.isPersonnel ? this.getRdvDuration(rdv) : undefined,
    };

    this.agendaService.updateRdv(rdv.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('agenda.toast.rdvUpdated'));
          this.reloadCurrentViewRdvs();
        },
        error: (error) => {
          rollback();
          this.toast.error(this.extractApiErrorMessage(error) || this.i18n.t('common.error'));
        },
      });
  }

  private minutesToTime(totalMinutes: number): string {
    const clamped = Math.max(0, Math.min(totalMinutes, (24 * 60) - 1));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    return `${this.pad(hours)}:${this.pad(minutes)}`;
  }
}

