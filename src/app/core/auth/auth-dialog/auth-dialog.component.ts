import { UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon.component';
import { PasswordStrengthComponent } from '../../../shared/components/password-strength.component';
import { strongPasswordValidator } from '../../../shared/validators/password.validator';
import { EmailUnconfirmedDialogComponent } from '../email-unconfirmed-dialog/email-unconfirmed-dialog.component';
import { LoginRequest, RegisterRequest } from '../models/auth.types';
import { AuthService } from '../services/auth.service';
import { FacebookAuthService } from '../services/facebookAuthService';
import { GoogleAuthService } from '../services/googleAuthService';

export interface AuthDialogData {
  defaultTab?: 'login' | 'register';
}

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    IconComponent,
    UpperCasePipe,
    PasswordStrengthComponent,
  ],
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent {
  private auth = inject(AuthService);
  private google = inject(GoogleAuthService);
  private facebook = inject(FacebookAuthService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  dialogRef = inject(MatDialogRef<AuthDialogComponent>);
  private data = inject<AuthDialogData>(MAT_DIALOG_DATA, { optional: true });

  loginError = signal<string | null>(null);
  registerError = signal<string | null>(null);
  registerEmailExists = signal(false);
  registerSuccess = signal(false);
  isLoading = signal(false);

  // Active tab — read defaultTab from dialog data
  activeTab = signal<'login' | 'register'>(this.data?.defaultTab ?? 'login');

  // 2FA state
  twoFaRequired = signal(false);
  twoFaToken = signal<string | null>(null);
  twoFaMethod = signal<string | null>(null); // 'Email' | 'Sms' | 'Totp'
  twoFaError = signal<string | null>(null);

  // Forgot-password inline flow: null → 'form' → 'sent'
  forgotPasswordStep = signal<null | 'form' | 'sent'>(null);
  forgotPasswordLoading = signal(false);
  forgotPasswordError = signal<string | null>(null);

  showLoginPassword = signal(false);
  showRegisterPassword = signal(false);
  showConfirmPassword = signal(false);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  registerForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, strongPasswordValidator()]],
    confirmPassword: ['', Validators.required],
    firstName: [''],
    lastName: [''],
  });

  twoFaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
  });

  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
  get registerPassword(): string {
    return this.registerForm.get('password')?.value ?? '';
  }
  get registerPasswordTouched(): boolean {
    return this.registerForm.get('password')?.touched ?? false;
  }
  constructor() {
    this.loginForm.valueChanges.subscribe(() => this.loginError.set(null));
    this.twoFaForm.valueChanges.subscribe(() => this.twoFaError.set(null));
    this.registerForm.valueChanges.subscribe(() => {
      this.registerError.set(null);
      this.registerEmailExists.set(false);
    });
    this.forgotPasswordForm.valueChanges.subscribe(() => this.forgotPasswordError.set(null));
  }

  // ── LOGIN ─────────────────────────────────────────────────────────

  onLogin() {
    if (this.loginForm.invalid) return;
    this.isLoading.set(true);
    this.loginError.set(null);

    this.auth.login(this.loginForm.value as LoginRequest).subscribe({
      next: (res) => {
        if (res.status === '2FA_REQUIRED') {
          this.twoFaRequired.set(true);
          this.twoFaToken.set(res.twoFaToken ?? null);
          this.twoFaMethod.set(res.method ?? null);
          this.isLoading.set(false);
        } else {
          this.dialogRef.close(true);
          // isLoading cleared by complete
        }
      },
      error: (err) => {
        if (err.error?.errorCode === 'EMAIL_NOT_CONFIRMED') {
          this.auth.resendConfirmation({ email: this.loginForm.value.email! }).subscribe();
          this.dialogRef.close();
          this.dialog.open(EmailUnconfirmedDialogComponent, {
            data: { email: this.loginForm.value.email },
          });
        } else {
          this.loginError.set(err.error?.errorCode || 'LOGIN_ERROR');
        }
        this.isLoading.set(false);
      },
      complete: () => this.isLoading.set(false),
    });
  }
  closeLogin() {
    this.loginForm.reset();
    this.dialogRef.close();
  }

  // ── 2FA ──────────────────────────────────────────────────────────

  onVerify2FA() {
    if (this.twoFaForm.invalid || !this.twoFaToken()) return;
    this.isLoading.set(true);
    this.twoFaError.set(null);

    this.auth
      .verifyTwoFactor({
        twoFaToken: this.twoFaToken()!,
        code: this.twoFaForm.value.code!,
      })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => {
          this.twoFaError.set(err.error?.errorCode || 'INVALID_2FA_CODE');
          this.isLoading.set(false);
        },
        complete: () => this.isLoading.set(false),
      });
  }

  openBackupCodeLogin() {
    const email = this.loginForm.value.email ?? '';
    this.dialogRef.close();
    import('../backup-codes-login-dialog/backup-codes-login-dialog.component').then(
      ({ BackupCodesLoginDialogComponent }) => {
        this.dialog.open(BackupCodesLoginDialogComponent, {
          data: { email },
          // disableClose: true,
        });
      },
    );
  }

  back2FA() {
    this.twoFaRequired.set(false);
    this.twoFaToken.set(null);
    this.twoFaMethod.set(null);
    this.twoFaForm.reset();
    this.twoFaError.set(null);
  }

  // ── REGISTER ──────────────────────────────────────────────────────

  onRegister() {
    if (this.registerForm.invalid) return;

    const { password, confirmPassword } = this.registerForm.value;
    if (password !== confirmPassword) {
      this.registerError.set('AUTH.PASSWORDS_DO_NOT_MATCH');
      return;
    }

    const data: RegisterRequest = {
      email: this.registerForm.value.email!,
      password: password!,
      firstName: this.registerForm.value.firstName ?? undefined,
      lastName: this.registerForm.value.lastName ?? undefined,
    };

    this.isLoading.set(true);
    this.registerError.set(null);

    this.auth.register(data).subscribe({
      next: () => {
        this.registerSuccess.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        const code: string = err.error?.errorCode || 'REGISTER_ERROR';
        this.registerEmailExists.set(code === 'EMAIL_ALREADY_EXISTS');
        this.registerError.set(code);
        this.isLoading.set(false);
      },
    });
  }

  switchToLogin() {
    // Pre-fill email from register form for convenience
    const email = this.registerForm.value.email;
    if (email) this.loginForm.patchValue({ email });
    this.activeTab.set('login');
  }
  closeRegister() {
    this.registerForm.reset();
    this.dialogRef.close();
  }
  // ── FORGOT PASSWORD ──────────────────────────────────────────────

  openForgotPassword() {
    this.forgotPasswordStep.set('form');
    const email = this.loginForm.value.email;
    if (email) this.forgotPasswordForm.patchValue({ email });
  }

  sendForgotPassword() {
    if (this.forgotPasswordForm.invalid) return;
    this.forgotPasswordLoading.set(true);
    this.forgotPasswordError.set(null);

    this.auth.requestPasswordReset({ email: this.forgotPasswordForm.value.email! }).subscribe({
      next: () => {
        this.forgotPasswordStep.set('sent');
        this.forgotPasswordLoading.set(false);
      },
      error: (err) => {
        this.forgotPasswordError.set(err.error?.errorCode || 'PASSWORD_RESET_FAILED');
        this.forgotPasswordLoading.set(false);
      },
    });
  }

  closeForgotPassword() {
    this.forgotPasswordStep.set(null);
    this.forgotPasswordForm.reset();
    this.forgotPasswordError.set(null);
  }

  // ── SOCIAL ────────────────────────────────────────────────────────

  loginWithFacebook() {
    this.facebook.login();
  }
  loginWithGoogle() {
    this.google.login();
  }
}
