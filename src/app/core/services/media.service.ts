import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MediaUploadResponse } from '../auth/models/auth.types';

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
}
