import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MediaSignedUrlResponse, MediaUploadResponse } from '../auth/models/auth.types';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private http = inject(HttpClient);
  private base = '/api/media';
  private options = { withCredentials: true };

  /**
   * Завантажує файл на сервер.
   * Повертає { fileName, key, url } де key — ключ в S3 для збереження в профілі.
   */
  upload(file: File): Observable<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    // FormData — не передаємо Content-Type, браузер сам виставить multipart/form-data
    return this.http.post<MediaUploadResponse>(`${this.base}/upload`, formData, {
      withCredentials: true,
    });
  }

  /**
   * Видаляє файл з S3 за ключем.
   */
  delete(key: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/${encodeURIComponent(key)}`,
      this.options,
    );
  }

  /**
   * Тимчасовий pre-signed URL для ключа (приватний бакет). Використовуйте для &lt;img [src]&gt;.
   */
  getSignedUrl(key: string, expiresMinutes = 30): Observable<MediaSignedUrlResponse> {
    const params = new HttpParams()
      .set('key', key)
      .set('expiresMinutes', String(expiresMinutes));
    return this.http.get<MediaSignedUrlResponse>(`${this.base}/url`, {
      ...this.options,
      params,
    });
  }

  /**
   * Публічний URL для ключа без JWT — на бекенді: GET /api/media/public-url з [AllowAnonymous].
   * Використовується для гостей, якщо /url вимагає авторизації.
   */
  getPublicMediaUrl(key: string): Observable<MediaSignedUrlResponse> {
    const params = new HttpParams().set('key', key);
    return this.http.get<MediaSignedUrlResponse>(`${this.base}/public-url`, {
      ...this.options,
      params,
    });
  }
}
