import { Component, computed, inject, NgZone, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-email-unconfirmed-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './email-unconfirmed-dialog.component.html',
  styleUrl: './email-unconfirmed-dialog.component.scss',
})
export class EmailUnconfirmedDialogComponent implements OnInit {
  private data = inject(MAT_DIALOG_DATA);
  email = this.data.email;
  private dialogRef = inject(MatDialogRef<EmailUnconfirmedDialogComponent>);
  private auth = inject(AuthService);
  private zone = inject(NgZone);
  errorMessage = signal('');
  isLoading = signal(false);
  countdown = signal(30);
  canResend = computed(() => this.countdown() === 0);
  private intervalId: any = null;

  resendEmail() {
    if (!this.canResend()) return;
    console.log('resendEmail');
    this.countdown.set(30);
    this.startCountdown();
    this.isLoading.set(true);

    // Виклик сервісу повторної відправки
    this.auth.resendConfirmation({ email: this.email }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.countdown.set(30);
        this.startCountdown();
      },
      error: (error) => {
        this.errorMessage.set(error.error?.errorCode || 'AUTH.EMAIL_NOT_SENT');
        this.isLoading.set(false);
        this.countdown.set(0);
      },
    });
  }

  private startCountdown() {
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      this.zone.run(() => {
        // <--- додали NgZone
        const current = this.countdown();
        if (current > 0) {
          this.countdown.set(current - 1);
        } else {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
      });
    }, 1000);
  }

  close() {
    this.dialogRef.close();
  }
  ngOnInit() {
    this.startCountdown();
  }
}
