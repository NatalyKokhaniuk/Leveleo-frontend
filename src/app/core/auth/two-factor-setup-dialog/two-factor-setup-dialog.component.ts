import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TwoFactorInitiateResponse } from '../models/auth.types';
import { AuthService } from '../services/auth.service';

export type TwoFactorMethod = 'Email' | 'Sms' | 'Totp';

export interface TwoFactorSetupDialogData {
  
  currentMethod?: TwoFactorMethod | null;
}

@Component({
  selector: 'app-two-factor-setup-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatStepperModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './two-factor-setup-dialog.component.html',
})
export class TwoFactorSetupDialogComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  data = inject<TwoFactorSetupDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<TwoFactorSetupDialogComponent>);

  // ── Кроки: 'method' → 'verify' → 'backup' ──────────────────────
  step = signal<'method' | 'verify' | 'backup'>('method');

  

  methodForm = this.fb.group({
    method: ['Email' as TwoFactorMethod, Validators.required],
  });

  codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(8)]],
  });

  

  isLoading = signal(false);
  error = signal<string | null>(null);

  initiateResponse = signal<TwoFactorInitiateResponse | null>(null);
  backupCodes = signal<string[]>([]);
  codesCopied = signal(false);

  readonly methods: { value: TwoFactorMethod; labelKey: string; icon: string; descKey: string }[] =
    [
      {
        value: 'Email',
        labelKey: 'TWO_FA_SETUP.METHOD_EMAIL',
        icon: 'email',
        descKey: 'TWO_FA_SETUP.METHOD_EMAIL_DESC',
      },
      {
        value: 'Sms',
        labelKey: 'TWO_FA_SETUP.METHOD_SMS',
        icon: 'sms',
        descKey: 'TWO_FA_SETUP.METHOD_SMS_DESC',
      },
      {
        value: 'Totp',
        labelKey: 'TWO_FA_SETUP.METHOD_TOTP',
        icon: 'security',
        descKey: 'TWO_FA_SETUP.METHOD_TOTP_DESC',
      },
    ];

  selectedMethod = computed(() => this.methodForm.value.method as TwoFactorMethod);

  totpQrUrl = computed(() => {
    const resp = this.initiateResponse();
    if (!resp?.totpSecret) return null;
    const email = encodeURIComponent(this.auth.currentUser()?.email ?? 'user');
    const secret = encodeURIComponent(resp.totpSecret);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Leveleo:${email}?secret=${secret}%26issuer=Leveleo`;
  });

  totpSecret = computed(() => this.initiateResponse()?.totpSecret ?? null);

  secretCopied = signal(false);

  

  initiateSetup(): void {
    const method = this.selectedMethod();
    if (!method) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.initiateResponse.set(null);
    this.auth.initiateTwoFactor({ method }).subscribe({
      next: (resp) => {
        this.initiateResponse.set(resp);
        this.isLoading.set(false);
        this.step.set('verify');
      },
      error: (err) => {
        this.error.set(err.error?.errorCode || 'UNKNOWN_ERROR');
        this.isLoading.set(false);
      },
    });
  }

  

  confirmSetup(): void {
    if (this.codeForm.invalid) return;

    const resp = this.initiateResponse();
    if (!resp) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.auth
      .confirmTwoFactorSetup({
        code: this.codeForm.value.code!.trim(),
        temporaryToken: resp.temporaryToken,
      })
      .subscribe({
        next: () => {
          

          this.auth.getBackupCodes().subscribe({
            next: (bc) => {
              this.backupCodes.set(bc.codes);
              this.isLoading.set(false);
              this.step.set('backup');
            },
            error: () => {
              

              this.isLoading.set(false);
              this.step.set('backup');
            },
          });
        },
        error: (err) => {
          this.error.set(err.error?.errorCode || 'INVALID_2FA_CODE');
          this.isLoading.set(false);
        },
      });
  }

  

  copySecret(): void {
    const secret = this.totpSecret();
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      this.secretCopied.set(true);
      setTimeout(() => this.secretCopied.set(false), 3000);
    });
  }

  copyAllCodes(): void {
    const text = this.backupCodes().join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.codesCopied.set(true);
      this.translate.get('AUTH.BACKUP_CODES_COPIED').subscribe((msg) => {
        this.snack.open(msg, undefined, { duration: 2500 });
      });
      setTimeout(() => this.codesCopied.set(false), 3000);
    });
  }

  backToMethod(): void {
    this.step.set('method');
    this.codeForm.reset();
    this.error.set(null);
    this.initiateResponse.set(null);
  }

  finish(): void {
    this.dialogRef.close('success');
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
