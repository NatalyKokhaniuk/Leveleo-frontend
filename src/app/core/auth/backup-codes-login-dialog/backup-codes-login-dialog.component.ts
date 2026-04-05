import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { FavoritesStateService } from '../../favorites/favorites-state.service';
import { AuthService } from '../services/auth.service';

export interface BackupCodesLoginDialogData {
  email: string;
}

@Component({
  selector: 'app-backup-codes-login-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './backup-codes-login-dialog.component.html',
  styleUrl: './backup-codes-login-dialog.component.scss',
})
export class BackupCodesLoginDialogComponent {
  private auth = inject(AuthService);
  private favorites = inject(FavoritesStateService);
  private fb = inject(FormBuilder);
  data = inject<BackupCodesLoginDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<BackupCodesLoginDialogComponent>);

  isLoading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({
    backupCode: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(null));
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isLoading.set(true);

    this.auth
      .loginWithBackupCode({
        email: this.data.email,
        backupCode: this.form.value.backupCode!,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.favorites.hydrateAfterAuthRestore().subscribe({
            next: () => this.dialogRef.close(true),
            error: () => this.dialogRef.close(true),
          });
        },
        error: (err) => {
          this.error.set(err.error?.errorCode || 'INVALID_BACKUP_CODE');
          this.isLoading.set(false);
        },
      });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
