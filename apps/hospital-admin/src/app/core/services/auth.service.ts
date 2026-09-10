import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { BaseService } from './base.service';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: UserProfile;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService extends BaseService {
  private tokenService = inject(TokenService);

  // Reactive state management using Angular Signals
  currentUser = signal<UserProfile | null>(null);
  isAuthenticated = computed(() => !!this.currentUser() || this.tokenService.hasToken());

  constructor() {
    super();
    // Restore session on app load if token exists
    if (this.tokenService.hasToken()) {
      this.fetchCurrentUser().subscribe();
    }
  }

  /**
   * Authenticates user against API endpoint /auth/login
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.post<AuthResponse>('/auth/login', credentials).pipe(
      tap((res) => {
        this.tokenService.setToken(res.accessToken);
        if (res.refreshToken) {
          this.tokenService.setRefreshToken(res.refreshToken);
        }
        this.currentUser.set(res.user);
      })
    );
  }

  /**
   * Fetches profile of current authenticated user
   */
  fetchCurrentUser(): Observable<UserProfile> {
    return this.get<UserProfile>('/auth/me').pipe(
      tap((user) => this.currentUser.set(user)),
      catchError((err) => {
        this.tokenService.clearTokens();
        this.currentUser.set(null);
        return throwError(() => err);
      })
    );
  }

  /**
   * Logs out user and clears stored tokens
   */
  logout(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
  }
}
