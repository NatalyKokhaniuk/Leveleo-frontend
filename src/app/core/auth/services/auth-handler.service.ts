import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthHandlerService {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  handleAuthActions(route: ActivatedRoute): void {
    route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const action = params.get('authAction');
      console.log('authAction:', action);
      if (!action) return;

      this.router.navigate([], { queryParams: {}, replaceUrl: true });

      switch (action) {
        case 'email-confirmed':
          this.openEmailConfirmed();
          break;

        case 'email-not-confirmed':
          this.openSimpleResult('email-not-confirmed');
          break;

        case 'reset-password': {
          const userId = params.get('userId') ?? '';
          const token = params.get('token') ?? '';
          if (userId && token) {
            this.openForgotPasswordForm(userId, token);
          } else {
            this.openSimpleResult('change-password-error');
          }
          break;
        }

        case 'forgot-password-confirmation':
          this.openAfterLogin('forgot-password-confirmation');
          break;

        case 'change-password':
          this.openChangePassword();
          break;

        case 'change-password-confirmation':
          this.openSimpleResult('change-password-confirmation');
          break;

        case 'change-password-error':
          this.openSimpleResult('change-password-error');
          break;

        case 'social-login': {
          const tempToken = params.get('tempToken') ?? '';
          if (tempToken) {
            this.exchangeSocialToken(tempToken);
          } else {
            this.openSimpleResult('social-login-error');
          }
          break;
        }
      }
    });
  }

  // ── 2FA ──────────────────────────────────────────────────────────

  openTwoFactorSetup(): void {
    import('../two-factor-setup-dialog/two-factor-setup-dialog.component').then(
      ({ TwoFactorSetupDialogComponent }) => {
        this.dialog
          .open(TwoFactorSetupDialogComponent, {
            data: {},
            disableClose: true,
            maxWidth: '480px',
            width: '100%',
          })
          .afterClosed()
          .subscribe((result) => {
            if (result === 'success') {
              // Оновлюємо дані користувача після увімкнення 2FA
              this.auth.restoreSession().pipe(take(1)).subscribe();
            }
          });
      },
    );
  }

  openTwoFactorManage(): void {
    const user = this.auth.currentUser();
    if (!user?.twoFactorEnabled) return;

    import('../two-factor-manage-dialog/two-factor-manage-dialog.component').then(
      ({ TwoFactorManageDialogComponent }) => {
        this.dialog
          .open(TwoFactorManageDialogComponent, {
            data: { currentMethod: user.twoFactorMethod },
            maxWidth: '480px',
            width: '100%',
          })
          .afterClosed()
          .subscribe((result) => {
            if (!result) return;

            if (result === 'disabled') {
              // Оновлюємо стан після відключення 2FA
              this.auth.restoreSession().pipe(take(1)).subscribe();
              this.translate.get('PROFILE.2FA_DISABLED_SNACK').subscribe((msg) => {
                this.snack.open(msg, undefined, { duration: 2500 });
              });
            } else if (result === 'switch') {
              // Відкриваємо setup заново
              this.openTwoFactorSetup();
            } else if (result?.action === 'view-backup') {
              this.openBackupCodes(result.codes);
            }
          });
      },
    );
  }

  // ── Існуючі методи ───────────────────────────────────────────────

  private openEmailConfirmed(): void {
    import('../auth-result-dialog/auth-result-dialog.component').then(
      ({ AuthResultDialogComponent }) => {
        this.dialog
          .open(AuthResultDialogComponent, {
            data: { variant: 'email-confirmed' },
            disableClose: true,
          })
          .afterClosed()
          .subscribe((result) => {
            if (result === 'login') this.openAuthDialog('login');
          });
      },
    );
  }

  private openSimpleResult(
    variant:
      | 'email-not-confirmed'
      | 'change-password-confirmation'
      | 'change-password-error'
      | 'social-login-error',
  ): void {
    import('../auth-result-dialog/auth-result-dialog.component').then(
      ({ AuthResultDialogComponent }) => {
        this.dialog.open(AuthResultDialogComponent, { data: { variant } });
      },
    );
  }

  private openForgotPasswordForm(userId: string, token: string): void {
    import('../forgot-password-dialog/forgot-password-dialog.component').then(
      ({ ForgotPasswordDialogComponent }) => {
        this.dialog
          .open(ForgotPasswordDialogComponent, {
            data: { userId, token },
            disableClose: true,
          })
          .afterClosed()
          .subscribe((result) => {
            if (result === 'success') this.openAfterLogin('forgot-password-confirmation');
            else if (result === 'token-invalid') this.openSimpleResult('change-password-error');
          });
      },
    );
  }

  private openAfterLogin(variant: 'forgot-password-confirmation'): void {
    import('../auth-result-dialog/auth-result-dialog.component').then(
      ({ AuthResultDialogComponent }) => {
        this.dialog
          .open(AuthResultDialogComponent, { data: { variant } })
          .afterClosed()
          .subscribe((result) => {
            if (result === 'login') this.openAuthDialog('login');
          });
      },
    );
  }

  openChangePassword(): void {
    import('../change-password-dialog/change-password-dialog.component').then(
      ({ ChangePasswordDialogComponent }) => {
        this.dialog
          .open(ChangePasswordDialogComponent, { disableClose: true })
          .afterClosed()
          .subscribe((result) => {
            if (result === 'success') this.openSimpleResult('change-password-confirmation');
            else if (result === 'error') this.openSimpleResult('change-password-error');
          });
      },
    );
  }

  openBackupCodes(codes: string[]): void {
    import('../backup-codes-dialog/backup-codes-dialog.component').then(
      ({ BackupCodesDialogComponent }) => {
        this.dialog.open(BackupCodesDialogComponent, {
          data: { codes },
          disableClose: true,
        });
      },
    );
  }

  openAuthDialog(tab: 'login' | 'register' = 'login'): void {
    import('../auth-dialog/auth-dialog.component').then(({ AuthDialogComponent }) => {
      this.dialog.open(AuthDialogComponent, {
        panelClass: 'auth-dialog',
        maxHeight: '90vh',
        data: { defaultTab: tab },
      });
    });
  }

  private exchangeSocialToken(tempToken: string): void {
    this.auth.exchangeTempToken({ tempToken }).subscribe({
      next: () => {},
      error: () => {
        this.openSimpleResult('change-password-error');
      },
    });
  }
}
