import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { MediaService } from './media.service';

/** Тривалість кешу pre-signed URL (менше ніж типові 30 хв на бекенді). */
const URL_TTL_MS = 25 * 60 * 1000;

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
  private cache = new Map<string, CachedUrl>();

  /** `null` якщо ключа немає або помилка. */
  getUrl(key: string | null | undefined): Observable<string | null> {
    const k = key?.trim() ?? '';
    if (!k) {
      return of(null);
    }
    const now = Date.now();
    const hit = this.cache.get(k);
    if (hit && hit.until > now) {
      return of(hit.url);
    }
    return this.media.getSignedUrl(k).pipe(
      tap((r) => {
        this.cache.set(k, { url: r.url, until: Date.now() + URL_TTL_MS });
      }),
      map((r) => r.url),
      catchError(() => of(null)),
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
    return this.getUrl(k);
  }

  clear(): void {
    this.cache.clear();
  }
}
