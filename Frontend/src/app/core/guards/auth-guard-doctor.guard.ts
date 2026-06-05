import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuardDoctor: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  if (auth.hasAnyRole(['doctor', 'admin', 'super_admin'])) {
    return true;
  }

  return router.createUrlTree(['/accueil']);
};
