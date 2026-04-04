import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserDto, UsersService } from '../../../../core/auth/services/users';
import { DataTableComponent, TableColumn } from '../../data-table/data-table.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, DataTableComponent, TranslateModule],
  templateUrl: './users.html',
})
export class UsersComponent {
  private usersService = inject(UsersService);
  private authService = inject(AuthService);
  dataForTable = computed(() => this.users());
  users = signal<UserDto[]>([]);
  roles = ['Admin', 'Moderator', 'User'];

  columns: TableColumn[] = [
    { key: 'firstName', label: 'Name', sortable: true },
    { key: 'lastName', label: 'Surname', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'roles',
      label: 'Role',
      type: 'select',
      options: ['User', 'Moderator', 'Admin'],
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
  rowLoading = signal<Record<string, 'block' | 'unblock' | null>>({});
  handleAction(event: any) {
    const { type, row } = event;

    if (type === 'delete') {
      this.usersService.deleteUser(row.id).subscribe(() => {
        this.users.set(this.users().filter((u) => u.id !== row.id));
      });
    }

    if (type === 'block') {
      this.rowLoading.update((r) => ({ ...r, [row.id]: 'block' }));
      this.usersService.blockUser(row.id).subscribe(() => {
        this.loadUsers();
        this.rowLoading.update((r) => ({ ...r, [row.id]: null }));
      });
    }

    if (type === 'unblock') {
      this.rowLoading.update((r) => ({ ...r, [row.id]: 'unblock' }));
      this.usersService.unblockUser(row.id).subscribe(() => {
        this.loadUsers();
        this.rowLoading.update((r) => ({ ...r, [row.id]: null }));
      });
    }

    if (type === 'select') {
      if (!this.authService.hasRole('Admin')) return;

      // 🔥 API PUT
      this.usersService
        .updateUser(row.id, {
          roles: row.roles,
        })
        .subscribe(() => {
          this.loadUsers();
        });
    }
  }
}
