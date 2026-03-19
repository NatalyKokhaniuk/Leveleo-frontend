import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../environment';
import { ApiService } from '../../services/api.service';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class FacebookAuthService {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID);

  private sdkReady: Promise<void> | null = null;

  // Завантажує SDK один раз і повертає Promise
  private loadSdk(): Promise<void> {
    if (this.sdkReady) return this.sdkReady;

    this.sdkReady = new Promise<void>((resolve) => {
      // Якщо SDK вже завантажений
      if (window.FB) {
        resolve();
        return;
      }

      // Колбек який викликає Facebook SDK після завантаження
      window.fbAsyncInit = () => {
        window.FB.init({
          appId: environment.facebookAppId,
          cookie: true,
          xfbml: false,
          version: 'v19.0',
        });
        resolve();
      };

      // Динамічно додаємо скрипт
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/uk_UA/sdk.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    });

    return this.sdkReady;
  }

  login() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.loadSdk().then(() => {
      window.FB.login(
        (response: any) => {
          if (!response.authResponse) return;

          const accessToken = response.authResponse.accessToken;

          this.api
            .post<{ redirectUrl: string }>('/auth/social/facebook', { accessToken })
            .subscribe({
              next: (res) => (window.location.href = res.redirectUrl),
              error: () => this.snack.open('Facebook login failed', 'OK', { duration: 3000 }),
            });
        },
        { scope: 'email' },
      );
    });
  }
}
