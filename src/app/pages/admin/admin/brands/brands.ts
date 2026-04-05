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
import { BrandService } from '../../../../features/brands/brand.service';
import { BrandResponseDto } from '../../../../features/brands/brand.types';
import {
  BrandFormDialogComponent,
  BrandFormDialogData,
} from './brand-form-dialog/brand-form-dialog.component';
import { BrandDeleteDialogComponent } from './brand-delete-dialog/brand-delete-dialog.component';
import { MediaImageThumbComponent } from '../shared/media-image-thumb/media-image-thumb.component';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

export type BrandSortKey = 'name' | 'slug' | 'description' | 'logoKey' | 'metaTitle';

@Component({
  selector: 'app-brands',
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
  templateUrl: './brands.html',
})
export class BrandsComponent {
  private brandService = inject(BrandService);
  private dialog = inject(MatDialog);

  brands = signal<BrandResponseDto[]>([]);
  loading = signal(true);
  page = signal(1);
  readonly pageSize = 10;

  search = signal('');
  sortKey = signal<BrandSortKey | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  displayedColumns: string[] = ['name', 'slug', 'description', 'logoKey', 'metaTitle', 'actions'];

  filteredAndSortedBrands = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = [...this.brands()];

    if (term) {
      list = list.filter((b) => {
        const chunks: string[] = [
          b.name,
          b.slug,
          b.description ?? '',
          b.logoKey ?? '',
          b.metaTitle ?? '',
          b.metaDescription ?? '',
        ];
        for (const tr of b.translations ?? []) {
          chunks.push(tr.name, tr.description ?? '');
        }
        return chunks.join(' ').toLowerCase().includes(term);
      });
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    if (key) {
      list = [...list].sort((a, b) => {
        const va = String(a[key] ?? '');
        const vb = String(b[key] ?? '');
        const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  });

  paginatedBrands = computed(() => {
    const all = this.filteredAndSortedBrands();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAndSortedBrands().length / this.pageSize)),
  );

  constructor() {
    this.loadBrands();
  }

  loadBrands() {
    this.loading.set(true);
    this.brandService.getAll().subscribe({
      next: (list) => {
        this.brands.set(list);
        this.loading.set(false);
        this.clampPage();
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  changeSort(key: BrandSortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIndicator(key: BrandSortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil(this.filteredAndSortedBrands().length / this.pageSize));
    if (this.page() > total) {
      this.page.set(total);
    }
  }

  openCreate() {
    const ref = this.dialog.open(BrandFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      maxHeight: '90vh',
      data: {
        mode: 'create',
        brand: null,
      } satisfies BrandFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadBrands();
      }
    });
  }

  openEdit(row: BrandResponseDto) {
    const ref = this.dialog.open(BrandFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      maxHeight: '90vh',
      data: {
        mode: 'edit',
        brand: row,
      } satisfies BrandFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadBrands();
      }
    });
  }

  confirmDelete(row: BrandResponseDto) {
    const ref = this.dialog.open(BrandDeleteDialogComponent, {
      panelClass: 'auth-dialog',
      maxWidth: '400px',
      data: { id: row.id, name: row.name },
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.loadBrands();
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

  dash(value: string | null | undefined): string {
    return value?.trim() ? value : '—';
  }
}
