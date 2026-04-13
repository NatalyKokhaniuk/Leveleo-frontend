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
import {
  formatAppliedPromotionBadgeLabel,
  formatCartLevelPromotionChip,
  formatPromotionDiscountSuffix,
} from '../../features/promotions/promotion-badge-label.util';
import { cartAppliedPromotionDisplayName } from '../../features/promotions/promotion-display-i18n';
import {
  buildCartLineView,
  computePricingFromCartItems,
} from '../../features/shopping-cart/cart-pricing.util';
import { CartLineView, ShoppingCartDto } from '../../features/shopping-cart/shopping-cart.types';
import type { PromotionTranslationDto } from '../../features/promotions/promotion.types';
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
  /** Порядок як у відповіді кошика; ціни за одиницю з рядка GET /me. */
  lines = signal<CartLineView[]>([]);
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
    promoSlug: string | null;
    promoTranslations: PromotionTranslationDto[] | null;
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

  /** Назви товарів, що зникли з кошика порівняно з попереднім знімком (sessionStorage). */
  removedCartItemsNotice = signal<string[]>([]);

  private readonly CART_SNAPSHOT_STORAGE_KEY = 'leveleo.cart.snapshot.v1';

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
          return of([] as CartLineView[]);
        }),
      )
      .subscribe((rows) => {
        this.lines.set(rows);
        this.loadRowMeta(rows);
        this.loading.set(false);
        if (!this.loadError()) {
          this.syncRemovedCartNotice(rows);
        }
      });
  }

  private loadRowMeta(rows: CartLineView[]): void {
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

    /**
     * Повна ціна / після товарних акцій / товарна знижка — лише з рядків (it.price, priceAfterProductPromotion),
     * щоб не зрівнювати «Повна» і «Після товарів», коли API дає totalProductDiscount = 0 при наявних line-полях.
     * Знижка кошика та totalPayable — з бекенду, якщо передано.
     */
    const apiCartDisc = cart.totalCartDiscount;
    const apiPayable = cart.totalPayable;

    let totalCartDiscount = fromItems.totalCartDiscountFromLines;
    if (apiCartDisc != null && Number.isFinite(Number(apiCartDisc)) && Number(apiCartDisc) >= 0) {
      totalCartDiscount = Number(apiCartDisc);
    }

    let totalPayable = Math.max(0, fromItems.subtotalAfterProductPromotions - totalCartDiscount);
    if (apiPayable != null && Number.isFinite(Number(apiPayable))) {
      totalPayable = Number(apiPayable);
    }

    const acp = cart.appliedCartPromotion;
    this.cartTotals.set({
      totalCatalogList: fromItems.totalCatalogList,
      totalProductDiscount: fromItems.totalProductDiscount,
      subtotalAfterProductPromotions: fromItems.subtotalAfterProductPromotions,
      totalCartDiscount,
      totalPayable,
      promoName: acp?.name?.trim() || null,
      promoSlug: acp?.slug?.trim() || null,
      promoTranslations: acp?.translations ?? null,
      promoDiscountType: acp?.discountType ?? null,
      promoDiscountValue: acp?.discountValue ?? null,
    });
    this.couponCode.set(String(cart.couponCode ?? ''));
    const raw = cart.items ?? [];
    if (raw.length === 0) {
      return of([] as CartLineView[]);
    }
    const ready = raw
      .map((it) => {
        const product = it.product;
        if (!product) return null;
        if (!product.isActive) return null;
        return buildCartLineView(it, product);
      })
      .filter((row): row is CartLineView => row != null);
    if (ready.length === raw.length) {
      return of(ready);
    }
    return forkJoin(
      raw.map((it) =>
        this.products.getById(String(it.productId ?? it.product?.id ?? '')).pipe(
          map((p) => buildCartLineView(it, p)),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(
      map((list) =>
        list.filter((row): row is CartLineView => row != null && row.product.isActive),
      ),
    );
  }

  hasCartPromotion(): boolean {
    const t = this.cartTotals();
    return !!t && t.totalCartDiscount > 0;
  }

  /** Банер зверху кошика: акція на кошик (назва + % або сума). */
  showCartPromotionBanner(): boolean {
    const t = this.cartTotals();
    if (!t) return false;
    if (t.totalCartDiscount > 0) return true;
    const name = cartAppliedPromotionDisplayName(
      {
        name: t.promoName,
        slug: t.promoSlug,
        translations: t.promoTranslations,
      },
      this.lang(),
    ).trim();
    return name.length > 0;
  }

  cartPromotionTitle(): string {
    const t = this.cartTotals();
    if (!t) return '';
    return cartAppliedPromotionDisplayName(
      {
        name: t.promoName,
        slug: t.promoSlug,
        translations: t.promoTranslations,
      },
      this.lang(),
    );
  }

  /** Відсоток або фіксована знижка (рядок без мінуса — додається в шаблоні). */
  cartPromotionDiscountLabel(): string | null {
    const t = this.cartTotals();
    if (!t) return null;
    return formatPromotionDiscountSuffix(t.promoDiscountType, t.promoDiscountValue);
  }

  cartPromotionSlug(): string | null {
    const s = this.cartTotals()?.promoSlug?.trim();
    return s || null;
  }

  promoLabel(): string {
    const t = this.cartTotals();
    if (!t) {
      return '';
    }
    return formatCartLevelPromotionChip(
      {
        promoName: t.promoName,
        promoSlug: t.promoSlug,
        promoTranslations: t.promoTranslations,
        promoDiscountType: t.promoDiscountType,
        promoDiscountValue: t.promoDiscountValue,
      },
      this.lang(),
    );
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

  /** Сторінка оформлення замовлення (`/order-checkout`). */
  goToOrderCheckout(): void {
    this.router.navigate(['/order-checkout']);
  }

  dismissRemovedCartNotice(): void {
    this.removedCartItemsNotice.set([]);
  }

  private readCartSnapshotFromSession(): Record<string, string> {
    try {
      const raw = sessionStorage.getItem(this.CART_SNAPSHOT_STORAGE_KEY);
      if (!raw) return {};
      const p = JSON.parse(raw) as { names?: Record<string, string> };
      return p.names ?? {};
    } catch {
      return {};
    }
  }

  private writeCartSnapshotToSession(rows: CartLineView[]): void {
    const lang = this.lang();
    const names: Record<string, string> = {};
    for (const r of rows) {
      names[r.product.id] = productLocalizedName(r.product, lang);
    }
    try {
      sessionStorage.setItem(this.CART_SNAPSHOT_STORAGE_KEY, JSON.stringify({ names }));
    } catch {
      /* ignore quota / private mode */
    }
  }

  /**
   * Порівнюємо поточні позиції з останнім знімком у sessionStorage: якщо id зник —
   * товар прибрали з кошика (бекенд або користувач), показуємо банер з назвами.
   */
  private syncRemovedCartNotice(rows: CartLineView[]): void {
    const prevNames = this.readCartSnapshotFromSession();
    const currIds = new Set(rows.map((r) => r.product.id));
    const removed: string[] = [];
    for (const [id, name] of Object.entries(prevNames)) {
      if (!currIds.has(id)) {
        removed.push((name && name.trim()) || id);
      }
    }
    this.writeCartSnapshotToSession(rows);
    this.removedCartItemsNotice.set(removed);
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

  /** Фінальна ціна за одиницю (після товарної та кошикової знижки на рядок). */
  lineUnitFinal(row: CartLineView): number {
    return row.unitAfterCartPromotion;
  }

  /**
   * Закреслення базової ціни — лише якщо є **товарна** акція (до знижки кошика).
   * Чисто кошикова знижка не закреслює вітринну ціну в картці рядка.
   */
  lineHasProductLevelDiscount(row: CartLineView): boolean {
    return row.unitAfterProductPromotion < row.unitListPrice - 0.01;
  }

  linePromotionLabel(p: ProductResponseDto): string | null {
    return formatAppliedPromotionBadgeLabel(p.appliedPromotion, this.lang());
  }

  linePromotionSlug(p: ProductResponseDto): string | null {
    const slug = p.appliedPromotion?.slug?.trim();
    return slug || null;
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
