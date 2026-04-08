import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, fromEvent, of } from 'rxjs';
import { ProductService } from '../../../features/products/product.service';
import { defaultProductFilter } from '../../../features/products/product-filter.encode';
import { ProductResponseDto, ProductSortBy } from '../../../features/products/product.types';
import { ProductQuickViewDialogComponent } from '../../products/product-quick-view-dialog/product-quick-view-dialog.component';
import { ProductCardComponent } from '../../products/product-card/product-card.component';
import { FavoritesStateService } from '../../../core/favorites/favorites-state.service';

@Component({
  selector: 'app-home-latest-products-strip',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    ProductCardComponent,
  ],
  templateUrl: './latest-products-strip.component.html',
  styleUrl: './latest-products-strip.component.scss',
})
export class HomeLatestProductsStripComponent implements OnInit {
  private productsApi = inject(ProductService);
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);
  private favorites = inject(FavoritesStateService);

  products = signal<ProductResponseDto[]>([]);
  loading = signal(true);
  expanded = signal(false);
  rowCount = signal(4);

  private updateRowCount(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const w = window.innerWidth;
    if (w < 640) {
      this.rowCount.set(1);
    } else if (w < 768) {
      this.rowCount.set(2);
    } else if (w < 1024) {
      this.rowCount.set(3);
    } else {
      this.rowCount.set(4);
    }
  }

  visibleProducts = computed(() => {
    const list = this.products();
    const n = this.rowCount();
    if (this.expanded() || list.length <= n) {
      return list;
    }
    return list.slice(0, n);
  });

  showToggle = computed(() => this.products().length > this.rowCount());

  ngOnInit(): void {
    this.updateRowCount();
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateRowCount());
    }

    this.productsApi
      .getPaged(
        defaultProductFilter({
          includeInactive: false,
          page: 1,
          pageSize: 12,
          // На бекенді default гілка switch сортує за CreatedAt desc (останні додані).
          // 999 не має case у ProductSortBy, тому потрапляє в default.
          sortBy: 999 as ProductSortBy,
        }),
      )
      .pipe(
        catchError(() => of({ items: [] as ProductResponseDto[] })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resp) => {
        this.products.set(resp.items ?? []);
        this.loading.set(false);
      });
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  openProductCard(product: ProductResponseDto): void {
    this.dialog.open(ProductQuickViewDialogComponent, {
      width: 'min(1100px, 96vw)',
      maxHeight: '92vh',
      autoFocus: false,
      data: { product },
    });
  }

  favoriteFor(id: string): boolean {
    return this.favorites.favoriteIds().has(id);
  }

  toggleFavorite(id: string): void {
    this.favorites.toggleFavorite(id).subscribe();
  }
}
