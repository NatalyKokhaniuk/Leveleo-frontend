import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
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
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
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
  private router = inject(Router);
  private cartApi = inject(ShoppingCartService);
  private cartState = inject(CartStateService);
  private products = inject(ProductService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  loading = signal(true);
  loadError = signal(false);
  /** Порядок як у відповіді кошика. */
  lines = signal<{ product: ProductResponseDto; quantity: number }[]>([]);
  cartTotals = signal<{
    totalOriginalPrice: number;
    totalProductDiscount: number;
    totalPayable: number;
    totalCartDiscount: number;
    promoName: string | null;
    promoDiscountType: number | null;
    promoDiscountValue: number | null;
  } | null>(null);

  /** Рендеримо рядки напряму з API, щоб кошик не "порожнів" через затримку локального state. */
  visibleLines = computed(() => {
    return this.lines().filter((row) => row.quantity > 0);
  });
  displayedTotal = computed(() => {
    const totals = this.cartTotals();
    if (!totals) return 0;
    if (this.visibleLines().length === 0) return 0;
    return totals.totalPayable;
  });

  readonly isAuthenticated = this.auth.isAuthenticated;
  private initialized = false;
  couponCode = signal('');
  couponBusy = signal(false);

  constructor() {
    effect(() => {
      const authed = this.auth.isAuthenticated();
      const q = this.cartState.quantities();
      if (!authed || !this.initialized) return;
      void q;
      this.load();
    });
  }

  ngOnInit(): void {
    this.initialized = true;
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
        switchMap((cart: ShoppingCartDto) => this.mapCartToRows(cart)),
        catchError(() => {
          this.loadError.set(true);
          this.cartTotals.set(null);
          return of([] as { product: ProductResponseDto; quantity: number }[]);
        }),
      )
      .subscribe((rows) => {
        this.lines.set(rows);
        this.loading.set(false);
      });
  }

  private mapCartToRows(cart: ShoppingCartDto) {
    this.cartTotals.set({
      totalOriginalPrice: Number(cart.totalOriginalPrice ?? 0),
      totalProductDiscount: Number(cart.totalProductDiscount ?? 0),
      totalPayable: Number(cart.totalPayable ?? 0),
      totalCartDiscount: Number(cart.totalCartDiscount ?? 0),
      promoName: cart.appliedCartPromotion?.name?.trim() || null,
      promoDiscountType: cart.appliedCartPromotion?.discountType ?? null,
      promoDiscountValue: cart.appliedCartPromotion?.discountValue ?? null,
    });
    this.couponCode.set(String(cart.couponCode ?? ''));
    const raw = cart.items ?? [];
    if (raw.length === 0) {
      return of([] as { product: ProductResponseDto; quantity: number }[]);
    }
    const ready = raw
      .map((it) => {
        const product = it.product;
        const quantity = Math.max(0, Number(it.quantity) || 0);
        if (!product) return null;
        return { product, quantity };
      })
      .filter(
        (row): row is { product: ProductResponseDto; quantity: number } =>
          row != null && row.product.isActive,
      );
    if (ready.length === raw.length) {
      return of(ready);
    }
    return forkJoin(
      raw.map((it) =>
        this.products.getById(String(it.productId ?? it.product?.id ?? '')).pipe(
          map((p) => {
            const quantity = Math.max(0, Number(it.quantity) || 0);
            return { product: p, quantity };
          }),
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
  }

  hasCartPromotion(): boolean {
    const t = this.cartTotals();
    return !!t && t.totalCartDiscount > 0;
  }

  promoLabel(): string {
    const t = this.cartTotals();
    if (!t) {
      return '';
    }
    if (t.promoName) {
      return t.promoName;
    }
    const v = t.promoDiscountValue ?? 0;
    if ((t.promoDiscountType ?? -1) === 0) {
      return `-${v}%`;
    }
    return `-${v}`;
  }

  onCouponInput(value: string): void {
    this.couponCode.set(value);
  }

  applyCoupon(): void {
    const code = this.couponCode().trim();
    if (!code || this.couponBusy()) return;
    this.couponBusy.set(true);
    this.cartApi.applyCoupon(code).subscribe({
      next: (cart) => {
        this.load();
        const applied = !!cart.appliedCartPromotion;
        if (!applied) {
          this.snack.open(this.translate.instant('CART.COUPON_NOT_ACTIVE'), 'OK', { duration: 3000 });
        }
        this.couponBusy.set(false);
      },
      error: (err) => {
        const msg = this.mapCouponError(err);
        this.snack.open(msg, 'OK', { duration: 3000 });
        this.couponBusy.set(false);
      },
    });
  }

  removeCoupon(): void {
    if (this.couponBusy()) return;
    this.couponBusy.set(true);
    this.cartApi.removeCoupon().subscribe({
      next: () => {
        this.load();
        this.couponBusy.set(false);
      },
      error: () => {
        this.snack.open(this.translate.instant('CART.COUPON_REMOVE_ERROR'), 'OK', { duration: 3000 });
        this.couponBusy.set(false);
      },
    });
  }

  checkout(): void {
    this.router.navigateByUrl('/checkout');
  }

  private mapCouponError(err: unknown): string {
    const error = err as {
      error?: { errorCode?: string; message?: string };
      message?: string;
    };
    const code = String(error?.error?.errorCode ?? '').toUpperCase();
    const msg = String(error?.error?.message ?? error?.message ?? '').toLowerCase();

    if (code.includes('NOT_FOUND') || msg.includes('not found') || msg.includes('не знайден')) {
      return this.translate.instant('CART.COUPON_NOT_FOUND');
    }
    if (code.includes('INVALID') || msg.includes('invalid') || msg.includes('недійс')) {
      return this.translate.instant('CART.COUPON_INVALID');
    }
    if (msg.includes('expired') || msg.includes('inactive') || msg.includes('неактив')) {
      return this.translate.instant('CART.COUPON_NOT_ACTIVE');
    }
    return this.translate.instant('CART.COUPON_ERROR');
  }
}
