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
import { MediaUrlCacheService } from '../../core/services/media-url-cache.service';
import { brandLocalizedName } from '../../features/brands/brand-display-i18n';
import { BrandService } from '../../features/brands/brand.service';
import { BrandResponseDto } from '../../features/brands/brand.types';
import { productLocalizedName } from '../../features/products/product-display-i18n';
import { ShoppingCartService } from '../../features/shopping-cart/shopping-cart.service';
import { computePricingFromCartItems } from '../../features/shopping-cart/cart-pricing.util';
import { ShoppingCartDto } from '../../features/shopping-cart/shopping-cart.types';
import { ProductService } from '../../features/products/product.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { ProductCommerceToolbarComponent } from '../products/product-commerce-toolbar/product-commerce-toolbar.component';

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
  private mediaUrlCache = inject(MediaUrlCacheService);
  private brandsApi = inject(BrandService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  loading = signal(true);
  loadError = signal(false);
  /** Порядок як у відповіді кошика. */
  lines = signal<{ product: ProductResponseDto; quantity: number }[]>([]);
  cartTotals = signal<{
    /** Σ каталожних цін — для узгодженості з рядками. */
    totalCatalogList: number;
    /** З рядків: (list − після товарної акції) × qty. */
    totalProductDiscount: number;
    /** Після товарних знижок, до знижки кошика. */
    subtotalAfterProductPromotions: number;
    /** З API; якщо 0 — fallback з сумою по рядках. */
    totalCartDiscount: number;
    totalPayable: number;
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
  private lang = signal(this.translate.currentLang || 'uk');
  private imageUrls = signal<Map<string, string | null>>(new Map());
  private brandCatalog = signal<BrandResponseDto[]>([]);

  constructor() {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
    effect(() => {
      const authed = this.auth.isAuthenticated();
      const q = this.cartState.quantities();
      if (!authed || !this.initialized) return;
      void q;
      this.load(true);
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

  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
    }
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
        this.loadRowMeta(rows);
        this.loading.set(false);
      });
  }

  private loadRowMeta(rows: { product: ProductResponseDto; quantity: number }[]): void {
    const products = rows.map((r) => r.product);
    if (products.length === 0) {
      this.imageUrls.set(new Map());
      return;
    }
    const imageRequests = products.map((p) => {
      const key = p.mainImageKey?.trim();
      if (!key) return of(null);
      return this.mediaUrlCache.getUrl(key).pipe(catchError(() => of(null)));
    });
    forkJoin(imageRequests).subscribe((urls) => {
      const next = new Map<string, string | null>();
      products.forEach((p, i) => next.set(p.id, urls[i] ?? null));
      this.imageUrls.set(next);
    });
    this.brandsApi
      .getAll()
      .pipe(catchError(() => of([] as BrandResponseDto[])))
      .subscribe((list) => this.brandCatalog.set(list));
  }

  private mapCartToRows(cart: ShoppingCartDto) {
    const fromItems = computePricingFromCartItems(cart.items);
    const apiCartDiscount = Number(cart.totalCartDiscount ?? 0);
    const totalCartDiscount =
      apiCartDiscount > 0 ? apiCartDiscount : fromItems.totalCartDiscountFromLines;

    this.cartTotals.set({
      totalCatalogList: fromItems.totalCatalogList,
      totalProductDiscount: fromItems.totalProductDiscount,
      subtotalAfterProductPromotions: fromItems.subtotalAfterProductPromotions,
      totalCartDiscount,
      totalPayable: Number(cart.totalPayable ?? 0),
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

  productName(p: ProductResponseDto): string {
    return productLocalizedName(p, this.lang());
  }

  productBrand(p: ProductResponseDto): string | null {
    const b = this.brandCatalog().find((x) => x.id === p.brandId);
    return b ? brandLocalizedName(b, this.lang()) : null;
  }

  productImageUrl(productId: string): string | null {
    return this.imageUrls().get(productId) ?? null;
  }

  lineCurrentPrice(p: ProductResponseDto): number {
    return p.discountedPrice != null ? p.discountedPrice : p.price;
  }

  lineHasDiscount(p: ProductResponseDto): boolean {
    return p.discountedPrice != null && p.discountedPrice < p.price;
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
