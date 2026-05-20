import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import {
  FAVORITES_STORAGE_KEY,
} from '../../core/favorites/favorites-storage';
import { FavoritesStateService } from '../../core/favorites/favorites-state.service';
import { productLocalizedName } from '../../features/products/product-display-i18n';
import { sortProductsByFavoriteAddedAtDesc } from '../../features/products/product-relation-sort.util';
import {
  isArchivedFromSaleState,
  isCatalogPurchaseBlocked,
  isMissingFromDatabaseState,
  resolveProductCatalogDisplayState,
} from '../../features/products/product-catalog-display';
import { ProductResponseDto } from '../../features/products/product.types';
import { ProductCommerceToolbarComponent } from '../products/product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductDetailTabsComponent } from '../products/product-detail-tabs/product-detail-tabs.component';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../admin/admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
  ],
  templateUrl: './favorites.html',

})
export class FavoritesPage implements OnInit, OnDestroy {
  private favorites = inject(FavoritesStateService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  loadError = signal(false);
  clearingAll = signal(false);
  items = signal<ProductResponseDto[]>([]);

  ngOnInit(): void {
    this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorage);
    }
  }

  private onStorage = (e: StorageEvent): void => {
    if (e.key === FAVORITES_STORAGE_KEY) {
      this.load();
    }
  };

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.favorites
      .loadFavoriteProducts()
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of([] as ProductResponseDto[]);
        }),
      )
      .subscribe((list) => {
        this.items.set(sortProductsByFavoriteAddedAtDesc(list));
        this.loading.set(false);
      });
  }

  remove(id: string): void {
    this.favorites.removeFavorite(id).subscribe(() => {
      this.items.update((rows) => rows.filter((p) => p.id !== id));
    });
  }

  clearAll(): void {
    if (this.items().length === 0 || this.clearingAll()) {
      return;
    }
    const data: AdminConfirmDeleteDialogData = {
      titleKey: 'FAVORITES.CLEAR_ALL_CONFIRM_TITLE',
      messageKey: 'FAVORITES.CLEAR_ALL_CONFIRM_MESSAGE',
      confirmButtonKey: 'FAVORITES.CLEAR_ALL',
    };
    this.dialog
      .open(AdminConfirmDeleteDialogComponent, { data, width: '400px' })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.clearingAll.set(true);
        this.favorites.clearAllFavorites().subscribe({
          next: () => {
            this.items.set([]);
            this.clearingAll.set(false);
          },
          error: () => {
            this.clearingAll.set(false);
            this.snack.open(this.translate.instant('FAVORITES.CLEAR_ALL_ERROR'), undefined, {
              duration: 4000,
            });
          },
        });
      });
  }

  productName(p: ProductResponseDto): string {
    return productLocalizedName(p, this.translate.currentLang || 'uk');
  }

  productPublicLinkSegments(p: ProductResponseDto): string[] | null {
    const st = resolveProductCatalogDisplayState(p);
    if (isMissingFromDatabaseState(st) || isArchivedFromSaleState(st)) return null;
    const slug = p.slug?.trim();
    return slug ? ['/products', slug] : null;
  }

  productPurchaseBlocked(p: ProductResponseDto): boolean {
    return isCatalogPurchaseBlocked(p);
  }
}
