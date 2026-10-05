import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthApiService } from '@hospital-services/api-client';
import { catchError, map, of } from 'rxjs';

/**
 * Protects routes requiring an authenticated session.
 * Checks signal state first, or verifies active session with backend via HTTP-Only cookie.
 */
export const authGuard: CanActivateFn = () => {
  const authApi = inject(AuthApiService);
  const router = inject(Router);

  if (authApi.isAuthenticated()) {
    return true;
  }

  return authApi.fetchCurrentUser().pipe(
    map((res) => {
      if (res?.user) {
        return true;
      }
      return router.createUrlTree(['/auth/login']);
    }),
    catchError(() => {
      return of(router.createUrlTree(['/auth/login']));
    })
  );
};

/**
 * Prevents authenticated users from accessing guest-only routes (like /auth/login).
 * Redirects logged-in users to /dashboard.
 */
export const guestGuard: CanActivateFn = () => {
  const authApi = inject(AuthApiService);
  const router = inject(Router);

  if (authApi.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return authApi.fetchCurrentUser().pipe(
    map((res) => {
      if (res?.user) {
        return router.createUrlTree(['/dashboard']);
      }
      return true;
    }),
    catchError(() => {
      return of(true);
    })
  );
};
