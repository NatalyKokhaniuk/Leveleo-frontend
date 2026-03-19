import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

export type AuthResultVariant =
  | 'email-confirmed'
  | 'email-not-confirmed'
  | 'forgot-password-confirmation'
  | 'change-password-confirmation'
  | 'change-password-error'
  | 'social-login-error';

export interface AuthResultDialogData {
  variant: AuthResultVariant;
}

interface VariantConfig {
  icon: string;
  iconColor: string;
  titleKey: string;
  descKey: string;
  primaryBtnKey: string;
  primaryAction: 'login' | 'close';
  secondaryBtnKey?: string;
}

@Component({
  selector: 'app-auth-result-dialog',
  standalone: true,
  imports: [NgClass, MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './auth-result-dialog.component.html',
  styleUrl: './auth-result-dialog.component.scss',
})
export class AuthResultDialogComponent {
  data = inject<AuthResultDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<AuthResultDialogComponent>);

  readonly variantConfigs: Record<AuthResultVariant, VariantConfig> = {
    'email-confirmed': {
      icon: 'mark_email_read',
      iconColor: 'success',
      titleKey: 'AUTH.EMAIL_CONFIRMED_TITLE',
      descKey: 'AUTH.EMAIL_CONFIRMED_DESC',
      primaryBtnKey: 'AUTH.GO_TO_LOGIN',
      primaryAction: 'login',
    },
    'email-not-confirmed': {
      icon: 'mail_off',
      iconColor: 'warning',
      titleKey: 'AUTH.EMAIL_CONFIRMATION_FAILED_TITLE',
      descKey: 'AUTH.EMAIL_CONFIRMATION_FAILED_DESC',
      primaryBtnKey: 'AUTH.CLOSE',
      primaryAction: 'close',
    },
    'forgot-password-confirmation': {
      icon: 'lock_reset',
      iconColor: 'success',
      titleKey: 'AUTH.PASSWORD_RESET_DONE_TITLE',
      descKey: 'AUTH.PASSWORD_RESET_DONE_DESC',
      primaryBtnKey: 'AUTH.GO_TO_LOGIN',
      primaryAction: 'login',
    },
    'change-password-confirmation': {
      icon: 'lock_open',
      iconColor: 'success',
      titleKey: 'AUTH.CHANGE_PASSWORD_SUCCESS_TITLE',
      descKey: 'AUTH.CHANGE_PASSWORD_SUCCESS_DESC',
      primaryBtnKey: 'AUTH.CLOSE',
      primaryAction: 'close',
    },
    'change-password-error': {
      icon: 'lock',
      iconColor: 'error',
      titleKey: 'AUTH.CHANGE_PASSWORD_ERROR_TITLE',
      descKey: 'AUTH.CHANGE_PASSWORD_ERROR_DESC',
      primaryBtnKey: 'AUTH.CLOSE',
      primaryAction: 'close',
    },
    'social-login-error': {
      icon: 'person_off',
      iconColor: 'error',
      titleKey: 'AUTH.SOCIAL_LOGIN_ERROR_TITLE',
      descKey: 'AUTH.SOCIAL_LOGIN_ERROR_DESC',
      primaryBtnKey: 'AUTH.GO_TO_LOGIN',
      primaryAction: 'login',
    },
  };

  get config(): VariantConfig {
    return this.variantConfigs[this.data.variant];
  }

  onPrimary() {
    this.dialogRef.close(this.config.primaryAction);
  }
}
