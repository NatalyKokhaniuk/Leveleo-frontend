import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { DocumentTitleService } from '../../../core/services/document-title.service';
import { FavoritesStateService } from '../../../core/favorites/favorites-state.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { CategoryService } from '../../../features/categories/category.service';
import { ProductService } from '../../../features/products/product.service';
import { defaultProductFilter } from '../../../features/products/product-filter.encode';
import { productLocalizedName } from '../../../features/products/product-display-i18n';
import { ProductResponseDto, ProductSortBy } from '../../../features/products/product.types';
import { ProductCommerceToolbarComponent } from '../product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductCardComponent } from '../product-card/product-card.component';
import { ProductDetailTabsComponent } from '../product-detail-tabs/product-detail-tabs.component';
import {
  ProductQuickViewDialogComponent,
  ProductQuickViewDialogData,
} from '../product-quick-view-dialog/product-quick-view-dialog.component';
import {
  dedupeProductsById,
  findRootCategoryId,
  randomSample,
} from './product-page-recommendations.util';

/** Слот у треку каруселі (унікальний trackId для @for). */
type RecTrackSlot = { trackId: string; product: ProductResponseDto };

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
    ProductCardComponent,
  ],
  templateUrl: './product-page.html',
  styleUrl: './product-page.scss',
})
export class ProductPage implements OnInit {
  private route = inject(ActivatedRoute);
  private products = inject(ProductService);
  private categoriesApi = inject(CategoryService);
  private favorites = inject(FavoritesStateService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private documentTitle = inject(DocumentTitleService);

  /** Viewport каруселі (ширина для розрахунку цілих карток). */
  recViewport = viewChild<ElementRef<HTMLElement>>('recViewport');

  readonly recGapPx = 16;
  readonly recMinCardPx = 200;

  /** Скільки карток одночасно видно (цілі, без обрізання). */
  recVisibleCount = signal(1);

  /** Ширина однієї картки в px (однакова для всіх у ряду). */
  recCardWidthPx = signal(220);

  /**
   * Усі товари вміщуються в один ряд без прокрутки (n ≤ visible).
   */
  recAllFit = computed(() => {
    const n = this.recommendedProducts().length;
    const v = this.recVisibleCount();
    return n > 0 && n <= v;
  });

  /**
   * Потрібна безкінечна карусель (більше товарів, ніж видимих місць).
   */
  recCarouselMode = computed(() => {
    const n = this.recommendedProducts().length;
    const v = this.recVisibleCount();
    return n > v && v >= 1;
  });

  /**
   * Зсув у кроках «одна картка»: 0 … n−1, n — той самий кадр що 0 (для петлі).
   */
  recPos = signal(0);

  /** Без анімації при миттєвому стрибку петлі. */
  recSkipTransition = signal(false);

  recTrackSlots = computed((): RecTrackSlot[] => {
    const items = this.recommendedProducts();
    if (items.length === 0) return [];
    if (this.recAllFit()) {
      return items.map((p, i) => ({ trackId: `fit-${i}-${p.id}`, product: p }));
    }
    return [...items, ...items].map((p, i) => ({
      trackId: `dup-${i}-${p.id}`,
      product: p,
    }));
  });

  /** Активна крапка: 0 … n−1 (позиція n еквівалентна 0). */
  activeRecDot = computed(() => {
    const n = this.recommendedProducts().length;
    if (n === 0) return 0;
    const p = this.recPos();
    const logical = p >= n ? p % n : p;
    return logical % n;
  });

  /** Мова для {@link productLocalizedName}. */
  private lang = signal(this.translate.currentLang || 'uk');

  loading = signal(true);
  loadError = signal(false);
  product = signal<ProductResponseDto | null>(null);
  favoriteBusy = signal(false);
  canManageProduct = computed(() => this.auth.hasAnyRole(['Admin', 'Moderator']));

  recommendedProducts = signal<ProductResponseDto[]>([]);

  private recResizeObserver: ResizeObserver | null = null;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.teardownRecResizeObserver());

    effect(() => {
      const p = this.product();
      if (!p) return;
      this.documentTitle.setLeveleoPage(this.productTitle(p));
    });

    this.route.paramMap
      .pipe(
        switchMap((pm) => {
          const slug = pm.get('productSlug')?.trim();
          if (!slug) {
            this.loading.set(false);
            this.loadError.set(true);
            this.product.set(null);
            return of(null);
          }
          this.loading.set(true);
          this.loadError.set(false);
          return this.products.getBySlug(slug);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (p) => {
          this.loading.set(false);
          if (!p) {
            this.loadError.set(true);
            this.product.set(null);
            return;
          }
          this.product.set(p);
          this.loadYouMayAlsoLike(p);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
          this.product.set(null);
        },
      });
  }

  productTitle(p: ProductResponseDto): string {
    return productLocalizedName(p, this.lang());
  }

  isFavorite(p: ProductResponseDto): boolean {
    return this.favorites.favoriteIds().has(p.id);
  }

  toggleFavorite(p: ProductResponseDto): void {
    if (this.favoriteBusy()) return;
    this.favoriteBusy.set(true);
    this.favorites.toggleFavorite(p.id).subscribe({
      next: () => this.favoriteBusy.set(false),
      error: () => this.favoriteBusy.set(false),
    });
  }

  favoriteRecommended(id: string): boolean {
    return this.favorites.favoriteIds().has(id);
  }

  toggleFavoriteRecommended(id: string): void {
    this.favorites.toggleFavorite(id).subscribe();
  }

  /** translateX у px: один крок = ширина картки + gap. */
  recTranslatePx(): number {
    const n = this.recommendedProducts().length;
    if (n === 0) return 0;
    const step = this.recCardWidthPx() + this.recGapPx;
    return this.recPos() * step;
  }

  recScrollNext(): void {
    const n = this.recommendedProducts().length;
    const v = this.recVisibleCount();
    if (n === 0 || n <= v) return;
    const p = this.recPos();
    if (p < n - 1) {
      this.recSkipTransition.set(false);
      this.recPos.set(p + 1);
    } else if (p === n - 1) {
      this.recSkipTransition.set(false);
      this.recPos.set(n);
    }
  }

  recScrollPrev(): void {
    const n = this.recommendedProducts().length;
    const v = this.recVisibleCount();
    if (n === 0 || n <= v) return;
    const p = this.recPos();
    if (p === 0) {
      this.recSkipTransition.set(true);
      this.recPos.set(n);
      requestAnimationFrame(() => {
        this.recSkipTransition.set(false);
        this.recPos.set(n - 1);
      });
    } else {
      this.recSkipTransition.set(false);
      this.recPos.set(p - 1);
    }
  }

  onRecTrackTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName !== 'transform') return;
    if (event.target !== event.currentTarget) return;
    const n = this.recommendedProducts().length;
    if (n === 0) return;
    if (this.recPos() === n) {
      this.recSkipTransition.set(true);
      this.recPos.set(0);
      requestAnimationFrame(() => this.recSkipTransition.set(false));
    }
  }

  goToRecSlide(i: number): void {
    const n = this.recommendedProducts().length;
    const v = this.recVisibleCount();
    if (n === 0 || n <= v) return;
    if (i < 0 || i >= n) return;
    this.recSkipTransition.set(true);
    this.recPos.set(i);
    requestAnimationFrame(() => this.recSkipTransition.set(false));
  }

  openRecommendedQuickView(product: ProductResponseDto): void {
    this.dialog.open<ProductQuickViewDialogComponent, ProductQuickViewDialogData>(
      ProductQuickViewDialogComponent,
      {
        panelClass: ['auth-dialog', 'product-quick-view-panel'],
        width: 'min(96vw - 24px, 1040px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'min(88vh, 820px)',
        maxHeight: 'min(88vh, calc(100vh - 24px))',
        autoFocus: false,
        data: { product },
      },
    );
  }

  /**
   * До 12 товарів: з кореневої категорії (якщо у каталозі таких >7 — 6 випадкових; інакше всі інші),
   * решта з того ж бренду (випадково).
   */
  private loadYouMayAlsoLike(p: ProductResponseDto): void {
    this.recommendedProducts.set([]);
    this.categoriesApi
      .getAll()
      .pipe(
        take(1),
        catchError(() => of([])),
        switchMap((categories) => {
          const rootId = findRootCategoryId(p.categoryId, categories);
          if (!rootId) {
            return this.fetchBrandFill(p, [], 12);
          }
          return this.products
            .getPaged(
              defaultProductFilter({
                includeInactive: false,
                categoryId: rootId,
                page: 1,
                pageSize: 1,
                sortBy: ProductSortBy.PriceAsc,
              }),
            )
            .pipe(
              catchError(() => of({ totalCount: 0, items: [] })),
              switchMap((r0) => {
                const total = r0.totalCount ?? 0;
                if (total === 0) {
                  return this.fetchBrandFill(p, [], 12);
                }
                const fetchSize = Math.min(total, 500);
                return this.products
                  .getPaged(
                    defaultProductFilter({
                      includeInactive: false,
                      categoryId: rootId,
                      page: 1,
                      pageSize: fetchSize,
                      sortBy: ProductSortBy.PriceAsc,
                    }),
                  )
                  .pipe(
                    catchError(() => of({ items: [] as ProductResponseDto[] })),
                    switchMap((r1) => {
                      const pool = (r1.items ?? []).filter((x) => x.id !== p.id);
                      let fromCat: ProductResponseDto[];
                      if (total > 7) {
                        fromCat = randomSample(pool, Math.min(6, pool.length));
                      } else {
                        fromCat = pool;
                      }
                      const need = 12 - fromCat.length;
                      return this.fetchBrandFill(p, fromCat, need);
                    }),
                  );
              }),
            );
        }),
        catchError(() => of([] as ProductResponseDto[])),
        finalize(() => {
          if (isPlatformBrowser(this.platformId)) {
            afterNextRender(
              () => {
                this.recPos.set(0);
                this.setupRecResizeObserver();
                this.updateRecLayout();
              },
              { injector: this.injector },
            );
          }
        }),
      )
      .subscribe((list) => {
        this.recommendedProducts.set(dedupeProductsById(list).slice(0, 12));
      });
  }

  private setupRecResizeObserver(): void {
    this.teardownRecResizeObserver();
    if (!isPlatformBrowser(this.platformId)) return;
    const el = this.recViewport()?.nativeElement;
    if (!el) return;
    this.recResizeObserver = new ResizeObserver(() => this.updateRecLayout());
    this.recResizeObserver.observe(el);
  }

  private teardownRecResizeObserver(): void {
    if (this.recResizeObserver) {
      this.recResizeObserver.disconnect();
      this.recResizeObserver = null;
    }
  }

  private updateRecLayout(): void {
    const el = this.recViewport()?.nativeElement;
    const n = this.recommendedProducts().length;
    if (!el || n === 0) return;
    const W = el.clientWidth;
    if (W < 1) return;
    const gap = this.recGapPx;

    let v = 6;
    while (v > 1) {
      const cw = (W - (v - 1) * gap) / v;
      if (cw >= this.recMinCardPx) break;
      v--;
    }
    v = Math.max(1, v);

    if (n <= v) {
      this.recVisibleCount.set(n);
      this.recCardWidthPx.set((W - (n - 1) * gap) / n);
      this.recPos.set(0);
    } else {
      this.recVisibleCount.set(v);
      this.recCardWidthPx.set((W - (v - 1) * gap) / v);
      this.recPos.update((p) => Math.min(p, n));
    }
  }

  private fetchBrandFill(
    p: ProductResponseDto,
    already: ProductResponseDto[],
    need: number,
  ) {
    if (need <= 0) {
      return of(dedupeProductsById(already).slice(0, 12));
    }
    const exclude = new Set<string>([p.id, ...already.map((x) => x.id)]);
    const pageSize = Math.min(500, Math.max(need * 8, 48));
    return this.products
      .getPaged(
        defaultProductFilter({
          includeInactive: false,
          brandId: p.brandId,
          categoryId: null,
          page: 1,
          pageSize,
          sortBy: ProductSortBy.PriceAsc,
        }),
      )
      .pipe(
        catchError(() => of({ items: [] as ProductResponseDto[] })),
        map((r) => {
          const pool = (r.items ?? []).filter((x) => !exclude.has(x.id));
          const picked = randomSample(pool, Math.min(need, pool.length));
          return dedupeProductsById([...already, ...picked]).slice(0, 12);
        }),
      );
  }
}
