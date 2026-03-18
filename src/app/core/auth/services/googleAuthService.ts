import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../environment';
import { ApiService } from '../../services/api.service';

declare const google: any;

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);

  constructor() {
    if (typeof window !== 'undefined' && typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: this.handleCredentialResponse.bind(this),
      });
    }
  }

  renderButton(container: HTMLElement) {
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: 260,
    });
  }

  private handleCredentialResponse(response: any) {
    const idToken = response.credential;

    this.api
      .post<{ redirectUrl: string }>('/auth/social/google', { accessToken: idToken })
      .subscribe({
        next: (res) => (window.location.href = res.redirectUrl),
        error: () => this.snack.open('Google login error', 'OK'),
      });
  }
  login() {
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed()) {
        console.log('Google login not displayed');
      }
    });
  }
}
