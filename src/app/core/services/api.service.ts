import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { IApiService } from './api.service.interface';

@Injectable({ providedIn: 'root' })
export class ApiService implements IApiService {
  private http = inject(HttpClient);
  private base = '/api';

  // withCredentials: true — обов'язково для передачі HttpOnly cookies
  // (refresh-token, session) між фронтендом і бекендом
  private options = { withCredentials: true };

  get<T>(path: string) {
    return this.http.get<T>(`${this.base}${path}`, this.options);
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.base}${path}`, body, this.options);
  }

  /**
   * POST з сирим JSON-тілом (напр. `JSON.stringify(email)` для ASP.NET `[FromBody] string email`).
   */
  postRawJson(path: string, jsonBody: string): Observable<unknown> {
    return this.http.post(`${this.base}${path}`, jsonBody, {
      ...this.options,
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${this.base}${path}`, body, this.options);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.base}${path}`, this.options);
  }
}
