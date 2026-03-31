// src/app/core/services/users.service.ts
import { Injectable, inject } from '@angular/core';
import { ApiService } from './api';
import { Observable } from 'rxjs';

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private api = inject(ApiService);
  private base = '/api/Users';

  getUsers(): Observable<UserDto[]> {
    return this.api.get<UserDto[]>(this.base);
  }

  updateRoles(id: string, roles: string[]) {
    return this.api.post(`${this.base}/${id}/roles`, roles);
  }

  deleteUser(id: string) {
    return this.api.delete(`${this.base}/${id}`);
  }

  blockUser(id: string) {
    return this.api.post(`${this.base}/${id}/block`, {});
  }
}