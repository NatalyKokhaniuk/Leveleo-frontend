import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { UpdateMyProfileRequest, UserResponse } from '../../core/auth/models/auth.types';
import { AuthService } from '../../core/auth/services/auth.service';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // ── Профіль поточного користувача ────────────────────────────────

  /**
   * Оновлює профіль поточного користувача.
   * Тіло — плоский JSON (опційні поля); надсилай лише те, що змінюється.
   * Після успіху оновлює сигнал currentUser в AuthService.
   */
  updateMyProfile(data: UpdateMyProfileRequest): Observable<UserResponse> {
    return this.api
      .put<UserResponse>('/users/me', data)
      .pipe(tap((user) => this.auth.updateCurrentUser(user)));
  }

  /**
   * Видаляє акаунт поточного користувача (soft delete на бекенді).
   * Після успіху очищає стан авторизації.
   */
  deleteMyAccount(): Observable<{ message: string }> {
    return this.auth.deleteAccount();
  }

  // ── Admin / Moderator endpoints ───────────────────────────────────
  // Використовуються в адмін-панелі (ще не реалізована)

  getUserById(id: string): Observable<UserResponse> {
    return this.api.get<UserResponse>(`/users/${id}`);
  }

  getAllUsers(): Observable<UserResponse[]> {
    return this.api.get<UserResponse[]>('/users');
  }

  searchUsers(filter: {
    email?: string;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    role?: string;
    phoneNumber?: string;
  }): Observable<UserResponse[]> {
    return this.api.post<UserResponse[]>('/users/search', filter);
  }

  editUser(
    id: string,
    data: {
      firstName?: string | null;
      lastName?: string | null;
      avatarKey?: string | null;
      phoneNumber?: string | null;
      language?: string | null;
      isActive?: boolean;
      roles?: string[];
    },
  ): Observable<UserResponse> {
    return this.api.put<UserResponse>(`/users/${id}`, data);
  }

  setActiveStatus(id: string, isActive: boolean): Observable<void> {
    return this.api.post<void>(`/users/${id}/block`, isActive);
  }

  changeRoles(id: string, roles: string[]): Observable<void> {
    return this.api.post<void>(`/users/${id}/roles`, roles);
  }

  deleteUser(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }
}
