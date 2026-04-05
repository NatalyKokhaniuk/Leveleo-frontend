import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserDto, UsersService } from '../../../../core/auth/services/users';
import { AdminConfirmDeleteDialogComponent } from '../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { DataTableComponent, TableColumn } from '../../data-table/data-table.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatDialogModule, DataTableComponent, TranslateModule],
  templateUrl: './users.html',
})
export class UsersComponent {
  private usersService = inject(UsersService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  dataForTable = computed(() => this.users());
  users = signal<UserDto[]>([]);
  roles = ['Admin', 'Moderator', 'User'];

  columns: TableColumn[] = [
    { key: 'firstName', labelKey: 'ADMIN.USER.COL_FIRST_NAME', sortable: true },
    { key: 'lastName', labelKey: 'ADMIN.USER.COL_LAST_NAME', sortable: true },
    { key: 'email', labelKey: 'ADMIN.USER.COL_EMAIL', sortable: true },
    {
      key: 'roles',
      labelKey: 'ADMIN.USER.COL_ROLE',
      type: 'select',
      options: [
        { value: 'User', labelKey: 'ADMIN.USER.ROLE_USER' },
        { value: 'Moderator', labelKey: 'ADMIN.USER.ROLE_MODERATOR' },
        { value: 'Admin', labelKey: 'ADMIN.USER.ROLE_ADMIN' },
      ],
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
      this.dialog
        .open(AdminConfirmDeleteDialogComponent, {
          width: 'min(440px, 100vw)',
          data: {},
        })
        .afterClosed()
        .subscribe((ok) => {
          if (!ok) return;
          this.usersService.deleteUser(row.id).subscribe(() => {
            this.users.set(this.users().filter((u) => u.id !== row.id));
          });
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
