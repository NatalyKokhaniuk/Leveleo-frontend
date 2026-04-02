import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent, TableColumn } from '../../data-table/data-table.component';
import { UsersService, UserDto } from '../../../../core/auth/services/users';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, DataTableComponent, TranslateModule],
  templateUrl: './users.html',
})
export class UsersComponent {
  private usersService = inject(UsersService);
  private authService = inject(AuthService);

  users = signal<UserDto[]>([]);
  roles = ['Admin', 'Moderator', 'User'];

  columns: TableColumn<UserDto>[] = [
    { key: 'firstName', label: 'Name', sortable: true },
    { key: 'lastName', label: 'Surname', sortable: true },
    {
      key: 'roles',
      label: 'Role',
      type: 'select',
      options: this.roles,
    },
  ];

  constructor() {
    this.loadUsers();
  }

  loadUsers() {
    this.usersService.getUsers().subscribe((res) => {
      this.users.set(res);
    });
  }

  handleAction(event: any) {
    const { type, row } = event;

    if (type === 'delete') {
      this.usersService.deleteUser(row.id).subscribe(() => {
        this.users.set(this.users().filter((u) => u.id !== row.id));
      });
    }

    if (type === 'block') {
      this.usersService.blockUser(row.id).subscribe();
    }

    if (type === 'select') {
      if (!this.authService.hasRole('Admin')) return;

      // 🔥 API PUT
      this.usersService.updateUser(row.id, {
        roles: [row.roles],
      }).subscribe(() => {
        this.loadUsers();
      });
    }
  }
}