import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Пропускаємо Authorization для самого /refresh-token
  const isRefreshRequest = req.url.endsWith('/api/auth/refresh-token');

  const authReq =
    !isRefreshRequest && authService.accessToken()
      ? req.clone({
          setHeaders: { Authorization: `Bearer ${authService.accessToken()}` },
          withCredentials: true,
        })
      : req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error) => {
      // Якщо 401 і це не сам refresh-запит
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
          catchError(() => {
            return throwError(() => error);
          }),
        );
      }

      // Серверні помилки
      if (error.status === 500) router.navigate(['/internal-server-error']);
      if (error.status === 503) router.navigate(['/service-unavailable']);

      return throwError(() => error);
    }),
  );
};
