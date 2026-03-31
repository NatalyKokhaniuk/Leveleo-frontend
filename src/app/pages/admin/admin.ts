import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersService, UserDto } from '../../core/auth/services/users';
import { AuthService } from '../../core/auth/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './admin.html',
})
export class AdminComponent {
  private usersService = inject(UsersService);
  private authService = inject(AuthService);

  users = signal<UserDto[]>([]);
  roles = ['Admin', 'Moderator', 'User'];

  constructor() {
    this.loadUsers();
  }

  loadUsers() {
    this.usersService.getUsers().subscribe((res) => {
      this.users.set(res);
    });
  }

  isAdmin(): boolean {
    return this.authService.hasRole('Admin');
  }

  changeRole(user: UserDto, role: string) {
    if (!this.isAdmin()) return;

    this.usersService.updateRoles(user.id, [role]).subscribe(() => {
      user.roles = [role];
      this.users.set([...this.users()]);
    });
  }

  deleteUser(id: string) {
    this.usersService.deleteUser(id).subscribe(() => {
      this.users.set(this.users().filter((u) => u.id !== id));
    });
  }

  blockUser(id: string) {
    this.usersService.blockUser(id).subscribe();
  }
}