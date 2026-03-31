// src/app/core/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private baseUrl = ''; // ← put your backend URL if needed

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(this.baseUrl + url);
  }

  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(this.baseUrl + url, body);
  }

  put<T>(url: string, body: any): Observable<T> {
    return this.http.put<T>(this.baseUrl + url, body);
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(this.baseUrl + url);
  }
}