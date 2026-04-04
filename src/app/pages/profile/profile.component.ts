import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthHandlerService } from '../../core/auth/services/auth-handler.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { MediaService } from '../../core/services/media.service';
import { UserService } from '../../features/users/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSelectModule,
    TranslateModule,
    MatTooltipModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private mediaService = inject(MediaService);
  private authHandler = inject(AuthHandlerService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  currentUser = this.auth.currentUser;
  isAdmin = this.auth.isAdmin;

  // Computed допоміжні сигнали
  fullName = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  });

  avatarInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '?';
    const first = u.firstName?.[0] ?? '';
    const last = u.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || u.email[0].toUpperCase();
  });

  // Стан
  isSaving = signal(false);
  isUploadingAvatar = signal(false);
  saveError = signal<string | null>(null);

  // Форма профілю
  form = this.fb.group({
    firstName: [this.currentUser()?.firstName ?? ''],
    lastName: [this.currentUser()?.lastName ?? ''],
    phoneNumber: [this.currentUser()?.phoneNumber ?? ''],
    language: [this.currentUser()?.language ?? 'uk'],
  });

  readonly languages = [
    { value: 'uk', label: 'Українська' },
    { value: 'en', label: 'English' },
  ];

  // ── Аватар ───────────────────────────────────────────────────────

  onAvatarClick(): void {
    document.getElementById('avatar-input')?.click();
  }

  onAvatarSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snack.open(this.translate.instant('PROFILE.AVATAR_INVALID_TYPE'), 'OK', {
        duration: 3000,
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.snack.open(this.translate.instant('PROFILE.AVATAR_TOO_LARGE'), 'OK', { duration: 3000 });
      return;
    }

    this.isUploadingAvatar.set(true);

    this.mediaService.upload(file).subscribe({
      next: (res) => {
        this.userService.updateMyProfile({ avatarKey: res.key }).subscribe({
          next: () => this.isUploadingAvatar.set(false),
          error: () => {
            this.isUploadingAvatar.set(false);
            this.snack.open(this.translate.instant('PROFILE.AVATAR_SAVE_ERROR'), 'OK', {
              duration: 3000,
            });
          },
        });
      },
      error: () => {
        this.isUploadingAvatar.set(false);
        this.snack.open(this.translate.instant('PROFILE.AVATAR_UPLOAD_ERROR'), 'OK', {
          duration: 3000,
        });
      },
    });
  }

  removeAvatar(): void {
    const key = this.currentUser()?.avatarKey;
    this.userService.updateMyProfile({ avatarKey: null }).subscribe({
      next: () => {
        if (key) this.mediaService.delete(key).subscribe();
      },
    });
  }

  // ── Профіль ──────────────────────────────────────────────────────

  onSave(): void {
    if (this.form.invalid) return;
    this.isSaving.set(true);
    this.saveError.set(null);

    const { firstName, lastName, phoneNumber, language } = this.form.value;

    this.userService
      .updateMyProfile({
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        pendingPhoneNumber: phoneNumber ?? null,
        language: language ?? null,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          if (language && language !== this.translate.currentLang) {
            this.translate.use(language);
          }
          this.snack.open(this.translate.instant('PROFILE.SAVED'), undefined, { duration: 2500 });
        },
        error: (err) => {
          this.saveError.set(err.error?.errorCode || 'UNKNOWN_ERROR');
          this.isSaving.set(false);
        },
      });
  }

  // ── Безпека ──────────────────────────────────────────────────────

  changePassword(): void {
    this.authHandler.openChangePassword();
  }

  openTwoFactorSetup(): void {
    this.authHandler.openTwoFactorSetup();
  }

  openTwoFactorManage(): void {
    this.authHandler.openTwoFactorManage();
  }

  // ── Небезпечна зона ─────────────────────────────────────────────

  deleteAccount(): void {
    this.auth.deleteAccount().subscribe({
      next: () => this.router.navigate(['/']),
    });
  }
}
