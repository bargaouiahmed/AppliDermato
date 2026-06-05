import { Component, OnInit, ViewChild, ElementRef, HostListener } from "@angular/core";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { RdvService } from "src/app/services/rdv/rdv.service";
import { SharedDataService } from "src/app/services/shared/shared.service";
import { AddRdvPopupComponent } from "src/app/dashboard/shared/add-rdv-popup/add-rdv-popup.component";
import { SettingsHoursPopupComponent } from "../settings-hours-popup/settings-hours-popup.component";
import { ManagePublicHolidaysComponent } from "../manage-public-holidays/manage-public-holidays.component";
import { ManageLeavesPopupComponent } from "../manage-leaves-popup/manage-leaves-popup.component";
import * as $ from "jquery";
import { NgxSpinnerService } from "ngx-spinner";
import { AuthService } from "src/app/services/auth/auth.service";
import { MedecinService } from "src/app/services/profils/medecin/medecin.service";
import { PopupAddNewExamenComponent } from "../../accueil/popup-add-new-examen/popup-add-new-examen.component";
import { forkJoin } from "rxjs";
declare var jQuery: any;


@Component({
  selector: "app-calendar",
  templateUrl: "./calendar.component.html",
  styleUrls: ["./calendar.component.css"],
})
export class CalendarComponentt implements OnInit {
  // Congés dynamiques
  leaves: any[] = [];

  // Jours fériés
  holidays: { [date: string]: string } = {};
  holidayNames: { [date: string]: string } = {};

  // Médecin et journées opératoires
  medcin: any;
  isJourneesDropdownOpen = false;
  fullDaysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  // Configuration calendrier
  isIntervalDropdownOpen = false;
  timeSlotInterval: number = 15;
  startHour: number = 8;
  endHour: number = 17;
  openedFullDay: Date | null = null;
  viewMode: "day" | "week" | "month" = "week";
  selectedDay: Date = new Date();
  weekStart: Date;
  weekEnd: Date;
  weekDays: Date[] = [];
  fullTimeSlots: string[] = [];
  timeSlots: string[] = [];
  currentTime: Date = new Date();
  currentMonthDate: Date = new Date();
  monthWeeks: { date: Date; isCurrentMonth: boolean }[][] = [];
  daysOfWeek: string[] = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  filter: "morning" | "afternoon" | "full" = "morning";
  workingHoursByDate: { [date: string]: { start: string; end: string } } = {};
  expandedDays: { [dateKey: string]: boolean } = {};
  expandedSlots: { [slotKey: string]: boolean } = {};

  // Rendez-vous
  rdvs: {
    _id: string;
    date: string;
    day: string;
    time: string;
    nom: string;
    prenom: string;
    patientId: string;
    isOperation?: boolean;
    operateur?: string;
    operationDuration?: number;
    operationName?: string;
    isPersonnel?: boolean;
    personnelDescription?: string;
    personnelDuration?: number;
    sourceExamenId?: string;
    planningType?: string;
    planningOeil?: string;
    mergedRdvIds?: string[];
    mergedPlanningOeils?: string[];
    isMergedPlanningRdv?: boolean;
  }[] = [];

  rdvToDeleted: any;

  @ViewChild('journeesDropdown') journeesDropdown!: ElementRef;

  constructor(
    private modalService: NgbModal,
    private rdvService: RdvService,
    private leaveService: RdvService,
    private authService: AuthService,
    private sharedService: SharedDataService,
    private spinner: NgxSpinnerService,
    private medecinService: MedecinService,

  ) { }

  ngOnInit(): void {
    this.spinner.show();
    setTimeout(() => {
      this.spinner.hide();
    }, 2000);
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);

    const currentYear = new Date().getFullYear();
    this.loadHolidays(currentYear);

    // Charger les informations du médecin
    this.loadMedecinProfile();

    // Écouter les événements de mise à jour
    // Écouter les événements de mise à jour (REFRACTION: Single Subscription)
    this.sharedService.submitEvent$.subscribe(() => {
      this.refreshCurrentView();
    });

    this.loadLeaves();
    this.getHoursCalendar();
    this.getTimeSlotIntreval();
    this.setCurrentWeek(new Date());
    this.setCurrentMonth(new Date());
    this.loadRdvsForWeek();
  }

  // Charger le profil du médecin
  loadMedecinProfile(): void {
    this.authService.getProfileMedecin().subscribe({
      next: (profile: any) => {
        this.medcin = profile.medecin;
      },
      error: (err) => {
        console.error('Erreur lors du chargement du profil médecin:', err);
      }
    });
  }

  // Vérifier si un jour est un jour opératoire
  isOperationalDay(date: Date): boolean {
    if (!this.medcin?.journeesOperatoires) return false;
    const dayOfWeek = date.getDay(); // 0=Dimanche, 1=Lundi, etc.
    return this.medcin.journeesOperatoires.includes(dayOfWeek);
  }

  // Vérifier si un index de jour est opératoire (pour le dropdown)
  isDayOperational(dayIndex: number): boolean {
    if (!this.medcin?.journeesOperatoires) return false;
    return this.medcin.journeesOperatoires.includes(dayIndex);
  }

  // Basculer un jour opératoire et sauvegarder
  toggleOperationalDay(dayIndex: number): void {
    if (!this.medcin) return;
    if (!this.medcin.journeesOperatoires) {
      this.medcin.journeesOperatoires = [];
    }

    const index = this.medcin.journeesOperatoires.indexOf(dayIndex);
    if (index > -1) {
      this.medcin.journeesOperatoires.splice(index, 1);
    } else {
      this.medcin.journeesOperatoires.push(dayIndex);
    }

    // Sauvegarder immédiatement
    this.medecinService.editProfil({
      _id: this.medcin._id,
      journeesOperatoires: this.medcin.journeesOperatoires
    }).subscribe({
      error: (err) => {
        console.error('Erreur sauvegarde journées opératoires:', err);
      }
    });
  }

  toggleJourneesDropdown(): void {
    this.isJourneesDropdownOpen = !this.isJourneesDropdownOpen;
  }

  goToExamen(rdv: any): void {
    const modalRef = this.modalService.open(PopupAddNewExamenComponent, {
      centered: true,
    });
    modalRef.componentInstance.patient = rdv.patientId;
    modalRef.componentInstance.motifChoisedForRdv = rdv.motif || null;
    let start = new Date(rdv.date);
    if (rdv.time) {
      const [hours, minutes] = rdv.time.split(':').map(Number);
      start.setHours(hours, minutes, 0, 0);
    }
    modalRef.componentInstance.start = start;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isJourneesDropdownOpen) {
      return;
    }
    if (this.journeesDropdown && !this.journeesDropdown.nativeElement.contains(event.target)) {
      this.isJourneesDropdownOpen = false;
    }
  }

  // Obtenir le nom du jour en français
  getDayName(dayIndex: number): string {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayIndex] || '';
  }

  // ========== MÉTHODES POUR LES CONGÉS ==========

  loadLeaves(): void {
    const currentYear = new Date().getFullYear();
    this.leaveService.getLeavesByYearByMedecin(currentYear.toString())
      .subscribe({
        next: (leaves) => {
          this.leaves = leaves;
        },
        error: (err) => {
          console.error("Erreur chargement congés:", err);
        }
      });
  }

  isLeave(date: Date): boolean {
    const dateStr = date.toISOString().split("T")[0];
    return this.leaves.some(leave => leave.date === dateStr);
  }

  isLeaveTimeSlot(date: Date, time: string): boolean {
    const dateStr = date.toISOString().split("T")[0];
    const leave = this.leaves.find(l => l.date === dateStr);

    if (!leave || leave.isFullDay) {
      return !!leave;
    }

    // Pour les congés partiels
    if (leave.startTime && leave.endTime) {
      const slotTime = time;
      return slotTime >= leave.startTime && slotTime < leave.endTime;
    }

    return false;
  }

  getLeaveName(date: Date): string {
    const dateStr = date.toISOString().split("T")[0];
    const leave = this.leaves.find(l => l.date === dateStr);
    return leave ? leave.name : "Congé";
  }

  getLeaveDetails(date: Date): any | null {
    const dateStr = date.toISOString().split("T")[0];
    return this.leaves.find(l => l.date === dateStr) || null;
  }

  getLeaveTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'annual': 'Annuel',
      'sick': 'Maladie',
      'personal': 'Personnel',
      'training': 'Formation',
      'other': 'Autre'
    };
    return labels[type] || type;
  }

  // ========== MÉTHODES POUR L'INDISPONIBILITÉ ==========

  isUnavailable(date: Date): boolean {
    return this.isHoliday(date) || this.isLeave(date);
  }

  isTimeSlotUnavailable(date: Date, time: string): boolean {
    // Allow past slots to be booked/modified ("dumb calendar" mode)
    // return this.isPast(date, time) || this.isHoliday(date) || this.isLeaveTimeSlot(date, time);
    return this.isHoliday(date) || this.isLeaveTimeSlot(date, time);
  }

  getUnavailableType(date: Date): string {
    if (this.isHoliday(date)) return "holiday";
    if (this.isLeave(date)) return "leave";
    return "";
  }

  getUnavailableName(date: Date): string {
    if (this.isHoliday(date)) return this.getHolidayName(date);
    if (this.isLeave(date)) return this.getLeaveName(date);
    return "";
  }

  getCellTooltip(date: Date, time: string): string {
    if (this.isHoliday(date)) {
      return `Jour férié: ${this.getHolidayName(date)}`;
    }
    if (this.isLeaveTimeSlot(date, time)) {
      const leave = this.getLeaveDetails(date);
      if (leave) {
        if (leave.isFullDay) {
          return `Congé: ${leave.name}${leave.description ? ' - ' + leave.description : ''}`;
        } else {
          return `Congé partiel: ${leave.name} (${leave.startTime} - ${leave.endTime})`;
        }
      }
    }
    if (this.isPast(date, time)) {
      return "Date passée - Cliquez pour ajouter une consultation ancienne";
    }
    return "Cliquez pour ajouter un rendez-vous";
  }

  getCurrentLeavesCount(): number {
    const mode = this.viewMode;
    const today = new Date();

    if (mode === "day") {
      const selectedDateStr = this.selectedDay.toISOString().split("T")[0];
      return this.leaves.filter(leave => leave.date === selectedDateStr).length;
    }

    if (mode === "week") {
      const startStr = this.weekStart.toISOString().split("T")[0];
      const endStr = this.weekEnd.toISOString().split("T")[0];
      return this.leaves.filter(leave =>
        leave.date >= startStr && leave.date <= endStr
      ).length;
    }

    if (mode === "month") {
      const currentMonthStr = this.currentMonthDate.toISOString().slice(0, 7);
      return this.leaves.filter(leave => leave.date.startsWith(currentMonthStr)).length;
    }

    return 0;
  }

  // ========== MÉTHODES EXISTANTES (MISES À JOUR) ==========

  isHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split("T")[0];
    return !!this.holidays[dateStr];
  }

  getHolidayName(date: Date): string {
    const dateStr = date.toISOString().split("T")[0];
    return this.holidayNames[dateStr] || "";
  }

  isPast(date: Date, time: string = ""): boolean {
    const now = new Date();
    const target = new Date(date);

    if (time) {
      const [hours, minutes] = time.split(":").map(Number);
      target.setHours(hours, minutes, 0, 0);
    } else {
      now.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
    }

    // Ne vérifier que le temps passé, sans inclure les jours fériés/congés
    return target < now;
  }

  isTimeSlotBlocked(date: Date, time: string): boolean {
    const isHolidayDay = this.isHoliday(date);
    const isLeaveDay = time ? this.isLeaveTimeSlot(date, time) : this.isLeave(date);
    return isHolidayDay || isLeaveDay;
  }

  setCurrentWeek(date: Date) {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    this.weekStart = new Date(date);
    this.weekStart.setDate(date.getDate() + diffToMonday);
    this.weekEnd = new Date(this.weekStart);
    this.weekEnd.setDate(this.weekStart.getDate() + 5);
    this.generateWeekDays();
  }

  generateWeekDays() {
    this.weekDays = [];
    for (let i = 0; i < 6; i++) {
      const day = new Date(this.weekStart);
      day.setDate(this.weekStart.getDate() + i);
      this.weekDays.push(day);
    }
  }

  setView(mode: "day" | "week" | "month") {
    this.viewMode = mode;
    if (mode === "day") {
      this.selectedDay = new Date();
      this.loadRdvsForSelectedDate();
    } else if (mode === "week") {
      this.loadRdvsForWeek();
    } else if (mode === "month") {
      this.loadRdvsByMonth();
    }
  }

  generateTimeSlots() {
    this.fullTimeSlots = [];
    let startHourH = this.startHour;
    let endHourH = this.endHour;

    for (let h = startHourH; h < endHourH; h++) {
      for (let m = 0; m < 60; m += this.timeSlotInterval) {
        const hourStr = `${("0" + h).slice(-2)}:${("0" + m).slice(-2)}`;
        this.fullTimeSlots.push(hourStr);
      }
    }

    this.fullTimeSlots.push(endHourH.toString() + ":00");
    this.applyFilter();
  }

  applyFilter() {
    if (this.filter === "morning") {
      this.timeSlots = this.fullTimeSlots.filter((t) => t < "12:30");
    } else if (this.filter === "afternoon") {
      this.timeSlots = this.fullTimeSlots.filter((t) => t >= "12:30");
    } else {
      this.timeSlots = this.fullTimeSlots;
    }
  }

  setFilter(f: "morning" | "afternoon" | "full") {
    this.filter = f;
    this.applyFilter();
  }

  getRdvsForSlot(day: Date | string, time: string) {
    if (!time) return [];

    let dateStr: string | null = null;
    if (day instanceof Date) {
      const adjustedDate = new Date(day);
      adjustedDate.setMinutes(adjustedDate.getMinutes() - adjustedDate.getTimezoneOffset());
      dateStr = adjustedDate.toISOString().split("T")[0];
    }

    if (dateStr) {
      return this.rdvs.filter((r) => r.date === dateStr && this.isTimeInSlot(r.time, time));
    }

    const dayLower = typeof day === "string" ? day.toLowerCase() : "";
    return this.rdvs.filter(
      (r) => r.day.toLowerCase() === dayLower && this.isTimeInSlot(r.time, time)
    );
  }

  getRdv(day: Date | string, time: string) {
    return this.getRdvsForSlot(day, time)[0];
  }

  getSlotKey(day: Date | string, time: string): string {
    if (day instanceof Date) {
      const adjustedDate = new Date(day);
      adjustedDate.setMinutes(adjustedDate.getMinutes() - adjustedDate.getTimezoneOffset());
      return `${adjustedDate.toISOString().split("T")[0]}|${time}`;
    }

    return `${String(day).toLowerCase()}|${time}`;
  }

  toggleSlotExpanded(day: Date | string, time: string): void {
    const key = this.getSlotKey(day, time);
    this.expandedSlots[key] = !this.expandedSlots[key];
  }

  isSlotExpanded(day: Date | string, time: string): boolean {
    return !!this.expandedSlots[this.getSlotKey(day, time)];
  }

  // Check if rdvTime falls within the slot starting at slotTime
  isTimeInSlot(rdvTime: string, slotTime: string): boolean {
    if (!rdvTime || !slotTime) return false;
    const rdvMins = this.timeToMinutes(rdvTime);
    const slotMins = this.timeToMinutes(slotTime);
    return rdvMins >= slotMins && rdvMins < (slotMins + this.timeSlotInterval);
  }

  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  getRdvEndTime(rdv: any): string {
    const startMinutes = this.timeToMinutes(rdv.time);
    const duration = rdv.operationDuration || this.timeSlotInterval;
    const endMinutes = startMinutes + duration;

    const hours = Math.floor(endMinutes / 60);
    const mins = endMinutes % 60;
    return `${("0" + hours).slice(-2)}:${("0" + mins).slice(-2)}`;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  previousWeek() {
    const prevWeek = new Date(this.weekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    this.setCurrentWeek(prevWeek);
    this.loadRdvsForWeek();
  }

  nextWeek() {
    const nextWeek = new Date(this.weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    this.setCurrentWeek(nextWeek);
    this.loadRdvsForWeek();
  }

  previousDay() {
    const prev = new Date(this.selectedDay);
    prev.setDate(prev.getDate() - 1);
    this.selectedDay = prev;
    this.loadRdvsForSelectedDate();
  }

  nextDay() {
    const next = new Date(this.selectedDay);
    next.setDate(next.getDate() + 1);
    this.selectedDay = next;
    this.loadRdvsForSelectedDate();
  }

  setCurrentMonth(date: Date) {
    this.currentMonthDate = new Date(date);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const firstDayOfWeek = start.getDay() === 0 ? 7 : start.getDay();
    const startDate = new Date(start);
    startDate.setDate(start.getDate() - (firstDayOfWeek - 1));

    this.monthWeeks = [];
    let current = new Date(startDate);
    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      for (let day = 0; day < 7; day++) {
        weekDays.push({
          date: new Date(current),
          isCurrentMonth: current.getMonth() === date.getMonth(),
        });
        current.setDate(current.getDate() + 1);
      }
      this.monthWeeks.push(weekDays);
    }
  }

  previousMonth() {
    const prev = new Date(this.currentMonthDate);
    prev.setMonth(prev.getMonth() - 1);
    this.setCurrentMonth(prev);

    const newYear = prev.getFullYear();
    if (newYear !== this.currentMonthDate.getFullYear()) {
      this.loadHolidays(newYear);
      this.loadLeaves();
    }

    this.loadRdvsByMonth();
  }

  nextMonth() {
    const next = new Date(this.currentMonthDate);
    next.setMonth(next.getMonth() + 1);
    this.setCurrentMonth(next);

    const newYear = next.getFullYear();
    if (newYear !== this.currentMonthDate.getFullYear()) {
      this.loadHolidays(newYear);
      this.loadLeaves();
    }

    this.loadRdvsByMonth();
  }

  getRdvsForDate(date: Date) {
    const adjustedDate = new Date(date);
    adjustedDate.setMinutes(adjustedDate.getMinutes() - adjustedDate.getTimezoneOffset());
    const dateStr = adjustedDate.toISOString().split("T")[0];
    return this.rdvs.filter((r) => r.date === dateStr);
  }

  openDayPopup(date: Date, time: string) {
    // Utiliser isTimeSlotBlocked pour vérifier seulement les jours fériés/congés
    // Permettre les consultations sur les dates passées
    if (this.isTimeSlotBlocked(date, time)) {
      return;
    }

    this.openAddRdvModal(date, time, false);
  }

  // Original logic moved to separate method
  openAddRdvModal(date: Date, time: string, isCreateOperationMode: boolean) {
    // Vérifier si c'est un jour opératoire (only prompt if doing normal booking on op day)
    if (this.isOperationalDay(date) && !isCreateOperationMode) {
      const dayName = this.getDayName(date.getDay());
      const confirmMessage = `Attention : Le ${dayName} est configuré comme jour opératoire.\n\nVoulez-vous quand même créer un rendez-vous normal ?`;
      if (!confirm(confirmMessage)) {
        return; // L'utilisateur a annulé
      }
    }

    if (!this.rdvs.find(r => r.date === date.toLocaleDateString("fr-CA") && r.time === time)) {
      const modalRef = this.modalService.open(AddRdvPopupComponent, {
        centered: true,
      });
      modalRef.componentInstance.selectedDate = date;
      modalRef.componentInstance.selectedTime = time;
      modalRef.componentInstance.timeSlotInterval = this.timeSlotInterval;

      // Pass the creation mode flag
      modalRef.componentInstance.isCreateOperationMode = isCreateOperationMode;

      let rdvsCopy = this.rdvs.filter((r) => r.date === date.toLocaleDateString("fr-CA"));
      const heuresNonDispo = rdvsCopy.map((rdv) => rdv.time);
      modalRef.componentInstance.heuresNonDispo = heuresNonDispo;

      const listIdPatientForDate = rdvsCopy
        .filter((pat) => pat.date === date.toLocaleDateString("fr-CA"))
        .map((pat) => pat.patientId);
      modalRef.componentInstance.listIdPatientForDate = listIdPatientForDate;

      const rdvToEdit = rdvsCopy.find((rdv) => rdv.time === time);
      if (rdvToEdit) {
        modalRef.componentInstance.rdvToEdit = rdvToEdit;
      }

      // Refetch RDVs when modal is closed (via X, backdrop click, or close button)
      modalRef.result.then(
        () => this.refreshCurrentView(),
        () => this.refreshCurrentView()
      );
    }
  }

  updateRdv(date: Date, time: string, rdv: any = null) {
    const modalRef = this.modalService.open(AddRdvPopupComponent, {
      centered: true,
    });
    modalRef.componentInstance.selectedDate = date;
    modalRef.componentInstance.selectedTime = rdv ? rdv.time : time;
    modalRef.componentInstance.medecin = this.medcin;

    let rdvsCopy = this.rdvs.filter((r) => r.date === date.toLocaleDateString("fr-CA"));
    const heuresNonDispo = rdvsCopy.map((rdv) => rdv.time);
    modalRef.componentInstance.heuresNonDispo = heuresNonDispo;

    const listIdPatientForDate = rdvsCopy
      .filter((pat) => pat.date === date.toLocaleDateString("fr-CA"))
      .map((pat) => pat.patientId);
    modalRef.componentInstance.listIdPatientForDate = listIdPatientForDate;

    let rdvToEdit = rdv;

    // Fallback search if not provided (legacy)
    if (!rdvToEdit) {
      rdvToEdit = rdvsCopy.find((r) => r.time === time);
      // Try loose match if exact match fails
      if (!rdvToEdit) {
        rdvToEdit = rdvsCopy.find((r) => this.isTimeInSlot(r.time, time));
      }
    }

    if (rdvToEdit) {
      modalRef.componentInstance.rdvToEdit = rdvToEdit;
      // Ensure specific time is used
      modalRef.componentInstance.selectedTime = rdvToEdit.time;
    }

    // Refetch RDVs when modal is closed (via X, backdrop click, or close button)
    modalRef.result.then(
      () => this.refreshCurrentView(),
      () => this.refreshCurrentView()
    );
  }

  loadRdvsForWeek(): void {
    // Use the month endpoint (which works correctly) and filter on frontend
    const monthStr = this.weekStart.toISOString().slice(0, 7);
    this.rdvService.getRdvsByMonth(monthStr).subscribe({
      next: (rdvs) => {
        // Filter to only include RDVs within the current week
        const startDateStr = this.weekStart.toLocaleDateString("fr-CA");
        const endDateStr = this.weekEnd.toLocaleDateString("fr-CA");
        this.rdvs = this.mapFetchedRdvs(
          rdvs.filter((rdv) => rdv.date >= startDateStr && rdv.date <= endDateStr)
        );
      },
      error: (err) => {
        console.error("Erreur chargement RDVs:", err);
      },
    });
  }

  loadRdvsForSelectedDate(): void {
    // Use the month endpoint (which works correctly) and filter on frontend
    const monthStr = this.selectedDay.toISOString().slice(0, 7);
    const selectedDateStr = this.selectedDay.toLocaleDateString("fr-CA");
    this.rdvService.getRdvsByMonth(monthStr).subscribe({
      next: (rdvs) => {
        // Filter to only include RDVs for the selected date
        this.rdvs = this.mapFetchedRdvs(
          rdvs.filter((rdv) => rdv.date === selectedDateStr)
        );
      },
      error: (err) => {
        console.error("Erreur récupération RDVs du jour:", err);
      },
    });
  }

  loadRdvsByMonth(): void {
    const monthStr = this.currentMonthDate.toISOString().slice(0, 7);
    const fetchRdvsByMonth = () => {
      this.rdvService.getRdvsByMonth(monthStr).subscribe({
        next: (rdvs) => {
          this.rdvs = this.mapFetchedRdvs(rdvs);
        },
        error: (err) => {
          console.error("Erreur récupération RDVs du mois:", err);
        },
      });
    };

    fetchRdvsByMonth();
  }

  refreshCurrentView() {
    // 1. Reload global data (holidays, leaves)
    const currentYear = new Date().getFullYear();
    this.loadHolidays(currentYear);
    this.loadLeaves();

    // 2. Reload RDVs based on current view mode
    if (this.viewMode === 'week') {
      this.loadRdvsForWeek();
    } else if (this.viewMode === 'day') {
      this.loadRdvsForSelectedDate();
    } else if (this.viewMode === 'month') {
      this.loadRdvsByMonth();
    }
  }

  getRdvTODeleted(rdv) {
    this.rdvToDeleted = rdv;
    jQuery('#myModalCancelRdv').modal('show');
  }

  deleteRdv() {
    const rdvIdsSource = Array.isArray(this.rdvToDeleted?.mergedRdvIds) && this.rdvToDeleted.mergedRdvIds.length > 0
      ? this.rdvToDeleted.mergedRdvIds
      : (this.rdvToDeleted?._id ? [this.rdvToDeleted._id] : []);

    const rdvIds: string[] = rdvIdsSource
      .filter((rdvId): rdvId is string => typeof rdvId === 'string' && rdvId.length > 0)
      .filter((rdvId, index, allIds) => allIds.indexOf(rdvId) === index);

    if (rdvIds.length === 0) {
      return;
    }

    forkJoin(rdvIds.map((rdvId) => this.rdvService.deleteRdv(rdvId))).subscribe({
      next: () => {
        this.rdvToDeleted = null;
        jQuery('#myModalCancelRdv').modal('hide');
        this.refreshCurrentView();
      },
      error: (err) => {
        console.error("Erreur suppression RDV:", err);
      }
    });
  }

  toggleFullDayView(date: Date) {
    this.openedFullDay = this.isSameDate(this.openedFullDay, date) ? null : date;
  }

  isSameDate(d1: Date | null, d2: Date): boolean {
    return (
      d1?.getDate() === d2.getDate() &&
      d1?.getMonth() === d2.getMonth() &&
      d1?.getFullYear() === d2.getFullYear()
    );
  }

  toggleIntervalDropdown(): void {
    this.isIntervalDropdownOpen = !this.isIntervalDropdownOpen;
  }

  setTimeSlotInterval(interval: number): void {
    this.timeSlotInterval = interval;
    this.isIntervalDropdownOpen = false;
    this.rdvService.updateIntervalleCalendar(interval).subscribe();
    this.generateTimeSlots();
    this.applyFilter();
  }

  getTimeSlotIntreval() {
    this.rdvService.getIntervalleCalendar().subscribe((data) => {
      this.timeSlotInterval = data;
      this.setCurrentWeek(new Date());
      this.generateTimeSlots();
      this.applyFilter();
    });
  }

  getHoursCalendar() {
    this.rdvService.getHeuresCalendar().subscribe((data) => {
      this.startHour = data.startHour;
      this.endHour = data.endHour;
      this.generateTimeSlots();
      this.applyFilter();
    });
  }

  openWorkingHoursModal() {
    const modalRef = this.modalService.open(SettingsHoursPopupComponent, {
      centered: true,
    });
    modalRef.componentInstance.startHour = this.startHour;
    modalRef.componentInstance.endHour = this.endHour;

    modalRef.result.then((result) => {
      if (result) {
        this.startHour = result.startHour;
        this.endHour = result.endHour;
        this.generateTimeSlots();
        this.applyFilter();
      }
    }).catch(() => { });
  }

  openManageDaysPublicHolidaysModal() {
    const modalRef = this.modalService.open(ManagePublicHolidaysComponent, {
      centered: true,
      windowClass: "holiday-modal",
    });
  }

  toggleExpanded(date: Date) {
    const key = this.getDateKey(date);
    this.expandedDays[key] = !this.expandedDays[key];
  }

  isExpanded(date: Date): boolean {
    return !!this.expandedDays[this.getDateKey(date)];
  }

  getDateKey(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  getCurrentRdvCount(): number {
    const mode = this.viewMode;

    if (mode === "day") {
      const selectedDateStr = this.selectedDay.toISOString().split("T")[0];
      return this.rdvs.filter((rdv) => rdv.date === selectedDateStr).length;
    }

    if (mode === "week") {
      const startStr = this.weekStart.toISOString().split("T")[0];
      const endStr = this.weekEnd.toISOString().split("T")[0];
      return this.rdvs.filter((rdv) => rdv.date >= startStr && rdv.date <= endStr).length;
    }

    if (mode === "month") {
      const currentMonthStr = this.currentMonthDate.toISOString().slice(0, 7);
      return this.rdvs.filter((rdv) => rdv.date.startsWith(currentMonthStr)).length;
    }

    return 0;
  }

  getPlanningBadgeLabel(rdv: any): string {
    if (!rdv?.planningType) return '';
    const typeLabel = rdv.planningType === 'IOL (Cataracte)' ? 'IOL' : rdv.planningType;
    let label = typeLabel;
    const planningEyes = this.getOrderedPlanningEyes(
      Array.isArray(rdv?.mergedPlanningOeils) && rdv.mergedPlanningOeils.length > 0
        ? rdv.mergedPlanningOeils
        : [rdv?.planningOeil]
    );

    if (planningEyes.length > 0) {
      label += ` (${planningEyes.map((eye) => this.getPlanningEyeShortLabel(eye)).join(' + ')})`;
    }
    return label;
  }

  private mapFetchedRdvs(rdvs: any[]): any[] {
    return this.normalizeCalendarRdvs(this.sortRdvsByDateTime(rdvs));
  }

  private sortRdvsByDateTime(rdvs: any[]): any[] {
    return [...(rdvs || [])].sort((a, b) => {
      const dateA = new Date(`${a?.date || ''}T${a?.time || a?.heure || '00:00'}`);
      const dateB = new Date(`${b?.date || ''}T${b?.time || b?.heure || '00:00'}`);
      return dateA.getTime() - dateB.getTime();
    });
  }

  private normalizeCalendarRdvs(rdvs: any[]): any[] {
    const groupedEntries = new Map<string, { items: any[]; firstIndex: number }>();

    rdvs.forEach((rdv, index) => {
      if (!this.isBilateralPlanningMergeCandidate(rdv)) {
        groupedEntries.set(`plain:${index}`, { items: [{ ...rdv }], firstIndex: index });
        return;
      }

      const key = this.buildPlanningMergeKey(rdv);
      const existing = groupedEntries.get(key);
      if (existing) {
        existing.items.push({ ...rdv });
        return;
      }

      groupedEntries.set(key, { items: [{ ...rdv }], firstIndex: index });
    });

    return Array.from(groupedEntries.values())
      .sort((a, b) => a.firstIndex - b.firstIndex)
      .reduce((mergedRdvs: any[], group) => {
        return mergedRdvs.concat(this.mergePlanningGroup(group.items));
      }, []);
  }

  private mergePlanningGroup(rdvs: any[]): any[] {
    const planningEyes = this.getOrderedPlanningEyes(rdvs.map((rdv) => rdv?.planningOeil));
    if (planningEyes.length < 2) {
      return rdvs;
    }

    return [{
      ...rdvs[0],
      mergedRdvIds: Array.from(new Set(rdvs.map((rdv) => rdv?._id).filter(Boolean))),
      mergedPlanningOeils: planningEyes,
      isMergedPlanningRdv: true
    }];
  }

  private isBilateralPlanningMergeCandidate(rdv: any): boolean {
    return !!(
      rdv?.isOperation
      && rdv?.sourceExamenId
      && rdv?.planningType
      && this.normalizePlanningEyeLabel(rdv?.planningOeil)
    );
  }

  private buildPlanningMergeKey(rdv: any): string {
    return [
      rdv?.sourceExamenId || '',
      rdv?.planningType || '',
      rdv?.patientId || '',
      rdv?.date || '',
      rdv?.time || rdv?.heure || '',
      rdv?.operationName || '',
      rdv?.operateur || ''
    ].join('|');
  }

  private normalizePlanningEyeLabel(eye: string): string {
    const value = `${eye || ''}`.trim().toLowerCase();
    if (value === 'oeil droit' || value === 'oeildroit' || value === 'od' || value === 'droit') {
      return 'oeil droit';
    }
    if (value === 'oeil gauche' || value === 'oeilgauche' || value === 'og' || value === 'gauche') {
      return 'oeil gauche';
    }
    return '';
  }

  private getOrderedPlanningEyes(eyes: string[]): string[] {
    const normalizedEyes = new Set(
      (eyes || [])
        .map((eye) => this.normalizePlanningEyeLabel(eye))
        .filter(Boolean)
    );

    const orderedEyes: string[] = [];
    if (normalizedEyes.has('oeil droit')) orderedEyes.push('oeil droit');
    if (normalizedEyes.has('oeil gauche')) orderedEyes.push('oeil gauche');
    return orderedEyes;
  }

  private getPlanningEyeShortLabel(eye: string): string {
    if (eye === 'oeil droit') return 'OD';
    if (eye === 'oeil gauche') return 'OG';
    return eye;
  }

  loadHolidays(year: number): void {
    this.rdvService.getListHolidaysDays().subscribe((data) => {
      let fixedHolidays = data.publicHolidays;

      this.holidays = {};
      this.holidayNames = {};

      fixedHolidays.forEach((holiday) => {
        const fullDate = `${year}-${holiday.date}`;
        this.holidays[fullDate] = "fixed";
        this.holidayNames[fullDate] = holiday.name;
      });
    });
  }

  openManageLeavesModal() {
    // Fermer d'abord tout modal ouvert si nécessaire
    this.modalService.dismissAll();

    // Ajouter un petit délai pour éviter les conflits
    setTimeout(() => {
      const modalRef = this.modalService.open(ManageLeavesPopupComponent, {
        centered: true,
        size: 'xl',
        windowClass: 'centered-modal'
      });

      modalRef.result.then((result) => {
        if (result) {
          this.loadLeaves();
        }
      }).catch(() => { });
    }, 100);
  }
}
