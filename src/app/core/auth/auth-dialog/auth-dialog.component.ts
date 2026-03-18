import { UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon.component';
import { EmailUnconfirmedDialogComponent } from '../email-unconfirmed-dialog/email-unconfirmed-dialog.component';
import { LoginRequest, RegisterRequest } from '../models/auth.types';
import { AuthService } from '../services/auth.service';
import { FacebookAuthService } from '../services/facebookAuthService';
import { GoogleAuthService } from '../services/googleAuthService';

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
  ],
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent {
  private auth = inject(AuthService);
  private google = inject(GoogleAuthService);
  private facebook = inject(FacebookAuthService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  loginError = signal<string | null>(null);
  registerError = signal<string | null>(null);
  registerSuccess = signal<string | null>(null);
  dialogRef = inject(MatDialogRef<AuthDialogComponent>);
  private dialog = inject(MatDialog);
  activeTab = signal<'login' | 'register'>('login');

  isLoading = signal(false);

  twoFaRequired = signal(false);
  twoFaToken = signal<string | null>(null);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  registerForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    firstName: [''],
    lastName: [''],
  });

  twoFaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ---------- LOGIN ----------

  onLogin() {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);

    this.auth.login(this.loginForm.value as LoginRequest).subscribe({
      next: (res) => {
        if (res.status === '2FA_REQUIRED') {
          this.twoFaRequired.set(true);
          this.twoFaToken.set(res.twoFaToken!);
        } else {
          this.dialogRef.close(true);
        }
      },

      error: (err) => {
        if (err.error?.errorCode === 'EMAIL_NOT_CONFIRMED') {
          this.isLoading.set(false);
          this.auth.resendConfirmation({ email: this.loginForm.value.email! }).subscribe();
          this.dialogRef.close();
          this.dialog.open(EmailUnconfirmedDialogComponent, {
            data: { email: this.loginForm.value.email },
          });
          return;
        }
        this.loginError.set(err.error?.errorCode || 'LOGIN_ERROR');
        this.isLoading.set(false);
      },

      complete: () => this.isLoading.set(false),
    });
  }

  onVerify2FA() {
    if (!this.twoFaToken()) return;

    this.auth
      .verifyTwoFactor({
        twoFaToken: this.twoFaToken()!,
        code: this.twoFaForm.value.code!,
      })
      .subscribe(() => this.dialogRef.close(true));
  }

  // ---------- REGISTER ----------

  onRegister() {
    if (this.registerForm.invalid) return;

    const data: RegisterRequest = {
      email: this.registerForm.value.email!,
      password: this.registerForm.value.password!,
      firstName: this.registerForm.value.firstName ?? undefined,
      lastName: this.registerForm.value.lastName ?? undefined,
    };

    this.isLoading.set(true);

    this.auth.register(data).subscribe({
      next: () => {
        this.registerSuccess.set('REGISTER_SUCCESS');
      },

      error: (err) => {
        this.isLoading.set(false);

        this.registerError.set(err.error?.errorCode || 'REGISTER_ERROR');
      },

      complete: () => this.isLoading.set(false),
    });
  }

  // ---------- SOCIAL ----------

  loginWithFacebook() {
    this.facebook.login();
  }

  loginWithGoogle() {
    this.google.login();
  }

  constructor() {
    // Підписка на зміни loginForm
    this.loginForm.valueChanges.subscribe(() => {
      this.loginError.set(null);
    });

    // Підписка на зміни registerForm
    this.registerForm.valueChanges.subscribe(() => {
      this.registerError.set(null);
    });
  }
}
