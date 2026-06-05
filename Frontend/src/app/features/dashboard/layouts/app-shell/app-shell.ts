import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { DoctorService } from '../../../../core/services/doctor.service';
import { DoctorProfile } from '../../../../core/models/doctor.models';
import { I18nService } from '../../../../core/services/i18n.service';
import { Lang } from '../../../../core/models/i18n.models';
import { InterrogatoireService } from '../../../../core/services/interrogatoire.service';
import { Footer } from '../../../../shared/components/footer/footer';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { environment } from '../../../../../environments/environment';
import { InternalMessagingComponent } from '../../components/internal-messaging/internal-messaging.component';
import { AiChatComponent } from '../../components/ai-chat/ai-chat.component';
import { SuggestionService } from '../../../../core/services/suggestion.service';
import { SuggestionRealtimeService } from '../../../../core/services/suggestion-realtime.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TechAssistanceService } from '../../../../core/services/tech-assistance.service';
import { TechAssistanceRealtimeService } from '../../../../core/services/tech-assistance-realtime.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    Footer,
    TranslatePipe,
    InternalMessagingComponent,
    AiChatComponent,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell implements OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly userContext = inject(UserContextService);
  private readonly doctorService = inject(DoctorService);
  private readonly i18n = inject(I18nService);
  private readonly interrogatoireService = inject(InterrogatoireService);
  private readonly suggestionService = inject(SuggestionService);
  private readonly suggestionRealtime = inject(SuggestionRealtimeService);
  private readonly techAssistanceService = inject(TechAssistanceService);
  private readonly techAssistanceRealtime = inject(TechAssistanceRealtimeService);
  private readonly toast = inject(ToastService);
  private readonly subscriptions = new Subscription();

  protected readonly dropdownOpen = signal(false);
  protected readonly doctor = signal<DoctorProfile | null>(null);
  protected readonly currentLabelKey = signal('nav.home');
  protected readonly currentUrl = signal(this.router.url);
  protected readonly roleLabel = signal('Medecin');
  protected readonly isAccueil = signal(true);
  protected readonly currentDate = signal(new Date());
  protected readonly activeConsultationId = signal('');
  protected readonly activePatientId = signal('');
  protected readonly suggestionUnreadCount = signal(0);
  protected readonly techAssistanceUnreadCount = signal(0);
  protected readonly languages = this.i18n.languages;
  private consultationContextRequestId = 0;

  protected readonly displayName = computed(() => {
    const value = this.doctor();
    if (!value) {
      return 'Utilisateur';
    }
    return `Dr ${value.firstName} ${value.lastName}`;
  });

  protected readonly initials = computed(() => {
    const value = this.doctor();
    if (!value) {
      return 'DR';
    }
    return `${value.firstName.charAt(0)}${value.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly avatarImageUrl = computed(() => {
    const profilePictureUrl = this.doctor()?.profilePictureUrl;
    if (!profilePictureUrl) {
      return null;
    }

    if (profilePictureUrl.startsWith('http://') || profilePictureUrl.startsWith('https://')) {
      return profilePictureUrl;
    }

    if (profilePictureUrl.startsWith('/')) {
      return `${environment.apiUrl}${profilePictureUrl}`;
    }

    return `${environment.apiUrl}/${profilePictureUrl}`;
  });

  protected readonly isArabicLanguage = computed(() => this.i18n.lang() === 'ar');
  protected readonly selfCheckinLink = computed(() => {
    const profile = this.doctor();
    const doctorId = profile?.doctorId || profile?.id;
    const kioskKey = profile?.selfCheckinKey;
    const base = typeof window !== 'undefined' ? window.location.origin : '';

    if (!doctorId || !kioskKey || !base) {
      return '';
    }

    return `${base}/self-checkin/${encodeURIComponent(doctorId)}/${encodeURIComponent(kioskKey)}`;
  });
  protected readonly canAccessProfile = computed(() =>
    this.auth.hasAnyRole(['doctor', 'admin', 'super_admin']),
  );
  protected readonly canAccessMedecins = computed(() =>
    this.auth.hasAnyRole(['admin', 'super_admin']),
  );
  protected readonly shouldShowInternalMessaging = computed(() => {
    const url = this.currentUrl().split('?')[0];
    return (
      url === '/accueil' ||
      url.startsWith('/calendar') ||
      url === '/patients' ||
      url.startsWith('/patients/') ||
      url.startsWith('/consultations/')
    );
  });
  protected readonly actualiteDuJour = computed(
    () => {
      const personalization = this.doctor()?.personalization;
      const fallback = this.pickNonEmpty(
        personalization?.dailyNewsFr,
        personalization?.dailyNews,
        '',
      );
      const lang = this.i18n.lang();
      if (!personalization) {
        return fallback;
      }

      if (lang === 'en') {
        return this.pickNonEmpty(personalization.dailyNewsEn, fallback, '');
      }

      if (lang === 'ar') {
        return this.pickNonEmpty(personalization.dailyNewsAr, fallback, '');
      }

      return this.pickNonEmpty(personalization.dailyNewsFr, fallback, '');
    },
  );

  constructor() {
    this.loadDoctor();
    this.bootstrapSuggestionRealtime();
    this.bootstrapTechAssistanceRealtime();

    this.subscriptions.add(
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
        this.syncBreadcrumb();
        this.syncConsultationContext();
      }),
    );

    this.syncBreadcrumb();
    this.syncConsultationContext();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected toggleDropdown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropdownOpen.update((value) => !value);
  }

  protected selectLanguage(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  protected isLanguageActive(lang: Lang): boolean {
    return this.i18n.lang() === lang;
  }

  protected closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    this.userContext.clear();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (!target.closest('.profile-dropdown') && this.dropdownOpen()) {
      this.dropdownOpen.set(false);
    }

  }

  @HostListener('window:profile-updated')
  onProfileUpdated(): void {
    this.loadDoctor();
  }

  private loadDoctor(): void {
    const context = this.userContext.get();
    if (!context?.doctorId) {
      this.logout();
      return;
    }

    this.doctorService.getById(context.doctorId).subscribe({
      next: (doctor) => this.doctor.set(doctor),
      error: () => this.logout(),
    });
  }

  private syncBreadcrumb(): void {
    const url = this.router.url;
    this.currentUrl.set(url);
    this.isAccueil.set(url.includes('/accueil'));

    if (url.includes('/patients/new')) {
      this.currentLabelKey.set('patients.create.title');
      return;
    }

    if (url.includes('/patients/')) {
      this.currentLabelKey.set('patients.details.title');
      return;
    }

    if (url.includes('/patients')) {
      this.currentLabelKey.set('nav.patients');
      return;
    }

    if (url.includes('/statistics')) {
      this.currentLabelKey.set('nav.statistics');
      return;
    }

    if (url.includes('/profile')) {
      this.currentLabelKey.set('nav.profile');
      return;
    }

    if (url.includes('/medecins')) {
      this.currentLabelKey.set('nav.medecins');
      return;
    }

    if (url.includes('/suggestions')) {
      this.currentLabelKey.set('nav.suggestions');
      return;
    }

    if (url.includes('/tech-assistance')) {
      this.currentLabelKey.set('nav.techAssistance');
      return;
    }

    if (url.includes('/calendar')) {
      this.currentLabelKey.set('Agenda');
      return;
    }

    this.currentLabelKey.set('nav.home');
  }

  private syncConsultationContext(): void {
    const consultationId = this.extractConsultationId(this.router.url);
    const requestId = ++this.consultationContextRequestId;

    if (!consultationId) {
      this.activeConsultationId.set('');
      this.activePatientId.set('');
      return;
    }

    if (this.activeConsultationId() !== consultationId) {
      this.activeConsultationId.set(consultationId);
      this.activePatientId.set('');
    }

    this.interrogatoireService.getConsultationInterrogatoire(consultationId).subscribe({
      next: (consultation) => {
        if (requestId !== this.consultationContextRequestId) {
          return;
        }

        this.activeConsultationId.set(consultation.consultationId || consultationId);
        this.activePatientId.set(consultation.patientId || '');
      },
      error: () => {
        if (requestId !== this.consultationContextRequestId) {
          return;
        }

        this.activePatientId.set('');
      },
    });
  }

  private extractConsultationId(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    const match = path.match(/^\/consultations\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }

  private pickNonEmpty(
    preferred: string | null | undefined,
    fallback?: string | null,
    defaultValue = '',
  ): string {
    const preferredValue = preferred?.trim() ?? '';
    if (preferredValue.length > 0) {
      return preferredValue;
    }

    const fallbackValue = fallback?.trim() ?? '';
    if (fallbackValue.length > 0) {
      return fallbackValue;
    }

    return defaultValue;
  }

  private bootstrapSuggestionRealtime(): void {
    if (!this.auth.hasAnyRole(['doctor', 'admin', 'super_admin'])) {
      return;
    }

    this.suggestionService.getUnreadCount().subscribe({
      next: (response) => this.suggestionUnreadCount.set(response.count ?? 0),
      error: () => this.suggestionUnreadCount.set(0),
    });

    void this.suggestionRealtime.connect();

    this.subscriptions.add(
      this.suggestionRealtime.unreadCountChanged$.subscribe((event) => {
        this.suggestionUnreadCount.set(event.count ?? 0);
      }),
    );

    this.subscriptions.add(
      this.suggestionRealtime.suggestionCreated$.subscribe(() => {
        if (this.auth.hasAnyRole(['admin', 'super_admin']) && !this.currentUrl().startsWith('/suggestions')) {
          this.toast.info(this.i18n.t('suggestions.toast.new'));
        }
      }),
    );

    this.subscriptions.add(
      this.suggestionRealtime.suggestionReplied$.subscribe(() => {
        if (!this.auth.hasAnyRole(['admin', 'super_admin']) && !this.currentUrl().startsWith('/suggestions')) {
          this.suggestionService.getUnreadCount().subscribe({
            next: (response) => this.suggestionUnreadCount.set(response.count ?? 0),
          });
          this.toast.info(this.i18n.t('suggestions.toast.reply'));
        }
      }),
    );
  }

  private bootstrapTechAssistanceRealtime(): void {
    if (!this.auth.hasAnyRole(['doctor', 'admin', 'super_admin'])) {
      return;
    }

    this.techAssistanceService.getUnreadCount().subscribe({
      next: (response) => this.techAssistanceUnreadCount.set(response.count ?? 0),
      error: () => this.techAssistanceUnreadCount.set(0),
    });

    void this.techAssistanceRealtime.connect();

    this.subscriptions.add(
      this.techAssistanceRealtime.unreadCountChanged$.subscribe((event) => {
        this.techAssistanceUnreadCount.set(event.count ?? 0);
      }),
    );

    this.subscriptions.add(
      this.techAssistanceRealtime.ticketCreated$.subscribe(() => {
        if (
          this.auth.hasAnyRole(['admin', 'super_admin']) &&
          !this.currentUrl().startsWith('/tech-assistance')
        ) {
          this.toast.info(this.i18n.t('techAssist.toast.new'));
        }
      }),
    );

    this.subscriptions.add(
      this.techAssistanceRealtime.ticketUpdated$.subscribe(() => {
        if (!this.currentUrl().startsWith('/tech-assistance')) {
          this.techAssistanceService.getUnreadCount().subscribe({
            next: (response) => this.techAssistanceUnreadCount.set(response.count ?? 0),
          });
        }
      }),
    );
  }
}
