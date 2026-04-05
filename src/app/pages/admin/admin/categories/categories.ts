import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';
import { CategoryService } from '../../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../../features/categories/category.types';
import {
  CategoryFormDialogComponent,
  CategoryFormDialogData,
} from './category-form-dialog/category-form-dialog.component';
import { CategoryDeleteDialogComponent } from './category-delete-dialog/category-delete-dialog.component';
import { MediaImageThumbComponent } from '../shared/media-image-thumb/media-image-thumb.component';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

export type CategorySortKey = 'name' | 'slug' | 'fullPath' | 'parent' | 'isActive';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MediaImageThumbComponent,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './categories.html',
})
export class CategoriesComponent {
  private categoryService = inject(CategoryService);
  private dialog = inject(MatDialog);

  categories = signal<CategoryResponseDto[]>([]);
  loading = signal(true);
  page = signal(1);
  readonly pageSize = 10;

  search = signal('');
  sortKey = signal<CategorySortKey | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  displayedColumns: string[] = ['image', 'name', 'slug', 'fullPath', 'parent', 'isActive', 'actions'];

  categoryById = computed(() => {
    const m = new Map<string, CategoryResponseDto>();
    for (const c of this.categories()) {
      m.set(c.id, c);
    }
    return m;
  });

  /** Пошук по полях категорії та перекладах (як повнотекстовий на бекенді). */
  filteredAndSortedCategories = computed(() => {
    const map = this.categoryById();
    const parentLabel = (parentId: string | null | undefined): string => {
      if (!parentId) {
        return '';
      }
      return map.get(parentId)?.name ?? parentId;
    };

    const term = this.search().trim().toLowerCase();
    let list = [...this.categories()];

    if (term) {
      list = list.filter((c) => {
        const chunks: string[] = [
          c.name,
          c.slug,
          c.fullPath,
          c.description ?? '',
          c.imageKey ?? '',
          parentLabel(c.parentId),
        ];
        for (const tr of c.translations ?? []) {
          chunks.push(tr.name, tr.description ?? '');
        }
        const haystack = chunks.join(' ').toLowerCase();
        return haystack.includes(term);
      });
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    if (key) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (key === 'parent') {
          cmp = parentLabel(a.parentId).localeCompare(parentLabel(b.parentId), undefined, {
            sensitivity: 'base',
          });
        } else if (key === 'isActive') {
          cmp = Number(a.isActive) - Number(b.isActive);
        } else {
          const va = String(a[key] ?? '');
          const vb = String(b[key] ?? '');
          cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
        }
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  });

  paginatedCategories = computed(() => {
    const all = this.filteredAndSortedCategories();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAndSortedCategories().length / this.pageSize)),
  );

  constructor() {
    this.loadCategories();
  }

  loadCategories() {
    this.loading.set(true);
    this.categoryService.getAll().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
        this.clampPage();
      },
      error: () => this.loading.set(false),
    });
  }

  parentName(parentId: string | null | undefined): string {
    if (!parentId) {
      return '—';
    }
    return this.categoryById().get(parentId)?.name ?? parentId;
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  changeSort(key: CategorySortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIndicator(key: CategorySortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil(this.filteredAndSortedCategories().length / this.pageSize));
    if (this.page() > total) {
      this.page.set(total);
    }
  }

  openCreate() {
    const ref = this.dialog.open(CategoryFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      maxHeight: '90vh',
      data: {
        mode: 'create',
        category: null,
        allCategories: this.categories(),
      } satisfies CategoryFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadCategories();
      }
    });
  }

  openEdit(row: CategoryResponseDto) {
    const ref = this.dialog.open(CategoryFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      maxHeight: '90vh',
      data: {
        mode: 'edit',
        category: row,
        allCategories: this.categories(),
      } satisfies CategoryFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadCategories();
      }
    });
  }

  confirmDelete(row: CategoryResponseDto) {
    const ref = this.dialog.open(CategoryDeleteDialogComponent, {
      panelClass: 'auth-dialog',
      maxWidth: '400px',
      data: { id: row.id, name: row.name },
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.loadCategories();
      }
    });
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }
}
