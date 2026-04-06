import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, combineLatest, of } from 'rxjs';
import { BrandService } from '../../features/brands/brand.service';
import { BrandResponseDto } from '../../features/brands/brand.types';
import { brandLocalizedName } from '../../features/brands/brand-display-i18n';
import { CategoryService } from '../../features/categories/category.service';
import { CategoryResponseDto } from '../../features/categories/category.types';
import { categoryLocalizedName } from '../../features/categories/category-display-i18n';
import { ProductCatalogStateService } from '../../features/products/product-catalog.state';
import { defaultProductFilter } from '../../features/products/product-filter.encode';
import { ProductResponseDto, ProductSortBy } from '../../features/products/product.types';
import { ProductCardComponent } from './product-card/product-card.component';
import {
  ProductQuickViewDialogComponent,
  ProductQuickViewDialogData,
} from './product-quick-view-dialog/product-quick-view-dialog.component';
import { FavoritesStateService } from '../../core/favorites/favorites-state.service';

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
    MatButtonModule,
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

  loading = signal(true);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);

  /** Дзеркало query / slug-маршруту */
  categoryId = signal<string | null>(null);
  brandId = signal<string | null>(null);
  sortBy = signal<ProductSortBy>(ProductSortBy.PriceAsc);
  priceFromStr = signal('');
  priceToStr = signal('');

  filterCategories = signal<CategoryResponseDto[]>([]);
  brands = signal<BrandResponseDto[]>([]);
  lang = signal(this.translate.currentLang || 'uk');

  readonly ProductSortBy = ProductSortBy;

  private brandsCatalogResolved = false;
  private categoriesCatalogResolved = false;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });

    this.categoryService.getAll().subscribe({
      next: (list) => {
        const roots = list
          .filter((c) => c.isActive && (c.parentId == null || String(c.parentId).trim() === ''))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.filterCategories.set(roots);
        this.categoriesCatalogResolved = true;
        this.refreshFromRoute();
      },
      error: () => {
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

  private auxQueryFrom(query: ParamMap): Record<string, string | null> {
    const o: Record<string, string | null> = {};
    const s = query.get('sort');
    const pf = query.get('priceFrom');
    const pt = query.get('priceTo');
    if (s !== null && s !== '') {
      o['sort'] = s;
    }
    if (pf !== null && pf !== '') {
      o['priceFrom'] = pf;
    }
    if (pt !== null && pt !== '') {
      o['priceTo'] = pt;
    }
    return o;
  }

  /** `/products?brandId=` або `?categoryId=` → канонічний slug-шлях, якщо лиш один тип фільтра. */
  private maybeCanonicalizeUrl(params: ParamMap, query: ParamMap): boolean {
    if (params.get('brandSlug') || params.get('categorySlug')) {
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
      const c = this.filterCategories().find((x) => x.id === qCat);
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
      const c = this.filterCategories().find((x) => x.slug === cs);
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
      const c = this.filterCategories().find((x) => x.slug === cs);
      if (!c) {
        this.router.navigate(['/products'], { queryParams: this.auxQueryFrom(query), replaceUrl: true });
        return true;
      }
    }
    return false;
  }

  private applyFromRoute(params: ParamMap, query: ParamMap): void {
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
      const c = this.filterCategories().find((x) => x.slug === cs);
      categoryId = c?.id ?? null;
    } else {
      categoryId = query.get('categoryId');
    }

    this.brandId.set(brandId);
    this.categoryId.set(categoryId);
    this.applySortAndPriceFromQuery(query);
  }

  private refreshFromRoute(): void {
    const params = this.route.snapshot.paramMap;
    const query = this.route.snapshot.queryParamMap;

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
    this.applyFromRoute(params, query);
    this.load();
  }

  private load(): void {
    this.loadError.set(false);
    const filter = defaultProductFilter({
      includeInactive: false,
      sortBy: this.sortBy(),
      page: 1,
      pageSize: 24,
      categoryId: this.categoryId(),
      brandId: this.brandId(),
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
        } else {
          this.items.set([]);
        }
      });
  }

  categoryLabel(c: CategoryResponseDto): string {
    return categoryLocalizedName(c, this.lang());
  }

  brandLabel(b: BrandResponseDto): string {
    return brandLocalizedName(b, this.lang());
  }

  private navigateToProducts(state: {
    brandId: string | null;
    categoryId: string | null;
    sortBy?: ProductSortBy;
    priceFromStr?: string;
    priceToStr?: string;
  }): void {
    const sortBy = state.sortBy ?? this.sortBy();
    const priceFromStr = state.priceFromStr ?? this.priceFromStr();
    const priceToStr = state.priceToStr ?? this.priceToStr();
    const brandId = state.brandId;
    const categoryId = state.categoryId;

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

    if (brandId && !categoryId) {
      const b = this.brands().find((x) => x.id === brandId);
      if (b?.slug) {
        this.router.navigate(['/products', 'brand', b.slug], { queryParams: query, replaceUrl: true });
        return;
      }
    }
    if (categoryId && !brandId) {
      const c = this.filterCategories().find((x) => x.id === categoryId);
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
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: v,
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
