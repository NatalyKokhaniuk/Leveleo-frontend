import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, Signal, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { UserDto } from '../../../core/auth/services/users';

export interface TableColumn {
  key: keyof UserDto;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'select';
  options?: string[];
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatProgressSpinner,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent {
  @Input({ required: true }) data!: Signal<UserDto[]>;
  @Input({ required: true }) rowLoading!: Signal<Record<string, 'block' | 'unblock' | null>>; // false;

  @Input() columns: TableColumn[] = [];

  @Output() action = new EventEmitter<{ type: string; row: UserDto }>();

  search = signal('');
  filters = signal<Record<string, any>>({});
  roleOptions = ['Admin', 'Moderator', 'User'];
  page = signal(1);
  pageSize = 5;

  sortKey = signal<keyof UserDto | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');
  // пошук
  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  // фільтр по ролях
  onRoleFilterChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.setFilter('roles', value); // 'roles' тут ключ для фільтру
  }

  // головна функція фільтру + пошуку + сорту
  filteredData = computed(() => {
    let result = [...this.data()];

    const term = this.search().trim().toLowerCase();
    if (term) {
      result = result.filter((user) =>
        [user.firstName, user.lastName, user.email].some((field) =>
          (field || '').toLowerCase().includes(term),
        ),
      );
    }

    const f = this.filters();
    if (f['roles'] && f['roles'] !== '...') {
      result = result.filter((user) => user.roles.includes(f['roles']));
    }

    if (this.sortKey()) {
      result.sort((a, b) => {
        const valA = a[this.sortKey()!];
        const valB = b[this.sortKey()!];

        if (valA == null) return 1;
        if (valB == null) return -1;

        return this.sortDir() === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
    }

    return result;
  });

  // ROLE FILTER
  onFilterChange(key: keyof UserDto, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.setFilter(key, value);
  }
  // FILTER + SEARCH + SORT
  // filteredData = computed(() => {
  //   let result = [...this.data()];

  //   if (this.search()) {
  //     result = result.filter((row) =>
  //       [row.firstName, row.lastName, row.email].some((v) =>
  //         v.toLowerCase().includes(this.search().toLowerCase()),
  //       ),
  //     );
  //   }

  //   const f = this.filters();
  //   Object.keys(f).forEach((key) => {
  //     if (f[key] !== '...') {
  //       result = result.filter((row: any) => row.roles[0] === f[key]);
  //     }
  //   });

  //   if (this.sortKey()) {
  //     result.sort((a, b) => {
  //       const valA = a[this.sortKey()!];
  //       const valB = b[this.sortKey()!];

  //       if (valA == null) return 1;
  //       if (valB == null) return -1;

  //       return this.sortDir() === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
  //     });
  //   }

  //   return result;
  // });

  paginatedData = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredData().slice(start, start + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.filteredData().length / this.pageSize));

  // SORT
  changeSort(key: keyof UserDto) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  // FILTER
  setFilter(key: keyof UserDto, value: any) {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
  }

  // SELECT CHANGE
  onSelectChange(row: UserDto, key: keyof UserDto, value: string) {
    // створюємо новий об'єкт з оновленою роллю
    const updatedRow: UserDto = { ...row, [key]: [value] };
    this.emitAction('select', updatedRow);
  }

  // ACTION
  emitAction(type: string, row: UserDto) {
    this.action.emit({ type, row });
  }

  // PAGINATION
  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }
  displayValue(row: UserDto, key: keyof UserDto) {
    if (key === 'roles') return row.roles[0] || '';
    return row[key];
  }
}
