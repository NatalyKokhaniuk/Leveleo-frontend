import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../auth/services/auth.service';

export const adminGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return true; // SSR пропускає

  // Чекаємо завершення restoreSession, якщо триває
  if (auth.isRestoring()) {
    await firstValueFrom(
      auth.isRestoring$.pipe(
        filter((v) => !v),
        take(1),
      ),
    );
  }

  // Якщо немає токена, спробуємо відновити
  if (!auth.accessToken()) {
    try {
      await firstValueFrom(auth.restoreSession());
    } catch {}
  }

  // Перевірка ролі Admin
  if (auth.hasRole('Admin')) return true;
  return false;
};
