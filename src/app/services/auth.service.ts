import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  password_confirm: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  balance_xaf: number;
  is_verified: boolean;
  date_joined: string;
}

export interface AuthResponse {
  message: string;
  user: UserProfile;
  tokens: AuthTokens;
}

//  Token Keys

const ACCESS_KEY  = 'elite_access';
const REFRESH_KEY = 'elite_refresh';

//  Service 

@Injectable({ providedIn: 'root' })
export class AuthService {

  private api = environment.apiUrl;

  constructor(
    private http:          HttpClient,
    private router:        Router,
    private notifications: NotificationService,
  ) {}


  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/api/auth/register/`, payload)
      .pipe(tap(res => this.storeTokens(res.tokens)));
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/api/auth/login/`, payload)
      .pipe(tap(res => this.storeTokens(res.tokens)));
  }

  // Refresh — POST /api/auth/token/refresh/
  refreshAccessToken(): Observable<{ access: string }> {
    const refresh = this.getRefreshToken();
    return this.http.post<{ access: string }>(`${this.api}/api/auth/token/refresh/`, { refresh })
      .pipe(tap(res => localStorage.setItem(ACCESS_KEY, res.access)));
  }

  //  Password reset 
  requestPasswordReset(email: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(
      `${this.api}/api/auth/password-reset/request/`,
      { email },
    );
  }

  /** Step 2: submit the signed token + the new password. */
  confirmPasswordReset(
    token: string, new_password: string, confirm_password: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/api/auth/password-reset/confirm/`,
      { token, new_password, confirm_password },
    );
  }

  // ── Token helpers ─────────────────────────────────────────────────────────

  storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_KEY,  tokens.access);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  }

  getAccessToken():  string | null { return localStorage.getItem(ACCESS_KEY);  }
  getRefreshToken(): string | null { return localStorage.getItem(REFRESH_KEY); }
  isLoggedIn():      boolean       { return !!this.getAccessToken(); }

  getCurrentUserId(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id ?? null;
    } catch {
      return null;
    }
  }

  logout(): void {
    const refresh = this.getRefreshToken();

    // Best-effort: blacklist the refresh token on the server. We don't wait —
    // local cleanup and redirect happen immediately so the UI is responsive.
    if (refresh) {
      this.http.post(`${this.api}/api/auth/logout/`, { refresh }).subscribe({
        next: () => {},
        error: () => {},  // swallow — local logout still proceeds
      });
    }

    // Stop the notification poll and clear the shared list/count.
    this.notifications.stopPolling();

    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.router.navigate(['/login']);
  }
}
