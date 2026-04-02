import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'select';
  options?: string[];
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T> {
  @Input() data: T[] = [];
  @Input() columns: TableColumn<T>[] = [];

  @Output() action = new EventEmitter<{ type: string; row: T }>();

  search = signal('');
  filters = signal<Record<string, any>>({});

  page = signal(1);
  pageSize = 5;

  sortKey = signal<keyof T | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  // 🔍 FILTER + SEARCH + SORT
  filteredData = computed(() => {
    let result = [...this.data];

    // SEARCH
    if (this.search()) {
      result = result.filter((row) =>
        Object.values(row as any).some((v) =>
          String(v).toLowerCase().includes(this.search().toLowerCase())
        )
      );
    }

    // FILTERS
    const f = this.filters();
    Object.keys(f).forEach((key) => {
      if (f[key]) {
        result = result.filter((row: any) => row[key] === f[key]);
      }
    });

    // SORT
    if (this.sortKey()) {
      result.sort((a: any, b: any) => {
        const valA = a[this.sortKey()!];
        const valB = b[this.sortKey()!];

        if (valA == null) return 1;
        if (valB == null) return -1;

        return this.sortDir() === 'asc'
          ? valA > valB
            ? 1
            : -1
          : valA < valB
          ? 1
          : -1;
      });
    }

    return result;
  });

  // 📄 PAGINATION
  paginatedData = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredData().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredData().length / this.pageSize)
  );

  // 🔽 SORT
  changeSort(key: keyof T) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  // 🔍 FILTER (FIXED)
  setFilter(key: string, value: any) {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
  }

  onFilterChange(key: keyof T, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.setFilter(key as string, value);
  }

  // 🔽 SELECT CHANGE (FIXED)
  onSelectChange(row: T, key: keyof T, event: Event) {
    const value = (event.target as HTMLSelectElement).value;

    const updatedRow = {
      ...(row as any),
      [key]: value,
    };

    this.emitAction('select', updatedRow);
  }

  // 🔍 SEARCH
  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  // 🎯 ACTION
  emitAction(type: string, row: T) {
    this.action.emit({ type, row });
  }

  // 📄 PAGINATION SAFE
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
}