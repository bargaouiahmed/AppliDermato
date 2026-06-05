import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();
  const refreshToken = authService.getRefreshToken();
  const isSelfCheckinRequest = req.url.includes('/api/v0/self-checkin/');

  let cloned = req;

  if (token) {
    cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
      },
    });
  }

  return next(cloned).pipe(
    catchError((error) => {
      if (error?.status === 401 && token && !isSelfCheckinRequest) {
        authService.logout();
        router.navigate(['/login']);
      }

      if (error?.status === 400 && token && !isSelfCheckinRequest && isStaleSessionError(error)) {
        authService.logout();
        router.navigate(['/login']);
      }

      return throwError(() => error);
    }),
  );
};

function isStaleSessionError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes('cabinet identity not found') ||
    message.includes('identity not found') ||
    message.includes('claim not found in jwt')
  );
}

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('error' in error)) {
    return '';
  }

  const body = (error as { error?: unknown }).error;
  if (typeof body === 'string') {
    return body;
  }

  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  if (body && typeof body === 'object' && 'Message' in body) {
    const message = (body as { Message?: unknown }).Message;
    return typeof message === 'string' ? message : '';
  }

  return '';
}
