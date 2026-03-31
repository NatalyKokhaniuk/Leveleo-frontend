import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${this.base}${path}`, body, this.options);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.base}${path}`, this.options);
  }
}
