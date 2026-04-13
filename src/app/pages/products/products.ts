import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, combineLatest, finalize, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { BrandService } from '../../features/brands/brand.service';
import { BrandResponseDto } from '../../features/brands/brand.types';
import { brandLocalizedName } from '../../features/brands/brand-display-i18n';
import { CategoryService } from '../../features/categories/category.service';
import { CategoryResponseDto } from '../../features/categories/category.types';
import {
  categoryLocalizedDescription,
  categoryLocalizedName,
} from '../../features/categories/category-display-i18n';
import { MediaUrlCacheService } from '../../core/services/media-url-cache.service';
import { ProductCatalogStateService } from '../../features/products/product-catalog.state';
import { defaultProductFilter } from '../../features/products/product-filter.encode';
import { ProductResponseDto, ProductSortBy } from '../../features/products/product.types';
import { ProductCardComponent } from './product-card/product-card.component';
import {
  ProductQuickViewDialogComponent,
  ProductQuickViewDialogData,
} from './product-quick-view-dialog/product-quick-view-dialog.component';
import { FavoritesStateService } from '../../core/favorites/favorites-state.service';
import {
  promotionLocalizedDescription,
  promotionLocalizedName,
} from '../../features/promotions/promotion-display-i18n';
import { PromotionService } from '../../features/promotions/promotion.service';
import { PromotionResponseDto } from '../../features/promotions/promotion.types';

function parseOptionalFloat(s: string): number | null {
  const t = s.trim();
  if (!t) {
    return null;
  }
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    RouterLink,
    ProductCardComponent,
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit {
  private catalogState = inject(ProductCatalogStateService);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private favorites = inject(FavoritesStateService);
  private mediaUrlCache = inject(MediaUrlCacheService);
  private promotionsApi = inject(PromotionService);

  loading = signal(true);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);
  totalCount = signal(0);
  /** 1-based, синхронізується з query `page`. */
  currentPage = signal(1);
  readonly pageSize = 24;
  /** Фільтри за замовчуванням згорнуті; можна розгорнути. */
  filtersExpanded = signal(false);

  /** Дзеркало query / slug-маршруту */
  categoryId = signal<string | null>(null);
  brandId = signal<string | null>(null);
  sortBy = signal<ProductSortBy>(ProductSortBy.PriceAsc);
  priceFromStr = signal('');
  priceToStr = signal('');
  promotionId = signal<string | null>(null);
  /** Лише товари з акцією; у URL як `onSale=1`. */
  onlyPromotional = signal(false);

  /** Slug з маршруту `/products/brand/:slug` та `/products/category/:slug`. */
  routeBrandSlug = signal<string | null>(null);
  routeCategorySlug = signal<string | null>(null);
  /** Slug з `/products/promotion/:promotionSlug` — для канонічних посилань без `?promotionId=`. */
  routePromotionSlug = signal<string | null>(null);

  headerTitle = signal('');
  headerSubtitle = signal<string | null>(null);
  headerImageUrl = signal<string | null>(null);
  headerLoading = signal(false);
  breadcrumbs = signal<
    { label: string; link: string[] | null; queryParams?: Record<string, string> }[]
  >([]);

  /**
   * Коренева категорія + плоский список нащадків — лише на `/products` без slug-категорії.
   * На `/products/category/:slug` замість цього показується вибір лише серед прямих дочірніх категорій.
   */
  hideRootCategoryFilters = computed(() => !!this.routeCategorySlug() || !!this.promotionId());
  hideBrandFilter = computed(() => !!this.routeBrandSlug() || !!this.promotionId());

  /** Прямі дочірні категорії для поточної категорії з маршруту (наступний рівень вкладеності). */
  routeCategoryDirectChildren = computed(() => {
    const lang = this.lang();
    if (!this.routeCategorySlug() || this.promotionId()) {
      return [] as CategoryResponseDto[];
    }
    const parent = this.allCategories().find((c) => c.slug === this.routeCategorySlug());
    if (!parent?.id) {
      return [];
    }
    return this.allCategories()
      .filter((c) => c.isActive && c.parentId === parent.id)
      .sort((a, b) =>
        categoryLocalizedName(a, lang).localeCompare(categoryLocalizedName(b, lang)),
      );
  });

  showRouteCategoryChildFilter = computed(() => this.routeCategoryDirectChildren().length > 0);

  filterCategories = signal<CategoryResponseDto[]>([]);
  allCategories = signal<CategoryResponseDto[]>([]);
  brands = signal<BrandResponseDto[]>([]);
  lang = signal(this.translate.currentLang || 'uk');
  rootCategoryId = signal<string | null>(null);
  subCategoryId = signal<string | null>(null);
  private nestedIndent = new Map<string, number>();
  nestedCategoryOptions = computed(() => {
    const rootId = this.rootCategoryId();
    const all = this.allCategories();
    this.nestedIndent = new Map<string, number>();
    if (!rootId) return [] as CategoryResponseDto[];

    const byParent = new Map<string | null, CategoryResponseDto[]>();
    for (const c of all) {
      const key = c.parentId ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(c);
      byParent.set(key, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => this.categoryLabel(a).localeCompare(this.categoryLabel(b)));
    }

    const result: CategoryResponseDto[] = [];
    const pushChildren = (parentId: string, level: number): void => {
      for (const c of byParent.get(parentId) ?? []) {
        result.push(c);
        this.nestedIndent.set(c.id, level);
        pushChildren(c.id, level + 1);
      }
    };
    pushChildren(rootId, 1);
    return result;
  });

  readonly ProductSortBy = ProductSortBy;

  private brandsCatalogResolved = false;
  private categoriesCatalogResolved = false;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
      this.loadContextHeader();
    });

    this.categoryService.getAll().subscribe({
      next: (list) => {
        const active = list.filter((c) => c.isActive);
        const roots = active
          .filter((c) => c.parentId == null || String(c.parentId).trim() === '')
          .sort((a, b) => a.name.localeCompare(b.name));
        this.allCategories.set(active);
        this.filterCategories.set(roots);
        this.categoriesCatalogResolved = true;
        this.refreshFromRoute();
      },
      error: () => {
        this.allCategories.set([]);
        this.filterCategories.set([]);
        this.categoriesCatalogResolved = true;
        this.refreshFromRoute();
      },
    });

    this.brandService.getAll().subscribe({
      next: (list) => {
        this.brands.set([...list].sort((a, b) => a.name.localeCompare(b.name)));
        this.brandsCatalogResolved = true;
        this.refreshFromRoute();
      },
      error: () => {
        this.brands.set([]);
        this.brandsCatalogResolved = true;
        this.refreshFromRoute();
      },
    });

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshFromRoute());
  }

  /** sort / price з query (спільно для всіх маршрутів). */
  private applySortAndPriceFromQuery(query: ParamMap): void {
    const sort = query.get('sort');
    if (sort !== null && sort !== '') {
      const n = parseInt(sort, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 3) {
        this.sortBy.set(n as ProductSortBy);
      }
    } else {
      this.sortBy.set(ProductSortBy.PriceAsc);
    }
    this.priceFromStr.set(query.get('priceFrom') ?? '');
    this.priceToStr.set(query.get('priceTo') ?? '');
  }

  private applyPageFromQuery(query: ParamMap): void {
    const raw = query.get('page');
    if (raw != null && raw !== '') {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n >= 1) {
        this.currentPage.set(n);
        return;
      }
    }
    this.currentPage.set(1);
  }

  private auxQueryFrom(
    query: ParamMap,
    opts?: { omitPromotionId?: boolean },
  ): Record<string, string | null> {
    const o: Record<string, string | null> = {};
    const s = query.get('sort');
    const pf = query.get('priceFrom');
    const pt = query.get('priceTo');
    const promo = opts?.omitPromotionId ? null : query.get('promotionId');
    const pg = query.get('page');
    const onSale = query.get('onSale');
    if (s !== null && s !== '') {
      o['sort'] = s;
    }
    if (pf !== null && pf !== '') {
      o['priceFrom'] = pf;
    }
    if (pt !== null && pt !== '') {
      o['priceTo'] = pt;
    }
    if (promo !== null && promo !== '') {
      o['promotionId'] = promo;
    }
    if (onSale === '1' || onSale === 'true') {
      o['onSale'] = '1';
    }
    if (pg !== null && pg !== '') {
      const n = parseInt(pg, 10);
      if (!Number.isNaN(n) && n > 1) {
        o['page'] = pg;
      }
    }
    return o;
  }

  /** `/products?brandId=` або `?categoryId=` → канонічний slug-шлях, якщо лиш один тип фільтра. */
  private maybeCanonicalizeUrl(params: ParamMap, query: ParamMap): boolean {
    if (params.get('brandSlug') || params.get('categorySlug') || params.get('promotionSlug')) {
      return false;
    }
    const qBrand = query.get('brandId');
    const qCat = query.get('categoryId');
    if (qBrand && qCat) {
      return false;
    }
    if (qBrand && !qCat && this.brands().length > 0) {
      const b = this.brands().find((x) => x.id === qBrand);
      if (b?.slug) {
        this.router.navigate(['/products', 'brand', b.slug], {
          queryParams: this.auxQueryFrom(query),
          replaceUrl: true,
        });
        return true;
      }
    }
    if (qCat && !qBrand && this.filterCategories().length > 0) {
      const c = this.allCategories().find((x) => x.id === qCat);
      if (c?.slug) {
        this.router.navigate(['/products', 'category', c.slug], {
          queryParams: this.auxQueryFrom(query),
          replaceUrl: true,
        });
        return true;
      }
    }
    return false;
  }

  /** Суміш фільтрів на slug-сторінці → `/products?...` */
  private maybeResolveSlugConflicts(params: ParamMap, query: ParamMap): boolean {
    if (params.get('promotionSlug')) {
      return false;
    }
    const bs = params.get('brandSlug');
    const cs = params.get('categorySlug');
    const qBrand = query.get('brandId');
    const qCat = query.get('categoryId');

    if (bs && qCat && this.brands().length > 0) {
      const b = this.brands().find((x) => x.slug === bs);
      if (b) {
        const q: Record<string, string | null> = {
          brandId: b.id,
          categoryId: qCat,
          ...this.auxQueryFrom(query),
        };
        this.router.navigate(['/products'], { queryParams: q, replaceUrl: true });
        return true;
      }
    }
    if (cs && qBrand && this.filterCategories().length > 0) {
      const c = this.allCategories().find((x) => x.slug === cs);
      if (c) {
        const q: Record<string, string | null> = {
          brandId: qBrand,
          categoryId: c.id,
          ...this.auxQueryFrom(query),
        };
        this.router.navigate(['/products'], { queryParams: q, replaceUrl: true });
        return true;
      }
    }
    return false;
  }

  private maybeRedirectInvalidSlug(params: ParamMap, query: ParamMap): boolean {
    if (params.get('promotionSlug')) {
      return false;
    }
    const bs = params.get('brandSlug');
    if (bs && this.brands().length > 0) {
      const b = this.brands().find((x) => x.slug === bs);
      if (!b) {
        this.router.navigate(['/products'], { queryParams: this.auxQueryFrom(query), replaceUrl: true });
        return true;
      }
    }
    const cs = params.get('categorySlug');
    if (cs && this.filterCategories().length > 0) {
      const c = this.allCategories().find((x) => x.slug === cs);
      if (!c) {
        this.router.navigate(['/products'], { queryParams: this.auxQueryFrom(query), replaceUrl: true });
        return true;
      }
    }
    return false;
  }

  private applyFromRoute(
    params: ParamMap,
    query: ParamMap,
    promotionIdEffective: string | null,
  ): void {
    let brandId: string | null = null;
    let categoryId: string | null = null;

    const bs = params.get('brandSlug');
    const cs = params.get('categorySlug');

    if (bs) {
      const b = this.brands().find((x) => x.slug === bs);
      brandId = b?.id ?? null;
    } else {
      brandId = query.get('brandId');
    }

    if (cs) {
      const c = this.allCategories().find((x) => x.slug === cs);
      categoryId = c?.id ?? null;
    } else {
      categoryId = query.get('categoryId');
    }

    this.brandId.set(brandId);
    this.categoryId.set(categoryId);
    this.promotionId.set(promotionIdEffective);
    if (this.promotionId()) {
      this.onlyPromotional.set(false);
    } else {
      const onSale = query.get('onSale');
      this.onlyPromotional.set(onSale === '1' || onSale === 'true');
    }
    this.syncCategorySelectors(categoryId);
    this.applySortAndPriceFromQuery(query);
    this.applyPageFromQuery(query);
  }

  private syncCategorySelectors(categoryId: string | null): void {
    if (!categoryId) {
      this.rootCategoryId.set(null);
      this.subCategoryId.set(null);
      return;
    }
    const all = this.allCategories();
    const byId = new Map(all.map((c) => [c.id, c]));
    let cur = byId.get(categoryId) ?? null;
    if (!cur) {
      this.rootCategoryId.set(null);
      this.subCategoryId.set(null);
      return;
    }
    while (cur?.parentId) {
      const p = byId.get(cur.parentId);
      if (!p) break;
      cur = p;
    }
    const rootId = cur?.id ?? null;
    this.rootCategoryId.set(rootId);
    this.subCategoryId.set(rootId === categoryId ? null : categoryId);
  }

  private refreshFromRoute(): void {
    const params = this.route.snapshot.paramMap;
    const query = this.route.snapshot.queryParamMap;

    this.routeBrandSlug.set(params.get('brandSlug'));
    this.routeCategorySlug.set(params.get('categorySlug'));
    const promoSlugParam = params.get('promotionSlug');
    this.routePromotionSlug.set(promoSlugParam);

    const promoIdFromQuery = query.get('promotionId')?.trim() ?? null;

    /** `?promotionId=` → `/products/promotion/{slug}` (канонічна адреса). */
    if (!promoSlugParam && promoIdFromQuery) {
      this.promotionsApi
        .getById(promoIdFromQuery)
        .pipe(take(1), catchError(() => of(null)))
        .subscribe((p) => {
          const slug = p?.slug?.trim();
          if (slug) {
            this.router.navigate(['/products', 'promotion', slug], {
              queryParams: this.auxQueryFrom(query, { omitPromotionId: true }),
              replaceUrl: true,
            });
          } else {
            this.finishRefreshFromRoute(params, query, promoIdFromQuery);
          }
        });
      return;
    }

    if (promoSlugParam?.trim()) {
      this.promotionsApi
        .getBySlug(promoSlugParam.trim())
        .pipe(take(1), catchError(() => of(null)))
        .subscribe((p) => {
          if (!p?.id) {
            this.router.navigate(['/products'], {
              queryParams: this.auxQueryFrom(query, { omitPromotionId: true }),
              replaceUrl: true,
            });
            return;
          }
          this.finishRefreshFromRoute(params, query, p.id);
        });
      return;
    }

    this.finishRefreshFromRoute(params, query, promoIdFromQuery);
  }

  private finishRefreshFromRoute(
    params: ParamMap,
    query: ParamMap,
    promotionIdEffective: string | null,
  ): void {
    if (params.get('brandSlug') && !this.brandsCatalogResolved) {
      return;
    }
    if (params.get('categorySlug') && !this.categoriesCatalogResolved) {
      return;
    }

    if (this.maybeCanonicalizeUrl(params, query)) {
      return;
    }
    if (this.maybeResolveSlugConflicts(params, query)) {
      return;
    }
    if (this.maybeRedirectInvalidSlug(params, query)) {
      return;
    }
    this.applyFromRoute(params, query, promotionIdEffective);
    this.load();
    this.loadContextHeader();
  }

  private load(): void {
    this.loadError.set(false);
    const filter = defaultProductFilter({
      includeInactive: false,
      sortBy: this.sortBy(),
      page: this.currentPage(),
      pageSize: this.pageSize,
      categoryId: this.categoryId(),
      brandId: this.brandId(),
      promotionId: this.promotionId(),
      onlyWithActiveProductPromotion: this.promotionId() ? false : this.onlyPromotional(),
      priceFrom: parseOptionalFloat(this.priceFromStr()),
      priceTo: parseOptionalFloat(this.priceToStr()),
      searchQuery: null,
    });

    if (!this.catalogState.isFreshCache(filter)) {
      this.loading.set(true);
    }

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
          this.totalCount.set(res.totalCount);
        } else {
          this.items.set([]);
          this.totalCount.set(0);
        }
      });
  }

  toggleFilters(): void {
    this.filtersExpanded.update((v) => !v);
  }

  onPageChange(e: PageEvent): void {
    const next = e.pageIndex + 1;
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: this.categoryId(),
      page: next,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  categoryLabel(c: CategoryResponseDto): string {
    return categoryLocalizedName(c, this.lang());
  }

  private loadContextHeader(): void {
    const lang = this.lang();
    const cs = this.routeCategorySlug();
    const bs = this.routeBrandSlug();
    const promo = this.promotionId();

    if (cs) {
      const c = this.allCategories().find((x) => x.slug === cs);
      if (c) {
        this.headerTitle.set(categoryLocalizedName(c, lang));
        this.headerSubtitle.set(categoryLocalizedDescription(c, lang));
        this.breadcrumbs.set(this.buildCategoryBreadcrumbs(c));
        const ik = c.imageKey?.trim();
        if (ik) {
          this.mediaUrlCache.getUrl(ik).subscribe((url) => this.headerImageUrl.set(url));
        } else {
          this.headerImageUrl.set(null);
        }
      } else {
        this.clearContextHeader();
      }
      return;
    }

    if (bs) {
      const b = this.brands().find((x) => x.slug === bs);
      if (b) {
        this.headerTitle.set(brandLocalizedName(b, lang));
        this.headerSubtitle.set(b.description?.trim() || null);
        this.breadcrumbs.set(this.buildBrandBreadcrumbs(b));
        const lk = b.logoKey?.trim();
        if (lk) {
          this.mediaUrlCache.getUrl(lk).subscribe((url) => this.headerImageUrl.set(url));
        } else {
          this.headerImageUrl.set(null);
        }
      } else {
        this.clearContextHeader();
      }
      return;
    }

    if (promo) {
      this.headerLoading.set(true);
      this.promotionsApi
        .getById(promo)
        .pipe(
          catchError(() => of(null)),
          finalize(() => this.headerLoading.set(false)),
        )
        .subscribe((p) => {
          if (!p) {
            this.clearContextHeader();
            return;
          }
          this.headerTitle.set(promotionLocalizedName(p, lang));
          this.headerSubtitle.set(promotionLocalizedDescription(p, lang));
          this.breadcrumbs.set(this.buildPromotionBreadcrumbs(p));
          const ik = p.imageKey?.trim();
          if (ik) {
            this.mediaUrlCache.getUrl(ik).subscribe((url) => this.headerImageUrl.set(url));
          } else {
            this.headerImageUrl.set(null);
          }
        });
      return;
    }

    this.clearContextHeader();
  }

  private clearContextHeader(): void {
    this.headerTitle.set('');
    this.headerSubtitle.set(null);
    this.headerImageUrl.set(null);
    this.breadcrumbs.set([]);
    this.headerLoading.set(false);
  }

  private buildCategoryBreadcrumbs(
    cat: CategoryResponseDto,
  ): { label: string; link: string[] | null; queryParams?: Record<string, string> }[] {
    const lang = this.lang();
    const t = (k: string) => this.translate.instant(k);
    const chain: CategoryResponseDto[] = [];
    const byId = new Map(this.allCategories().map((c) => [c.id, c]));
    let cur: CategoryResponseDto | undefined = cat;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    const crumbs: { label: string; link: string[] | null; queryParams?: Record<string, string> }[] =
      [
        { label: t('HEADER.HOME'), link: ['/'] },
        { label: t('PRODUCTS.TITLE'), link: ['/products'] },
      ];
    for (let i = 0; i < chain.length; i++) {
      const c = chain[i];
      const isLast = i === chain.length - 1;
      crumbs.push({
        label: categoryLocalizedName(c, lang),
        link: isLast ? null : ['/products', 'category', c.slug],
      });
    }
    return crumbs;
  }

  private buildBrandBreadcrumbs(
    b: BrandResponseDto,
  ): { label: string; link: string[] | null; queryParams?: Record<string, string> }[] {
    const lang = this.lang();
    const t = (k: string) => this.translate.instant(k);
    return [
      { label: t('HEADER.HOME'), link: ['/'] },
      { label: t('PRODUCTS.TITLE'), link: ['/products'] },
      { label: brandLocalizedName(b, lang), link: null },
    ];
  }

  private buildPromotionBreadcrumbs(p: PromotionResponseDto): {
    label: string;
    link: string[] | null;
    queryParams?: Record<string, string>;
  }[] {
    const lang = this.lang();
    const t = (k: string) => this.translate.instant(k);
    const slug = p.slug?.trim();
    const crumbs: { label: string; link: string[] | null; queryParams?: Record<string, string> }[] =
      [
        { label: t('HEADER.HOME'), link: ['/'] },
        { label: t('PRODUCTS.TITLE'), link: ['/products'] },
      ];
    if (slug) {
      crumbs.push({
        label: t('HEADER.PROMOTIONS'),
        link: ['/promotions'],
        queryParams: { slug },
      });
    } else {
      crumbs.push({ label: t('HEADER.PROMOTIONS'), link: ['/promotions'] });
    }
    crumbs.push({ label: promotionLocalizedName(p, lang), link: null });
    return crumbs;
  }

  brandLabel(b: BrandResponseDto): string {
    return brandLocalizedName(b, this.lang());
  }

  showContextHero(): boolean {
    if (this.routeCategorySlug() || this.routeBrandSlug()) {
      return true;
    }
    if (this.promotionId()) {
      return this.headerLoading() || !!this.headerTitle().trim();
    }
    return false;
  }

  private navigateToProducts(state: {
    brandId: string | null;
    categoryId: string | null;
    sortBy?: ProductSortBy;
    priceFromStr?: string;
    priceToStr?: string;
    /** Якщо не передано — скидаємо на 1 (новий фільтр). */
    page?: number;
  }): void {
    const sortBy = state.sortBy ?? this.sortBy();
    const priceFromStr = state.priceFromStr ?? this.priceFromStr();
    const priceToStr = state.priceToStr ?? this.priceToStr();
    const brandId = state.brandId;
    const categoryId = state.categoryId;
    const page = state.page ?? 1;

    const pf = parseOptionalFloat(priceFromStr);
    const pt = parseOptionalFloat(priceToStr);

    const query: Record<string, string | null> = {};
    if (sortBy !== ProductSortBy.PriceAsc) {
      query['sort'] = String(sortBy);
    }
    if (pf != null) {
      query['priceFrom'] = String(pf);
    }
    if (pt != null) {
      query['priceTo'] = String(pt);
    }
    const promo = this.promotionId();
    const promoSlug = this.routePromotionSlug()?.trim();
    if (promo && !promoSlug) {
      query['promotionId'] = promo;
    }
    if (this.onlyPromotional()) {
      query['onSale'] = '1';
    }
    if (page > 1) {
      query['page'] = String(page);
    }

    if (promo && promoSlug) {
      query['brandId'] = brandId;
      query['categoryId'] = categoryId;
      this.router.navigate(['/products', 'promotion', promoSlug], { queryParams: query, replaceUrl: true });
      return;
    }

    if (brandId && !categoryId) {
      const b = this.brands().find((x) => x.id === brandId);
      if (b?.slug) {
        this.router.navigate(['/products', 'brand', b.slug], { queryParams: query, replaceUrl: true });
        return;
      }
    }
    if (categoryId && !brandId) {
      const c = this.allCategories().find((x) => x.id === categoryId);
      if (c?.slug) {
        this.router.navigate(['/products', 'category', c.slug], { queryParams: query, replaceUrl: true });
        return;
      }
    }

    query['brandId'] = brandId;
    query['categoryId'] = categoryId;
    this.router.navigate(['/products'], { queryParams: query, replaceUrl: true });
  }

  onCategoryChange(value: string | null): void {
    const v = value === '' || value == null ? null : value;
    this.rootCategoryId.set(v);
    this.subCategoryId.set(null);
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: v,
    });
  }

  nestedCategoryLabel(c: CategoryResponseDto): string {
    return this.categoryLabel(c);
  }

  onSubCategoryChange(value: string | null): void {
    const v = value === '' || value == null ? null : value;
    this.subCategoryId.set(v);
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: v ?? this.rootCategoryId(),
    });
  }

  /** Перехід у дочірню категорію з маршруту `/products/category/:slug`. */
  onRouteCategoryChildChange(value: string | null): void {
    const v = value === '' || value == null ? null : value;
    if (!v) {
      return;
    }
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: v,
      page: 1,
    });
  }

  onBrandChange(value: string | null): void {
    const v = value === '' || value == null ? null : value;
    this.navigateToProducts({
      brandId: v,
      categoryId: this.categoryId(),
    });
  }

  onSortChange(value: ProductSortBy): void {
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: this.categoryId(),
      sortBy: value,
    });
  }

  onPriceFiltersApply(): void {
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: this.categoryId(),
      priceFromStr: this.priceFromStr(),
      priceToStr: this.priceToStr(),
    });
  }

  onOnlyPromotionalChange(checked: boolean): void {
    this.onlyPromotional.set(checked);
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: this.categoryId(),
      page: 1,
    });
  }

  resetFilters(): void {
    this.router.navigate(['/products'], { replaceUrl: true });
  }

  openQuickView(product: ProductResponseDto): void {
    this.dialog.open<ProductQuickViewDialogComponent, ProductQuickViewDialogData>(
      ProductQuickViewDialogComponent,
      {
        panelClass: ['auth-dialog', 'product-quick-view-panel'],
        width: 'min(96vw - 24px, 1040px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'min(88vh, 820px)',
        maxHeight: 'min(88vh, calc(100vh - 24px))',
        data: { product },
      },
    );
  }

  favoriteFor(id: string): boolean {
    return this.favorites.favoriteIds().has(id);
  }

  toggleFavorite(id: string): void {
    this.favorites.toggleFavorite(id).subscribe();
  }
}
