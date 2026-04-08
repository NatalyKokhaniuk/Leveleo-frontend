import { isPlatformBrowser } from '@angular/common';
import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import {
  AuthResponse,
  BackupCodesResponse,
  ChangePasswordRequest,
  ConfirmPasswordResetRequest,
  LoginRequest,
  LoginWithBackupCodeRequest,
  RefreshResponse,
  RegisterRequest,
  RequestPasswordResetRequest,
  ResendConfirmationRequest,
  SocialLoginRequest,
  SocialRedirectResponse,
  TempTokenExchangeRequest,
  TwoFactorConfirmSetupRequest,
  TwoFactorConfirmSetupResponse,
  TwoFactorDisableResponse,
  TwoFactorInitiateRequest,
  TwoFactorInitiateResponse,
  TwoFactorVerifyRequest,
  UserResponse,
} from '../models/auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private ngZone = inject(NgZone);
  private _currentUser = signal<UserResponse | null>(null);
  private _accessToken = signal<string | null>(null);
  private _isAuthenticated = signal<boolean>(false);
  // true поки йде перевірка refresh-token при старті — компоненти можуть
  // показати skeleton/spinner замість "моргання" між станами
  private _isRestoring = signal<boolean>(true);
  private isRefreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);
  currentUser = this._currentUser.asReadonly();
  accessToken = this._accessToken.asReadonly();
  isAuthenticated = this._isAuthenticated.asReadonly();
  isRestoring = this._isRestoring.asReadonly();
  platformId = inject(PLATFORM_ID);
  private hasRoleInsensitive(role: string): boolean {
    const user = this.currentUser();
    if (!user?.roles?.length) return false;
    const target = role.trim().toLowerCase();
    return user.roles.some((r) => String(r).trim().toLowerCase() === target);
  }

  isAdmin = computed(() => this.hasRoleInsensitive('Admin'));
  isRestoring$ = toObservable(this._isRestoring);
  // ADD BELOW isAdmin

  hasRole(role: string): boolean {
    return this.hasRoleInsensitive(role);
  }

  hasAnyRole(roles: string[]): boolean {
    if (!roles.length) return false;
    return roles.some((r) => this.hasRoleInsensitive(r));
  }

  isModerator = computed(() => this.hasRoleInsensitive('Moderator'));
  // ─── Відновлення сесії ───────────────────────────────────────────
  // Повертає Observable — використовується в APP_INITIALIZER щоб
  // Angular чекав завершення перед першим рендером.
  // В AuthService
  restoreSession(): Observable<RefreshResponse | null> {
    if (!isPlatformBrowser(this.platformId)) {
      this._isRestoring.set(false);
      return of(null);
    }

    console.log('🔄 restoreSession started');

    this._isRestoring.set(true);

    return this.refreshToken().pipe(
      tap((res) => {
        console.log('✅ restoreSession SUCCESS', res);
        this._currentUser.set(res.user);
        this._accessToken.set(res.accessToken);
        this._isAuthenticated.set(true);
      }),
      catchError((err) => {
        console.error('❌ restoreSession FAILED', err);
        this._clearAuthState();
        return of(null);
      }),
      finalize(() => {
        this._isRestoring.set(false);
        console.log('🔄 restoreSession finished, isRestoring = false');
      }),
    );
  }
  // ─── Основні методи автентифікації ───────────────────────────────

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', credentials).pipe(
      tap((res) => {
        if (!res.twoFaToken) {
          this.handleSuccessfulAuth(res);
        }
      }),
    );
  }

  verifyTwoFactor(req: TwoFactorVerifyRequest): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/2fa/verify', req)
      .pipe(tap((res) => this.handleSuccessfulAuth(res)));
  }

  register(data: RegisterRequest): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/register', data);
  }

  resendConfirmation(data: ResendConfirmationRequest): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/resend-confirmation', data);
  }
  private refresh$?: Observable<RefreshResponse>;

  /**
   * Оновлення access token за HttpOnly refresh cookie (`withCredentials: true`).
   * Новий refresh (ротація) приходить у Set-Cookie у відповіді — браузер зберігає сам;
   * JavaScript не читає HttpOnly cookies, окремо «зберігати» нічого не потрібно.
   */
  refreshToken(): Observable<RefreshResponse> {
    if (!this.refresh$) {
      console.log('🔄 refreshToken() START');

      this.refresh$ = this.api.post<RefreshResponse>('/auth/refresh-token', {}).pipe(
        tap((res) => {
          console.log('✅ refreshToken SUCCESS', {
            accessToken: res.accessToken ? 'present' : 'MISSING',
            user: res.user?.email || 'no user',
          });

          this._accessToken.set(res.accessToken);
          this._currentUser.set(res.user);
          this._isAuthenticated.set(true);
        }),

        catchError((err) => {
          console.error('❌ refreshToken FAILED', err.error || err);
          this._clearAuthState();
          return throwError(() => err);
        }),

        finalize(() => {
          console.log('♻️ refreshToken RESET');
          this.refresh$ = undefined;
          // _isRestoring керує лише restoreSession(), не кожним refresh з інтерсептора
        }),

        shareReplay(1),
      );
    }

    return this.refresh$;
  }

  logout(): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/logout', {}).pipe(
      tap(() => this._clearAuthState()),
      catchError(() => {
        this._clearAuthState();
        return of({ message: 'LOGGED_OUT' });
      }),
    );
  }

  logoutAll(): Observable<any> {
    return this.api.post('/auth/logout/all', {}).pipe(tap(() => this._clearAuthState()));
  }

  // ─── 2FA ─────────────────────────────────────────────────────────

  initiateTwoFactor(req: TwoFactorInitiateRequest): Observable<TwoFactorInitiateResponse> {
    return this.api.post<TwoFactorInitiateResponse>('/auth/2fa/initiate', req);
  }

  confirmTwoFactorSetup(
    req: TwoFactorConfirmSetupRequest,
  ): Observable<TwoFactorConfirmSetupResponse> {
    return this.api.post<TwoFactorConfirmSetupResponse>('/auth/2fa/confirm', req);
  }

  disableTwoFactor(): Observable<TwoFactorDisableResponse> {
    return this.api.post<TwoFactorDisableResponse>('/auth/2fa/disable', {});
  }

  getBackupCodes(): Observable<BackupCodesResponse> {
    return this.api.get<BackupCodesResponse>('/auth/2fa/backup-codes');
  }

  loginWithBackupCode(req: LoginWithBackupCodeRequest): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/2fa/backup-login', req)
      .pipe(tap((res) => this.handleSuccessfulAuth(res)));
  }

  // ─── Password ────────────────────────────────────────────────────

  requestPasswordReset(req: RequestPasswordResetRequest): Observable<void> {
    return this.api.post<void>('/auth/password-reset/request', req);
  }

  confirmPasswordReset(req: ConfirmPasswordResetRequest): Observable<void> {
    return this.api.post<void>('/auth/password-reset/confirm', req);
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    return this.api.post<void>('/auth/password/change', req);
  }

  // ─── Account ─────────────────────────────────────────────────────

  deleteAccount(): Observable<{ message: string }> {
    return this.api
      .delete<{ message: string }>('/auth/delete-account')
      .pipe(tap(() => this._clearAuthState()));
  }

  // ─── Social ──────────────────────────────────────────────────────

  loginWithGoogle(req: SocialLoginRequest): Observable<SocialRedirectResponse> {
    return this.api.post<SocialRedirectResponse>('/auth/social/google', req);
  }

  loginWithFacebook(req: SocialLoginRequest): Observable<SocialRedirectResponse> {
    return this.api.post<SocialRedirectResponse>('/auth/social/facebook', req);
  }

  exchangeTempToken(req: TempTokenExchangeRequest): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/social/exchange', req)
      .pipe(tap((res) => this.handleSuccessfulAuth(res)));
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  /** Оновлює дані поточного користувача після редагування профілю */
  updateCurrentUser(user: UserResponse): void {
    this._currentUser.set(user);
  }
  private handleSuccessfulAuth(res: AuthResponse): void {
    this.ngZone.run(() => {
      if (res.user && res.accessToken) {
        this._currentUser.set(res.user);
        this._accessToken.set(res.accessToken);
        this._isAuthenticated.set(true);
      }
    });
  }

  private _clearAuthState(): void {
    this._currentUser.set(null);
    this._accessToken.set(null);
    this._isAuthenticated.set(false);
  }
}
