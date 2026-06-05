import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Subject } from 'rxjs';
import {
  DoctorListItem,
  DoctorSubscriptionStatus,
  IssuableDoctorRole,
  ListDoctorsQuery,
} from '../../../../core/models/admin.models';
import { AdminService } from '../../../../core/services/admin.service';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { environment } from '../../../../../environments/environment';

type MedecinMainTab = 'doctors' | 'suspended' | 'admins' | 'deleted';

@Component({
  selector: 'app-medecins-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './medecins-page.html',
  styleUrl: './medecins-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedecinsPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly userContext = inject(UserContextService);

  protected readonly isLoadingList = signal(false);
  protected readonly processingDoctorId = signal<string | null>(null);
  protected readonly brokenAvatarDoctorIds = signal<Set<string>>(new Set<string>());
  protected readonly pageSizeOptions = [3, 10, 20, 30, 50];
  protected readonly mainTabs: MedecinMainTab[] = ['doctors', 'suspended', 'admins', 'deleted'];
  protected readonly durationPresetYears = [1, 2, 3, 4, 5];
  protected readonly isDurationModalOpen = signal(false);
  protected readonly durationYearsInput = signal(1);

  protected doctors: DoctorListItem[] = [];
  protected tabCounts: Record<MedecinMainTab, number> = {
    doctors: 0,
    suspended: 0,
    admins: 0,
    deleted: 0,
  };

  protected searchQuery = '';
  protected selectedMainTab: MedecinMainTab = 'doctors';
  protected pageNumber = 1;
  protected pageSize = 3;
  protected totalCount = 0;
  protected readonly isCurrentUserSuperAdmin = this.auth.hasAnyRole(['super_admin']);

  private readonly searchChange$ = new Subject<string>();
  private durationModalResolver: ((value: number | undefined) => void) | null = null;

  protected get hasDoctors(): boolean {
    return this.doctors.length > 0;
  }

  protected get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  protected get fromItem(): number {
    if (!this.totalCount) {
      return 0;
    }

    return (this.pageNumber - 1) * this.pageSize + 1;
  }

  protected get toItem(): number {
    return Math.min(this.pageNumber * this.pageSize, this.totalCount);
  }

  protected get visiblePages(): number[] {
    if (!this.totalCount) {
      return [];
    }

    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.pageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > this.totalPages) {
      endPage = this.totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  ngOnInit(): void {
    this.searchChange$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.pageNumber = 1;
        this.loadDoctors();
      });

    this.refreshTabCounts();
    this.loadDoctors();
  }

  protected goToCreateForm(): void {
    this.router.navigate(['/medecins/new']);
  }

  protected goToCreateAdminForm(): void {
    this.router.navigate(['/medecins/new'], { queryParams: { role: 'admin' } });
  }

  protected onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchChange$.next(value.trim());
  }

  protected onMainTabChange(tab: MedecinMainTab): void {
    if (this.selectedMainTab === tab) {
      return;
    }

    this.selectedMainTab = tab;
    this.pageNumber = 1;
    this.loadDoctors();
  }

  protected onPageSizeChange(value: string | number): void {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return;
    }

    this.pageSize = parsed;
    this.pageNumber = 1;
    this.loadDoctors();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.pageNumber) {
      return;
    }

    this.pageNumber = page;
    this.loadDoctors();
  }

  protected getMainTabLabelKey(tab: MedecinMainTab): string {
    switch (tab) {
      case 'doctors':
        return 'medecins.list.mainTabs.doctors';
      case 'suspended':
        return 'medecins.list.mainTabs.suspendedDoctors';
      case 'admins':
        return 'medecins.list.mainTabs.admins';
      default:
        return 'medecins.list.mainTabs.deletedDoctors';
    }
  }

  protected getCurrentViewTitleKey(): string {
    return this.getMainTabLabelKey(this.selectedMainTab);
  }

  protected getTabCount(tab: MedecinMainTab): number {
    return this.tabCounts[tab] ?? 0;
  }

  protected getEmptyStateMessageKey(): string {
    switch (this.selectedMainTab) {
      case 'admins':
        return 'medecins.list.emptyAdmins';
      case 'suspended':
        return 'medecins.list.emptySuspended';
      case 'deleted':
        return 'medecins.list.emptyDeleted';
      default:
        return 'medecins.list.emptyDoctors';
    }
  }

  protected getRoleLabelKey(role: IssuableDoctorRole): string {
    return `medecins.role.${role}`;
  }

  protected getStatusLabelKey(status: DoctorSubscriptionStatus): string {
    switch (status) {
      case 'active':
        return 'medecins.list.status.active';
      case 'expiring_soon':
        return 'medecins.list.status.expiringSoon';
      case 'admin':
        return 'medecins.list.status.admin';
      case 'suspended':
        return 'medecins.list.status.suspended';
      case 'deleted':
        return 'medecins.list.status.deleted';
      default:
        return 'medecins.list.status.expired';
    }
  }

  protected getStatusClass(status: DoctorSubscriptionStatus): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'expiring_soon':
        return 'status-expiring';
      case 'admin':
        return 'status-admin';
      case 'suspended':
        return 'status-suspended';
      case 'deleted':
        return 'status-deleted';
      default:
        return 'status-expired';
    }
  }

  protected formatRemainingDays(doctor: DoctorListItem): string {
    if (doctor.subscriptionStatus === 'admin') {
      return this.i18n.t('medecins.list.remaining.permanent');
    }

    if (doctor.subscriptionStatus === 'deleted') {
      return '-';
    }

    if (doctor.subscriptionDaysRemaining === null || doctor.subscriptionDaysRemaining === undefined) {
      return '-';
    }

    return `${doctor.subscriptionDaysRemaining}`;
  }

  protected canSuspend(doctor: DoctorListItem): boolean {
    if (doctor.subscriptionStatus === 'suspended' || doctor.subscriptionStatus === 'deleted') {
      return false;
    }

    if (doctor.isSuperAdmin || this.isCurrentUser(doctor)) {
      return false;
    }

    return true;
  }

  protected canReactivate(doctor: DoctorListItem): boolean {
    if (doctor.subscriptionStatus !== 'suspended' && doctor.subscriptionStatus !== 'deleted') {
      return false;
    }

    if (doctor.isSuperAdmin || this.isCurrentUser(doctor)) {
      return false;
    }

    return true;
  }

  protected canToggleRole(doctor: DoctorListItem): boolean {
    if (doctor.subscriptionStatus === 'deleted') {
      return false;
    }

    return !doctor.isSuperAdmin && !this.isCurrentUser(doctor);
  }

  protected canDeleteDoctor(doctor: DoctorListItem): boolean {
    if (doctor.subscriptionStatus === 'deleted') {
      return false;
    }

    if (doctor.isSuperAdmin || this.isCurrentUser(doctor)) {
      return false;
    }

    if (doctor.role === 'admin' && !this.auth.hasAnyRole(['super_admin'])) {
      return false;
    }

    return true;
  }

  protected isActionInProgress(doctorId: string): boolean {
    return this.processingDoctorId() === doctorId;
  }

  protected openDoctorDetails(doctor: DoctorListItem): void {
    this.router.navigate(['/medecins', doctor.id]);
  }

  protected getDoctorAvatarUrl(doctor: DoctorListItem): string | null {
    if (this.brokenAvatarDoctorIds().has(doctor.id)) {
      return null;
    }

    const rawUrl = doctor.profilePictureUrl?.trim();
    if (!rawUrl) {
      return null;
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }

    if (rawUrl.startsWith('/')) {
      return `${environment.apiUrl}${rawUrl}`;
    }

    return `${environment.apiUrl}/${rawUrl}`;
  }

  protected getDoctorInitials(doctor: DoctorListItem): string {
    const firstInitial = doctor.firstName?.trim().charAt(0) ?? '';
    const lastInitial = doctor.lastName?.trim().charAt(0) ?? '';
    const initials = `${firstInitial}${lastInitial}`.toUpperCase();
    return initials || 'DR';
  }

  protected onDoctorAvatarError(doctorId: string, event: Event): void {
    event.stopPropagation();
    this.brokenAvatarDoctorIds.update((current) => {
      if (current.has(doctorId)) {
        return current;
      }

      const next = new Set(current);
      next.add(doctorId);
      return next;
    });
  }

  protected suspendDoctor(doctor: DoctorListItem, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.canSuspend(doctor) || this.processingDoctorId()) {
      return;
    }

    if (!window.confirm(this.i18n.t('medecins.list.actions.suspendConfirm'))) {
      return;
    }

    this.processingDoctorId.set(doctor.id);
    this.adminService
      .suspendDoctor(doctor.id)
      .pipe(
        finalize(() => {
          this.processingDoctorId.set(null);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('medecins.list.actions.suspendSuccess'));
          this.refreshTabCounts();
          this.loadDoctors();
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.list.actions.suspendError'));
        },
      });
  }

  protected async reactivateDoctor(doctor: DoctorListItem, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();

    if (!this.canReactivate(doctor) || this.processingDoctorId()) {
      return;
    }

    if (!window.confirm(this.i18n.t('medecins.list.actions.reactivateConfirm'))) {
      return;
    }

    let durationInMonths: number | undefined;
    if (doctor.role === 'doctor') {
      const durationInYears = await this.askSubscriptionDuration();
      durationInMonths = durationInYears ? durationInYears * 12 : undefined;
      if (!durationInMonths) {
        return;
      }
    }

    this.processingDoctorId.set(doctor.id);
    this.adminService
      .reactivateDoctor(doctor.id, durationInMonths)
      .pipe(
        finalize(() => {
          this.processingDoctorId.set(null);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('medecins.list.actions.reactivateSuccess'));
          this.refreshTabCounts();
          this.loadDoctors();
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.list.actions.reactivateError'));
        },
      });
  }

  protected async toggleRole(doctor: DoctorListItem, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();

    if (!this.canToggleRole(doctor) || this.processingDoctorId()) {
      return;
    }

    const nextRole: IssuableDoctorRole = doctor.role === 'doctor' ? 'admin' : 'doctor';
    const confirmMessage =
      nextRole === 'admin'
        ? this.i18n.t('medecins.list.actions.makeAdminConfirm')
        : this.i18n.t('medecins.list.actions.makeDoctorConfirm');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    let durationInMonths: number | undefined;
    if (nextRole === 'doctor') {
      const durationInYears = await this.askSubscriptionDuration();
      durationInMonths = durationInYears ? durationInYears * 12 : undefined;
      if (!durationInMonths) {
        return;
      }
    }

    this.processingDoctorId.set(doctor.id);
    this.adminService
      .changeDoctorRole(doctor.id, {
        role: nextRole,
        subscriptionDurationInMonths: durationInMonths,
      })
      .pipe(
        finalize(() => {
          this.processingDoctorId.set(null);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('medecins.list.actions.roleChangeSuccess'));
          this.refreshTabCounts();
          this.loadDoctors();
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.list.actions.roleChangeError'));
        },
      });
  }

  protected deleteDoctor(doctor: DoctorListItem, event?: MouseEvent): void {
    event?.stopPropagation();

    if (!this.canDeleteDoctor(doctor) || this.processingDoctorId()) {
      return;
    }

    if (!window.confirm(this.i18n.t('medecins.list.actions.deleteDoctorConfirm'))) {
      return;
    }

    this.processingDoctorId.set(doctor.id);
    this.adminService
      .deleteDoctor(doctor.id)
      .pipe(
        finalize(() => {
          this.processingDoctorId.set(null);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.t('medecins.list.actions.deleteDoctorSuccess'));
          this.refreshTabCounts();
          this.loadDoctors();
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.list.actions.deleteDoctorError'));
        },
      });
  }

  private isCurrentUser(doctor: DoctorListItem): boolean {
    const currentUser = this.userContext.get();
    return !!currentUser?.userId && currentUser.userId === doctor.cabinetIdentityId;
  }

  protected pickDurationPreset(years: number): void {
    this.durationYearsInput.set(years);
  }

  protected confirmDurationSelection(): void {
    const years = Number(this.durationYearsInput());
    if (!Number.isInteger(years) || years < 1 || years > 5) {
      this.toast.error(this.i18n.t('medecins.list.actions.durationInvalid'));
      return;
    }

    const resolver = this.durationModalResolver;
    this.durationModalResolver = null;
    this.isDurationModalOpen.set(false);
    resolver?.(years);
  }

  protected cancelDurationSelection(): void {
    const resolver = this.durationModalResolver;
    this.durationModalResolver = null;
    this.isDurationModalOpen.set(false);
    resolver?.(undefined);
  }

  private askSubscriptionDuration(): Promise<number | undefined> {
    if (this.durationModalResolver) {
      this.durationModalResolver(undefined);
    }

    this.durationYearsInput.set(1);
    this.isDurationModalOpen.set(true);

    return new Promise<number | undefined>((resolve) => {
      this.durationModalResolver = resolve;
    });
  }

  private loadDoctors(): void {
    this.isLoadingList.set(true);

    const query: ListDoctorsQuery = {
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      searchQuery: this.searchQuery.trim() || undefined,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };

    switch (this.selectedMainTab) {
      case 'admins':
        query.roleFilter = 'admin';
        break;
      case 'suspended':
        query.roleFilter = 'doctor';
        query.statusFilter = 'suspended';
        break;
      case 'deleted':
        query.roleFilter = 'doctor';
        query.statusFilter = 'deleted';
        break;
      default:
        query.roleFilter = 'doctor';
        query.statusFilter = 'not_suspended';
        break;
    }

    this.adminService
      .getDoctors(query)
      .pipe(
        finalize(() => {
          this.isLoadingList.set(false);
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.doctors = response.doctors;
          this.totalCount = response.totalCount;
          this.cdr.detectChanges();

          if (this.pageNumber > this.totalPages) {
            this.pageNumber = this.totalPages;
            this.loadDoctors();
          }
        },
        error: () => {
          this.toast.error(this.i18n.t('medecins.list.loadError'));
          this.doctors = [];
          this.totalCount = 0;
          this.cdr.detectChanges();
        },
      });
  }

  private refreshTabCounts(): void {
    forkJoin({
      doctors: this.adminService.getDoctors({
        pageNumber: 1,
        pageSize: 1,
        roleFilter: 'doctor',
        statusFilter: 'not_suspended',
      }),
      suspended: this.adminService.getDoctors({
        pageNumber: 1,
        pageSize: 1,
        roleFilter: 'doctor',
        statusFilter: 'suspended',
      }),
      admins: this.adminService.getDoctors({
        pageNumber: 1,
        pageSize: 1,
        roleFilter: 'admin',
      }),
      deleted: this.adminService.getDoctors({
        pageNumber: 1,
        pageSize: 1,
        roleFilter: 'doctor',
        statusFilter: 'deleted',
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.tabCounts = {
            doctors: response.doctors.totalCount,
            suspended: response.suspended.totalCount,
            admins: response.admins.totalCount,
            deleted: response.deleted.totalCount,
          };
          this.cdr.detectChanges();
        },
        error: () => {
          this.tabCounts = {
            doctors: 0,
            suspended: 0,
            admins: 0,
            deleted: 0,
          };
          this.cdr.detectChanges();
        },
      });
  }
}
