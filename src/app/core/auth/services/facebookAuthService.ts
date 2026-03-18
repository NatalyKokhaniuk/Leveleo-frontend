import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../environment';
import { ApiService } from '../../services/api.service';

declare const FB: any;

@Injectable({ providedIn: 'root' })
export class FacebookAuthService {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  init() {
    if (typeof window === 'undefined') return;

    FB.init({
      appId: environment.facebookAppId,
      cookie: true,
      xfbml: false,
      version: 'v19.0',
    });
  }

  login() {
    FB.login(
      (response: any) => {
        if (!response.authResponse) return;

        const accessToken = response.authResponse.accessToken;

        this.api.post<{ redirectUrl: string }>('/auth/social/facebook', { accessToken }).subscribe({
          next: (res) => (window.location.href = res.redirectUrl),
          error: () => this.snack.open('Facebook login error', 'OK'),
        });
      },
      { scope: 'email' },
    );
  }
}
