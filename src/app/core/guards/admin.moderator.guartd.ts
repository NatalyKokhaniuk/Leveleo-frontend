import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../auth/services/auth.service';

export const adminOrModeratorGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
	const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) return true; // SSR пропускає

  if (auth.isRestoring()) {
    await firstValueFrom(
      auth.isRestoring$.pipe(
        filter((v) => !v),
        take(1),
      ),
    );
  }

  if (!auth.accessToken()) {
    try {
      await firstValueFrom(auth.restoreSession());
    } catch {}
  }

  if (auth.hasAnyRole(['Admin', 'Moderator'])) return true;
  return false;
};
