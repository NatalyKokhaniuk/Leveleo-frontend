import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthHandlerService {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private auth = inject(AuthService);

  handleAuthActions(route: ActivatedRoute): void {
    route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const action = params.get('authAction');
      console.log('authAction:', action);
      console.log('userId:', params.get('userId'));
      console.log('token:', params.get('token'));
      console.log(
        'all params:',
        params.keys.map((k) => `${k}=${params.get(k)}`),
      );
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
            // Bug fix: show a proper "invalid link" error, not email-not-confirmed
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
            // token-invalid: show generic error (link expired)
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
        //disableClose: true,
        data: { defaultTab: tab },
      });
    });
  }

  private exchangeSocialToken(tempToken: string): void {
    this.auth.exchangeTempToken({ tempToken }).subscribe({
      next: () => {
        // Сесія встановлена — хедер оновиться автоматично
      },
      error: () => {
        this.openSimpleResult('change-password-error');
      },
    });
  }
}
