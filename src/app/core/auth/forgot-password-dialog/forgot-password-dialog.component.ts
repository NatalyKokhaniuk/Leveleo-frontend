import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { strongPasswordValidator } from '../../../shared/validators/password.validator';
import { AuthService } from '../services/auth.service';
import { PasswordStrengthComponent } from "../../../shared/components/password-strength.component";

export interface ForgotPasswordDialogData {
  userId: string;
  token: string;
}

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
  selector: 'app-forgot-password-dialog',
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
  templateUrl: './forgot-password-dialog.component.html',
  styleUrl: './forgot-password-dialog.component.scss',
})
export class ForgotPasswordDialogComponent {
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  data = inject<ForgotPasswordDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>);

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
    this.form.valueChanges.subscribe(() => this.error.set(null));
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.auth
      .confirmPasswordReset({
        userId: this.data.userId,
        token: this.data.token,
        newPassword: this.form.value.newPassword!,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.dialogRef.close('success');
        },
        error: (err) => {
          this.error.set(err.error?.errorCode || 'PASSWORD_RESET_FAILED');
          this.isLoading.set(false);
          // Token expired/invalid — unrecoverable, close with error
          const unrecoverable = ['PASSWORD_RESET_FAILED', 'UNAUTHORIZED'];
          if (unrecoverable.includes(err.error?.errorCode)) {
            setTimeout(() => this.dialogRef.close('token-invalid'), 2000);
          }
        },
      });
  }

  onCancel() {
    this.dialogRef.close();
  }
}
