import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { authGuardDoctor } from './core/guards/auth-guard-doctor.guard';
import { authGuardAdmin } from './core/guards/auth-guard-admin.guard';
import { authGuardAutoPassword } from './core/guards/auth-guard-auto-password.guard';

export const routes: Routes = [
  {
    path: 'self-checkin/:doctorId/:kioskKey',
    loadComponent: () =>
      import('./features/auth/pages/self-checkin-page/self-checkin-page').then(
        (m) => m.SelfCheckinPage,
      ),
  },
  {
    path: 'consultations/:consultationId/print/conclusion',
    canActivate: [authGuard],
    loadComponent: () =>
      import(
        './features/dashboard/pages/consultation-interrogatoire-page/consultation-conclusion-print-page'
      ).then((m) => m.ConsultationConclusionPrintPage),
  },
  {
    path: 'salle-attente',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/pages/salle-attente-page/salle-attente-page').then(
        (m) => m.SalleAttentePage,
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password-page/reset-password-page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
  {
    path: 'tech-assistance/review/:ticketId',
    loadComponent: () =>
      import('./features/auth/pages/tech-assistance-review-page/tech-assistance-review-page').then(
        (m) => m.TechAssistanceReviewPage,
      ),
  },
  {
    path: 'select-profile',
    loadComponent: () =>
      import('./features/auth/pages/select-profile-page/select-profile-page').then(
        (m) => m.SelectProfilePage,
      ),
  },
  {
    path: 'first-login/change-password',
    canActivate: [authGuardAutoPassword],
    loadComponent: () =>
      import('./features/auth/pages/change-auto-password-page/change-auto-password-page').then(
        (m) => m.ChangeAutoPasswordPage,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/layouts/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        redirectTo: 'accueil',
        pathMatch: 'full',
      },
      {
        path: 'accueil',
        loadComponent: () =>
          import('./features/dashboard/pages/accueil-page/accueil-page').then(
            (m) => m.AccueilPage,
          ),
      },
      {
        path: 'statistics',
        loadComponent: () =>
          import('./features/dashboard/pages/statistics-page/statistics-page').then(
            (m) => m.StatisticsPage,
          ),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/dashboard/pages/calendar-page/calendar-page').then(
            (m) => m.CalendarPage,
          ),
      },
      {
        path: 'sketchfab-test',
        loadComponent: () =>
          import('./features/dashboard/pages/sketchfab-test-page/sketchfab-test-page').then(
            (m) => m.SketchfabTestPage,
          ),
      },
      {
        path: 'suggestions',
        canActivate: [authGuardDoctor],
        loadComponent: () =>
          import('./features/dashboard/pages/suggestions-page/suggestions-page').then(
            (m) => m.SuggestionsPage,
          ),
      },
      {
        path: 'tech-assistance',
        canActivate: [authGuardDoctor],
        loadComponent: () =>
          import('./features/dashboard/pages/tech-assistance-page/tech-assistance-page').then(
            (m) => m.TechAssistancePage,
          ),
      },
      {
        path: 'profile',
        canActivate: [authGuardDoctor],
        loadComponent: () =>
          import('./features/dashboard/pages/profile-page/profile-page').then(
            (m) => m.ProfilePage,
          ),
      },
      {
        path: 'patients/new',
        loadComponent: () =>
          import('./features/dashboard/pages/patient-create-page/patient-create-page').then(
            (m) => m.PatientCreatePage,
          ),
      },
      {
        path: 'patients/:id',
        loadComponent: () =>
          import('./features/dashboard/pages/patient-details-page/patient-details-page').then(
            (m) => m.PatientDetailsPage,
          ),
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/dashboard/pages/patients-page/patients-page').then(
            (m) => m.PatientsPage,
          ),
      },
      {
        path: 'consultations/:consultationId/print/:documentType',
        loadComponent: () =>
          import(
            './features/dashboard/pages/consultation-interrogatoire-page/consultation-print-page'
          ).then((m) => m.ConsultationPrintPage),
      },
      {
        path: 'consultations/:consultationId',
        loadComponent: () =>
          import(
            './features/dashboard/pages/consultation-interrogatoire-page/consultation-interrogatoire-page'
          ).then((m) => m.ConsultationInterrogatoirePage),
      },
      {
        path: 'medecins',
        canActivate: [authGuardAdmin],
        loadComponent: () =>
          import('./features/dashboard/pages/medecins-page/medecins-page').then(
            (m) => m.MedecinsPage,
          ),
      },
      {
        path: 'medecins/new',
        canActivate: [authGuardAdmin],
        loadComponent: () =>
          import('./features/dashboard/pages/medecins-create-page/medecins-create-page').then(
            (m) => m.MedecinsCreatePage,
          ),
      },
      {
        path: 'medecins/:id',
        canActivate: [authGuardAdmin],
        loadComponent: () =>
          import('./features/dashboard/pages/medecins-details-page/medecins-details-page').then(
            (m) => m.MedecinsDetailsPage,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
