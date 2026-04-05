import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/auth/services/auth.service';
import { CartStateService } from '../../core/shopping-cart/cart-state.service';
import { ShoppingCartService } from '../../features/shopping-cart/shopping-cart.service';
import { ShoppingCartDto } from '../../features/shopping-cart/shopping-cart.types';
import { ProductService } from '../../features/products/product.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { ProductCommerceToolbarComponent } from '../products/product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductDetailTabsComponent } from '../products/product-detail-tabs/product-detail-tabs.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatIconModule,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
  ],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartPage implements OnInit {
  private auth = inject(AuthService);
  private cartApi = inject(ShoppingCartService);
  private cartState = inject(CartStateService);
  private products = inject(ProductService);

  loading = signal(true);
  loadError = signal(false);
  /** Порядок як у відповіді кошика. */
  lines = signal<{ product: ProductResponseDto; quantity: number }[]>([]);

  /** Рядки, що ще є в кошику (приховує позиції після видалення через панель дій). */
  visibleLines = computed(() => {
    const q = this.cartState.quantities();
    return this.lines().filter((row) => (q.get(row.product.id) ?? 0) > 0);
  });

  readonly isAuthenticated = this.auth.isAuthenticated;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.load();
    } else {
      this.loading.set(false);
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.cartApi
      .getMyCart()
      .pipe(
        switchMap((cart: ShoppingCartDto) => {
          const raw = cart.items ?? [];
          if (raw.length === 0) {
            return of([] as { product: ProductResponseDto; quantity: number }[]);
          }
          return forkJoin(
            raw.map((it) =>
              this.products.getById(String(it.productId)).pipe(
                map((p) => ({ product: p, quantity: Math.max(0, Number(it.quantity) || 0) })),
                catchError(() => of(null)),
              ),
            ),
          ).pipe(
            map((list) =>
              list.filter(
                (row): row is { product: ProductResponseDto; quantity: number } =>
                  row != null && row.product.isActive,
              ),
            ),
          );
        }),
        catchError(() => {
          this.loadError.set(true);
          return of([] as { product: ProductResponseDto; quantity: number }[]);
        }),
      )
      .subscribe((rows) => {
        this.lines.set(rows);
        this.loading.set(false);
      });
  }
}
