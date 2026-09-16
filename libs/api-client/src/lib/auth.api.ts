import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiClientService } from './api-client.service';
import {
  AuthApiResponse,
  CompleteOnboardingCredentials,
  GoogleTokenCredentials,
  LoginCredentials,
  RegisterCredentials,
  SharedUser,
} from './models';

@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly api = inject(ApiClientService);

  // Angular Signals for Reactive User & Auth State across applications
  readonly currentUser = signal<SharedUser | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isProfileComplete = computed(
    () => this.currentUser()?.isProfileComplete ?? true,
  );
  readonly userRole = computed(() => this.currentUser()?.role || null);

  constructor() {
    // Attempt automatic session restore on application load via HTTP-Only cookie
    this.fetchCurrentUser().subscribe({
      error: () => this.currentUser.set(null),
    });
  }

  /**
   * Registers a new user account
   */
  register(credentials: RegisterCredentials): Observable<AuthApiResponse> {
    return this.api.post<AuthApiResponse>('/auth/register', credentials).pipe(
      tap((res) => {
        if (res?.user) {
          this.currentUser.set(res.user);
        }
      }),
    );
  }

  /**
   * Logins user and sets user signal state
   */
  login(credentials: LoginCredentials): Observable<AuthApiResponse> {
    return this.api.post<AuthApiResponse>('/auth/login', credentials).pipe(
      tap((res) => {
        if (res?.user) {
          this.currentUser.set(res.user);
        }
      }),
    );
  }

  /**
   * Initiates Google Passport OAuth redirect flow
   */
  loginWithGoogleRedirect(): void {
    const apiBaseUrl = this.api.getBaseUrl();
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  /**
   * Authenticates using Google ID Token (from Google Identity Services button)
   */
  loginWithGoogleToken(credentials: GoogleTokenCredentials): Observable<AuthApiResponse> {
    return this.api.post<AuthApiResponse>('/auth/google/token', credentials).pipe(
      tap((res) => {
        if (res?.user) {
          this.currentUser.set(res.user);
        }
      }),
    );
  }

  /**
   * Completes Progressive Profile Onboarding for users with missing details
   */
  completeOnboarding(
    credentials: CompleteOnboardingCredentials,
  ): Observable<AuthApiResponse> {
    return this.api.patch<AuthApiResponse>('/auth/progressive-onboarding', credentials).pipe(
      tap((res) => {
        if (res?.user) {
          this.currentUser.set(res.user);
        }
      }),
    );
  }

  /**
   * Fetches current authenticated user profile using HTTP-Only access_token cookie
   */
  fetchCurrentUser(): Observable<{ user: SharedUser }> {
    return this.api.get<{ user: SharedUser }>('/auth/me').pipe(
      tap((res) => {
        if (res?.user) {
          this.currentUser.set(res.user);
        }
      }),
      catchError((err) => {
        this.currentUser.set(null);
        return throwError(() => err);
      }),
    );
  }

  /**
   * Logs out user, invalidates session on server, clears state
   */
  logout(): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/logout').pipe(
      tap(() => {
        this.currentUser.set(null);
      }),
      catchError(() => {
        this.currentUser.set(null);
        return [{ message: 'Logged out' }];
      }),
    );
  }
}
