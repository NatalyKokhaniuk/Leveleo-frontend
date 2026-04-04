import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { TwoFactorMethod } from '../two-factor-setup-dialog/two-factor-setup-dialog.component';

export interface TwoFactorManageDialogData {
  currentMethod: TwoFactorMethod;
}

export type TwoFactorManageDialogResult =
  | 'disabled'
  | 'switch'
  | undefined;

@Component({
  selector: 'app-two-factor-manage-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ '2FA_MANAGE.TITLE' | translate }}</h2>

    <mat-dialog-content class="flex flex-col gap-4 pt-2">
      <div class="flex items-center gap-2 text-sm" style="color: var(--color-success)">
        <mat-icon>check_circle</mat-icon>
        <span>
          {{ '2FA_MANAGE.ACTIVE_METHOD' | translate }}:
          <strong>{{ methodLabel() | translate }}</strong>
        </span>
      </div>

      <!-- Перегляд резервних кодів -->
      <div
        class="flex items-start gap-3 p-3 rounded-lg border"
        style="border-color: var(--color-border)"
      >
        <mat-icon style="color: var(--color-text-secondary)">key</mat-icon>
        <div class="flex-1">
          <p class="font-medium text-sm" style="color: var(--color-text)">
            {{ '2FA_MANAGE.BACKUP_CODES' | translate }}
          </p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-secondary)">
            {{ '2FA_MANAGE.BACKUP_CODES_DESC' | translate }}
          </p>
        </div>
        <button matButton type="button" [disabled]="isLoading()" (click)="viewBackupCodes()">
          @if (isLoading() && loadingAction() === 'backup') {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            {{ '2FA_MANAGE.VIEW_CODES' | translate }}
          }
        </button>
      </div>

      <!-- Змінити метод -->
      <div
        class="flex items-start gap-3 p-3 rounded-lg border"
        style="border-color: var(--color-border)"
      >
        <mat-icon style="color: var(--color-text-secondary)">swap_horiz</mat-icon>
        <div class="flex-1">
          <p class="font-medium text-sm" style="color: var(--color-text)">
            {{ '2FA_MANAGE.SWITCH_METHOD' | translate }}
          </p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-secondary)">
            {{ '2FA_MANAGE.SWITCH_METHOD_DESC' | translate }}
          </p>
        </div>
        <button matButton type="button" [disabled]="isLoading()" (click)="switchMethod()">
          {{ '2FA_MANAGE.SWITCH' | translate }}
        </button>
      </div>

      <!-- Вимкнути 2FA -->
      <div
        class="flex items-start gap-3 p-3 rounded-lg border"
        style="border-color: color-mix(in srgb, var(--color-error) 40%, transparent)"
      >
        <mat-icon style="color: var(--color-error)">no_encryption</mat-icon>
        <div class="flex-1">
          <p class="font-medium text-sm" style="color: var(--color-text)">
            {{ '2FA_MANAGE.DISABLE' | translate }}
          </p>
          <p class="text-xs mt-0.5" style="color: var(--color-text-secondary)">
            {{ '2FA_MANAGE.DISABLE_DESC' | translate }}
          </p>
        </div>
        <button
          matButton
          type="button"
          style="color: var(--color-error)"
          [disabled]="isLoading()"
          (click)="disable()"
        >
          @if (isLoading() && loadingAction() === 'disable') {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            {{ '2FA_MANAGE.DISABLE_BTN' | translate }}
          }
        </button>
      </div>

      @if (error(); as err) {
        <div class="flex items-center gap-2 text-sm" style="color: var(--color-error)">
          <mat-icon class="text-base">error_outline</mat-icon>
          <span>{{ err | translate }}</span>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>{{ 'AUTH.CANCEL' | translate }}</button>
    </mat-dialog-actions>
  `,
})
export class TwoFactorManageDialogComponent {
  data = inject<TwoFactorManageDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<TwoFactorManageDialogComponent>);
  private auth = inject(AuthService);

  isLoading = signal(false);
  loadingAction = signal<'disable' | 'backup' | null>(null);
  error = signal<string | null>(null);

  methodLabel(): string {
    const labels: Record<TwoFactorMethod, string> = {
      Email: '2FA_SETUP.METHOD_EMAIL',
      Sms: '2FA_SETUP.METHOD_SMS',
      Totp: '2FA_SETUP.METHOD_TOTP',
    };
    return labels[this.data.currentMethod] ?? this.data.currentMethod;
  }

  viewBackupCodes(): void {
    this.isLoading.set(true);
    this.loadingAction.set('backup');
    this.error.set(null);

    this.auth.getBackupCodes().subscribe({
      next: (bc) => {
        this.isLoading.set(false);
        this.loadingAction.set(null);
        this.dialogRef.close({ action: 'view-backup', codes: bc.codes });
      },
      error: (err) => {
        this.error.set(err.error?.errorCode || 'UNKNOWN_ERROR');
        this.isLoading.set(false);
        this.loadingAction.set(null);
      },
    });
  }

  switchMethod(): void {
    this.dialogRef.close('switch');
  }

  disable(): void {
    this.isLoading.set(true);
    this.loadingAction.set('disable');
    this.error.set(null);

    this.auth.disableTwoFactor().subscribe({
      next: () => {
        this.isLoading.set(false);
        this.dialogRef.close('disabled');
      },
      error: (err) => {
        this.error.set(err.error?.errorCode || 'DISABLE_2FA_FAILED');
        this.isLoading.set(false);
        this.loadingAction.set(null);
      },
    });
  }
}
