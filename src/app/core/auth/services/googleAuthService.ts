import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../environment';
import { ApiService } from '../../services/api.service';

declare global {
  interface Window {
    google: any;
    onGoogleLibraryLoad: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID);

  private sdkReady: Promise<void> | null = null;

  // Чекає поки Google SDK завантажиться (він вже є в index.html як async)
  private waitForSdk(): Promise<void> {
    if (this.sdkReady) return this.sdkReady;

    this.sdkReady = new Promise<void>((resolve) => {
      // SDK вже завантажений
      if (window.google?.accounts) {
        this.initSdk();
        resolve();
        return;
      }

      // Чекаємо колбек від Google SDK
      window.onGoogleLibraryLoad = () => {
        this.initSdk();
        resolve();
      };
    });

    return this.sdkReady;
  }

  private initSdk() {
    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: this.handleCredentialResponse.bind(this),
    });
  }

  private handleCredentialResponse(response: any) {
    const idToken = response.credential;

    this.api
      .post<{ redirectUrl: string }>('/auth/social/google', { accessToken: idToken })
      .subscribe({
        next: (res) => (window.location.href = res.redirectUrl),
        error: () => this.snack.open('Google login failed', 'OK', { duration: 3000 }),
      });
  }

  login() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.waitForSdk().then(() => {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap заблокований браузером — відкриваємо popup
          window.google.accounts.id.renderButton(
            document.createElement('div'),
            { theme: 'outline', size: 'large' },
          );
          // Альтернатива: показати кастомну кнопку або повідомлення
          this.snack.open(
            'Увімкніть popup для входу через Google або використайте email',
            'OK',
            { duration: 4000 },
          );
        }
      });
    });
  }

  // Рендеринг офіційної кнопки Google в контейнер (опціонально)
  renderButton(container: HTMLElement) {
    if (!isPlatformBrowser(this.platformId)) return;

    this.waitForSdk().then(() => {
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: 260,
      });
    });
  }
}
