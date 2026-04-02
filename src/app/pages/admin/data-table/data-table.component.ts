import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
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

  filteredData = computed(() => {
    let result = [...this.data];

    // 🔍 SEARCH
    if (this.search()) {
      result = result.filter((row) =>
        Object.values(row as any).some((v) =>
          String(v).toLowerCase().includes(this.search().toLowerCase())
        )
      );
    }

    // 🎯 FILTERS
    const f = this.filters();
    Object.keys(f).forEach((key) => {
      if (f[key]) {
        result = result.filter((row: any) => row[key] === f[key]);
      }
    });

    // ↕️ SORT
    if (this.sortKey()) {
      result.sort((a: any, b: any) => {
        const valA = a[this.sortKey()!];
        const valB = b[this.sortKey()!];

        return this.sortDir() === 'asc'
          ? valA > valB ? 1 : -1
          : valA < valB ? 1 : -1;
      });
    }

    return result;
  });

  paginatedData = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredData().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredData().length / this.pageSize)
  );

  changeSort(key: keyof T) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  setFilter(key: string, value: any) {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  emitAction(type: string, row: T) {
    this.action.emit({ type, row });
  }
}