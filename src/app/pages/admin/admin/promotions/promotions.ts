import { DatePipe } from '@angular/common';
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
import { PromotionService } from '../../../../features/promotions/promotion.service';
import {
  DiscountType,
  PromotionLevel,
  PromotionResponseDto,
} from '../../../../features/promotions/promotion.types';
import {
  PromotionFormDialogComponent,
  PromotionFormDialogData,
} from './promotion-form-dialog/promotion-form-dialog.component';
import {
  PromotionDeleteDialogComponent,
  PromotionDeleteDialogData,
} from './promotion-delete-dialog/promotion-delete-dialog.component';
import { MediaImageThumbComponent } from '../shared/media-image-thumb/media-image-thumb.component';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

/** Назва для списку: базове поле, інакше переклад (en), інакше slug — якщо API не повертає name у getAll. */
export function promotionLabel(p: PromotionResponseDto): string {
  const raw = p.name?.trim();
  if (raw) {
    return raw;
  }
  const tr =
    p.translations?.find((t) => t.languageCode?.toLowerCase() === 'en') ?? p.translations?.[0];
  const tn = tr?.name?.trim();
  if (tn) {
    return tn;
  }
  return (p.slug ?? '').trim();
}

export type PromotionSortKey = 'name' | 'level' | 'discount' | 'startDate' | 'isActive';

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [
    DatePipe,
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
  templateUrl: './promotions.html',
  styleUrl: './promotions.scss',
})
export class AdminPromotionsComponent {
  private promotionService = inject(PromotionService);
  private dialog = inject(MatDialog);

  promotions = signal<PromotionResponseDto[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  page = signal(1);
  readonly pageSize = 10;

  search = signal('');
  sortKey = signal<PromotionSortKey | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  readonly PromotionLevel = PromotionLevel;
  readonly DiscountType = DiscountType;

  displayedColumns: string[] = ['name', 'level', 'discount', 'dates', 'active', 'image', 'actions'];

  filteredAndSortedPromotions = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = [...this.promotions()];

    if (term) {
      list = list.filter((p) => {
        const chunks: string[] = [
          promotionLabel(p),
          p.slug ?? '',
          p.description ?? '',
          p.couponCode ?? '',
        ];
        for (const tr of p.translations ?? []) {
          chunks.push(tr.name, tr.description ?? '');
        }
        return chunks.join(' ').toLowerCase().includes(term);
      });
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    if (key) {
      list = [...list].sort((a, b) => {
        let va: string | number = '';
        let vb: string | number = '';
        switch (key) {
          case 'name':
            va = promotionLabel(a);
            vb = promotionLabel(b);
            break;
          case 'level':
            va = a.level;
            vb = b.level;
            break;
          case 'discount':
            va = a.discountValue ?? 0;
            vb = b.discountValue ?? 0;
            break;
          case 'startDate':
            va = new Date(a.startDate).getTime();
            vb = new Date(b.startDate).getTime();
            break;
          case 'isActive':
            va = a.isActive ? 1 : 0;
            vb = b.isActive ? 1 : 0;
            break;
          default:
            va = '';
            vb = '';
        }
        const cmp =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  });

  paginatedPromotions = computed(() => {
    const all = this.filteredAndSortedPromotions();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAndSortedPromotions().length / this.pageSize)),
  );

  constructor() {
    this.loadPromotions();
  }

  loadPromotions(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.promotionService.getAll().subscribe({
      next: (list) => {
        this.promotions.set(list);
        this.loading.set(false);
        this.clampPage();
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('ADMIN.PROMOTION.LOAD_ERROR');
      },
    });
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  changeSort(key: PromotionSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIndicator(key: PromotionSortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  private clampPage(): void {
    const total = Math.max(1, Math.ceil(this.filteredAndSortedPromotions().length / this.pageSize));
    if (this.page() > total) {
      this.page.set(total);
    }
  }

  openCreate(): void {
    const ref = this.dialog.open(PromotionFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '720px',
      maxHeight: '90vh',
      data: {
        mode: 'create',
        promotion: null,
      } satisfies PromotionFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadPromotions();
      }
    });
  }

  openEdit(row: PromotionResponseDto): void {
    const ref = this.dialog.open(PromotionFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '720px',
      maxHeight: '90vh',
      data: {
        mode: 'edit',
        promotion: row,
      } satisfies PromotionFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadPromotions();
      }
    });
  }

  confirmDelete(row: PromotionResponseDto): void {
    const ref = this.dialog.open(PromotionDeleteDialogComponent, {
      panelClass: 'auth-dialog',
      maxWidth: '400px',
      data: { id: row.id, name: row.name } satisfies PromotionDeleteDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.loadPromotions();
      }
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  dash(value: string | null | undefined): string {
    return value?.trim() ? value : '—';
  }

  levelLabelKey(level: PromotionLevel): string {
    return level === PromotionLevel.Product
      ? 'ADMIN.PROMOTION.LEVEL_PRODUCT'
      : 'ADMIN.PROMOTION.LEVEL_CART';
  }

  discountLabel(row: PromotionResponseDto): string {
    const v = row.discountValue ?? 0;
    if (row.discountType === DiscountType.Percentage) {
      return `${v}%`;
    }
    if (row.discountType === DiscountType.FixedAmount) {
      return `${v}`;
    }
    return '—';
  }

  /** Відображувана назва в таблиці та картках. */
  promotionDisplayName(row: PromotionResponseDto): string {
    const s = promotionLabel(row);
    return s || '—';
  }
}
