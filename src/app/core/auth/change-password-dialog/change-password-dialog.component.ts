import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { strongPasswordValidator } from '../../../shared/validators/password.validator';
import { AuthService } from '../services/auth.service';
import { PasswordStrengthComponent } from "../../../shared/components/password-strength.component";

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword');
  const confirm = control.get('confirmPassword');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  } else if (confirm?.hasError('passwordMismatch')) {
    confirm.setErrors(null);
  }
  return null;
}

@Component({
  selector: 'app-change-password-dialog',
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
    PasswordStrengthComponent
],
  templateUrl: './change-password-dialog.component.html',
  styleUrl: './change-password-dialog.component.scss',
})
export class ChangePasswordDialogComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

  isLoading = signal(false);
  error = signal<string | null>(null);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  form = this.fb.group(
    {
      newPassword: ['', [Validators.required, strongPasswordValidator()]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );
  get newPassword(): string {
    return this.form.get('newPassword')?.value ?? '';
  }
  get newPasswordTouched(): boolean {
    return this.form.get('newPassword')?.touched ?? false;
  }
  constructor() {
    // Clear error when user starts typing again
    this.form.valueChanges.subscribe(() => this.error.set(null));
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.auth.changePassword({ newPassword: this.form.value.newPassword! }).subscribe({
      next: () => {
        this.isLoading.set(false);
        // BUG FIX: close AFTER success, not on error - let user see error in dialog
        this.dialogRef.close('success');
      },
      error: (err) => {
        // BUG FIX: show error INSIDE dialog, do NOT close - user may want to retry
        this.error.set(err.error?.errorCode || 'CHANGE_PASSWORD_FAILED');
        this.isLoading.set(false);
        // Dialog stays open with error message visible
        // Only close with 'error' if the error is unrecoverable (e.g. token expired)
        const unrecoverable = ['UNAUTHORIZED', 'INVALID_REFRESH_TOKEN', 'REFRESH_TOKEN_EXPIRED'];
        if (unrecoverable.includes(err.error?.errorCode)) {
          this.dialogRef.close('error');
        }
      },
    });
  }

  onCancel() {
    this.dialogRef.close();
  }
}
