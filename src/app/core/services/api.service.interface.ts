import { Observable } from 'rxjs';

export interface IApiService {
  get<T>(path: string): Observable<T>;
  post<T>(path: string, body: unknown): Observable<T>;
  put<T>(path: string, body: unknown): Observable<T>;
  delete<T>(path: string): Observable<T>;
}
