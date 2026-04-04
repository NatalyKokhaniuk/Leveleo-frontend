import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return next(req.clone({ withCredentials: true }));
  }

  const isRefreshRequest = req.url.endsWith('/auth/refresh-token');

  let authReq = req.clone({ withCredentials: true });

  if (!isRefreshRequest && authService.accessToken()) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${authService.accessToken()}` },
      withCredentials: true,
    });
  }

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401 && !isRefreshRequest) {
        return from(authService.refreshToken()).pipe(
          switchMap(() => {
            const newToken = authService.accessToken();
            const retryReq = newToken
              ? req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                  withCredentials: true,
                })
              : req.clone({ withCredentials: true });

            return next(retryReq);
          }),
          catchError((refreshErr) => {
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => refreshErr);
          }),
        );
      }

      if (error.status === 500) router.navigate(['/internal-server-error']);
      if (error.status === 503) router.navigate(['/service-unavailable']);

      return throwError(() => error);
    }),
  );
};
