import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environment';
import { AuthService } from '../auth/services/auth.service';
import { MediaService } from './media.service';

/** Тривалість кешу pre-signed URL (менше ніж типові 30 хв на бекенді). */
const URL_TTL_MS = 25 * 60 * 1000;

let guestMediaHintLogged = false;

function logGuestMediaHintOnce(): void {
  if (guestMediaHintLogged || environment.production) {
    return;
  }
  guestMediaHintLogged = true;
  console.warn(
    '[Leveleo] Зображення для гостей недоступні: GET /api/media/url повертає 401 або /api/media/public-url не існує. ' +
      'Варіанти: (1) на бекенді [AllowAnonymous] для GET /api/media/url; ' +
      '(2) реалізувати GET /api/media/public-url як у /url; ' +
      '(3) у відповіді товару додати mainImageUrl; ' +
      '(4) у environment.ts задати mediaPublicUrlTemplate на публічний CDN.',
  );
}

interface CachedUrl {
  url: string;
  until: number;
}

/**
 * Кешує розшифровані (pre-signed) URL за ключем медіа, щоб не дьоргати /api/media/url
 * при кожному відкритті картки чи модалки.
 */
@Injectable({ providedIn: 'root' })
export class MediaUrlCacheService {
  private media = inject(MediaService);
  private auth = inject(AuthService);
  private cache = new Map<string, CachedUrl>();

  /** `null` якщо ключа немає або помилка. */
  getUrl(key: string | null | undefined): Observable<string | null> {
    const k = key?.trim() ?? '';
    if (!k) {
      return of(null);
    }

    const template = environment.mediaPublicUrlTemplate?.trim();
    if (template) {
      const url = template.includes('{key}')
        ? template.split('{key}').join(encodeURIComponent(k))
        : `${template.replace(/\/$/, '')}/${encodeURIComponent(k)}`;
      const now = Date.now();
      const hit = this.cache.get(k);
      if (hit && hit.until > now) {
        return of(hit.url);
      }
      this.cache.set(k, { url, until: Date.now() + URL_TTL_MS });
      return of(url);
    }

    const now = Date.now();
    const hit = this.cache.get(k);
    if (hit && hit.until > now) {
      return of(hit.url);
    }
    return this.fetchAndCacheSignedOrPublic(k);
  }

  private fetchAndCacheSignedOrPublic(k: string): Observable<string | null> {
    return this.media.getSignedUrl(k).pipe(
      tap((r) => {
        this.cache.set(k, { url: r.url, until: Date.now() + URL_TTL_MS });
      }),
      map((r) => r.url),
      catchError((err) => {
        const status = err?.status;
        if (!this.auth.isAuthenticated() && (status === 401 || status === 403)) {
          return this.media.getPublicMediaUrl(k).pipe(
            tap((r) => {
              this.cache.set(k, { url: r.url, until: Date.now() + URL_TTL_MS });
            }),
            map((r) => r.url),
            catchError(() => {
              logGuestMediaHintOnce();
              return of(null);
            }),
          );
        }
        if (!this.auth.isAuthenticated() && status !== 401 && status !== 403) {
          logGuestMediaHintOnce();
        }
        return of(null);
      }),
    );
  }

  invalidateKey(key: string): void {
    this.cache.delete(key.trim());
  }

  /**
   * Після помилки &lt;img&gt; (прострочений pre-signed URL у кеші чи на CDN):
   * скинути запис і отримати новий URL з API.
   */
  refreshUrl(key: string | null | undefined): Observable<string | null> {
    const k = key?.trim() ?? '';
    if (!k) {
      return of(null);
    }
    this.cache.delete(k);
    return this.getUrl(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
