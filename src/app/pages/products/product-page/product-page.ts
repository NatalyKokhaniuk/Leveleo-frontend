import {
  afterNextRender,
  Component,
  DestroyRef,
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
import { FavoritesStateService } from '../../../core/favorites/favorites-state.service';
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
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  /** Горизонтальний скрол «You may also like». */
  recScroller = viewChild<ElementRef<HTMLElement>>('recScroller');

  /** Індекс активної точки (вирівнювання зліва по кроку скролу). */
  activeRecDot = signal(0);

  private recAutoPaused = false;
  private recAutoIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Мова для {@link productLocalizedName}. */
  private lang = signal(this.translate.currentLang || 'uk');

  loading = signal(true);
  loadError = signal(false);
  product = signal<ProductResponseDto | null>(null);
  favoriteBusy = signal(false);

  recommendedLoading = signal(false);
  recommendedProducts = signal<ProductResponseDto[]>([]);

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.stopRecAutoSlide());

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

  pauseRecCarousel(): void {
    this.recAutoPaused = true;
  }

  resumeRecCarousel(): void {
    this.recAutoPaused = false;
  }

  onRecScroll(): void {
    const el = this.recScroller()?.nativeElement;
    if (!el) return;
    const step = this.getRecScrollStep(el);
    if (step <= 0) return;
    const idx = Math.round(el.scrollLeft / step);
    const maxIdx = Math.max(0, this.recommendedProducts().length - 1);
    this.activeRecDot.set(Math.min(Math.max(0, idx), maxIdx));
  }

  goToRecSlide(i: number): void {
    const el = this.recScroller()?.nativeElement;
    if (!el) return;
    const step = this.getRecScrollStep(el);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const target = Math.min(i * step, maxScroll);
    el.scrollTo({ left: target, behavior: 'smooth' });
  }

  recScrollNext(): void {
    const el = this.recScroller()?.nativeElement;
    if (!el) return;
    const step = this.getRecScrollStep(el);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll < 2) return;
    if (el.scrollLeft + el.clientWidth >= maxScroll - 2) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: step, behavior: 'smooth' });
    }
  }

  recScrollPrev(): void {
    const el = this.recScroller()?.nativeElement;
    if (!el) return;
    const step = this.getRecScrollStep(el);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (maxScroll < 2) return;
    if (el.scrollLeft <= 2) {
      el.scrollTo({ left: maxScroll, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: -step, behavior: 'smooth' });
    }
  }

  private getRecScrollStep(scroller: HTMLElement): number {
    const item = scroller.querySelector('.product-rec-carousel__item') as HTMLElement | null;
    if (!item) return 0;
    const styles = getComputedStyle(scroller);
    const gapRaw = styles.columnGap || styles.gap || '16px';
    const gap = Number.parseFloat(gapRaw) || 16;
    return item.offsetWidth + gap;
  }

  private startRecAutoSlide(): void {
    this.stopRecAutoSlide();
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.recommendedProducts().length <= 1) return;
    this.recAutoIntervalId = setInterval(() => {
      if (!this.recAutoPaused) {
        this.recScrollNext();
      }
    }, 5000);
  }

  private stopRecAutoSlide(): void {
    if (this.recAutoIntervalId != null) {
      clearInterval(this.recAutoIntervalId);
      this.recAutoIntervalId = null;
    }
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
    this.stopRecAutoSlide();
    this.recommendedLoading.set(true);
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
          this.recommendedLoading.set(false);
          if (isPlatformBrowser(this.platformId)) {
            afterNextRender(
              () => {
                const el = this.recScroller()?.nativeElement;
                if (el) el.scrollLeft = 0;
                this.startRecAutoSlide();
              },
              { injector: this.injector },
            );
          }
        }),
      )
      .subscribe((list) => {
        this.recommendedProducts.set(dedupeProductsById(list).slice(0, 12));
        this.activeRecDot.set(0);
      });
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
