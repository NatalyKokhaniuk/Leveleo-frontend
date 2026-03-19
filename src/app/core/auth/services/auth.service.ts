import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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

  currentUser = this._currentUser.asReadonly();
  accessToken = this._accessToken.asReadonly();
  isAuthenticated = this._isAuthenticated.asReadonly();
  isRestoring = this._isRestoring.asReadonly();

  isAdmin = computed(() => this.currentUser()?.roles.includes('Admin') ?? false);

  // ─── Відновлення сесії ───────────────────────────────────────────
  // Повертає Observable — використовується в APP_INITIALIZER щоб
  // Angular чекав завершення перед першим рендером.
  restoreSession(): Observable<RefreshResponse | null> {
    console.log('restoreSession');

    return this.refreshToken().pipe(
      tap((res) => {
        this._currentUser.set(res.user);
        console.log(res.user);
        this._accessToken.set(res.accessToken);
        this._isAuthenticated.set(true);
        this._isRestoring.set(false);
      }),
      catchError(() => {
        this._clearAuthState();
        this._isRestoring.set(false);
        return of(null); // не кидаємо помилку — це нормальна ситуація (не залогінений)
      }),
    );
  }

  // ─── Основні методи автентифікації ───────────────────────────────

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', credentials).pipe(
      tap((res) => this.handleSuccessfulAuth(res)),
      catchError((err) => {
        if (err.status === 400 && err.error?.status === '2FA_REQUIRED') {
          return of(err.error as AuthResponse);
        }
        return throwError(() => err);
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

  refreshToken(): Observable<RefreshResponse> {
    return this.api.post<RefreshResponse>('/auth/refresh-token', {});
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
