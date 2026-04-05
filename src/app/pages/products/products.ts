import { Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { ProductCatalogStateService } from '../../features/products/product-catalog.state';
import { defaultProductFilter } from '../../features/products/product-filter.encode';
import { ProductResponseDto, ProductSortBy } from '../../features/products/product.types';
import { ProductCardComponent } from './product-card/product-card.component';
import {
  ProductQuickViewDialogComponent,
  ProductQuickViewDialogData,
} from './product-quick-view-dialog/product-quick-view-dialog.component';

const FAVORITES_STORAGE_KEY = 'leveleo_favorite_product_ids';

function readFavoriteIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') {
      return new Set();
    }
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      return new Set();
    }
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeFavoriteIds(ids: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [TranslateModule, MatProgressSpinnerModule, ProductCardComponent],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {
  private catalogState = inject(ProductCatalogStateService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);

  private favoriteIds = signal<Set<string>>(readFavoriteIds());

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const filter = defaultProductFilter({
      includeInactive: false,
      sortBy: ProductSortBy.PriceAsc,
      page: 1,
      pageSize: 24,
    });

    this.catalogState
      .load(filter)
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res) {
          this.items.set(res.items);
        } else {
          this.items.set([]);
        }
      });
  }

  openQuickView(product: ProductResponseDto): void {
    this.dialog.open<ProductQuickViewDialogComponent, ProductQuickViewDialogData>(
      ProductQuickViewDialogComponent,
      {
        panelClass: ['auth-dialog', 'product-quick-view-panel'],
        width: 'min(720px, calc(100vw - 24px))',
        maxWidth: '100vw',
        maxHeight: '90vh',
        data: { product },
      },
    );
  }

  favoriteFor(id: string): boolean {
    return this.favoriteIds().has(id);
  }

  toggleFavorite(id: string): void {
    this.favoriteIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      writeFavoriteIds(next);
      return next;
    });
  }
}
