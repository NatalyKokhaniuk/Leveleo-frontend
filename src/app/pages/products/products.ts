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
import { catchError, of } from 'rxjs';
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

  /** Дзеркало query-параметрів */
  categoryId = signal<string | null>(null);
  brandId = signal<string | null>(null);
  sortBy = signal<ProductSortBy>(ProductSortBy.PriceAsc);
  priceFromStr = signal('');
  priceToStr = signal('');

  filterCategories = signal<CategoryResponseDto[]>([]);
  brands = signal<BrandResponseDto[]>([]);
  lang = signal(this.translate.currentLang || 'uk');

  readonly ProductSortBy = ProductSortBy;

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
      },
      error: () => this.filterCategories.set([]),
    });

    this.brandService.getAll().subscribe({
      next: (list) => this.brands.set([...list].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => this.brands.set([]),
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyFromQueryParams(params);
      this.load();
    });
  }

  private applyFromQueryParams(params: ParamMap): void {
    this.categoryId.set(params.get('categoryId'));
    this.brandId.set(params.get('brandId'));
    const sort = params.get('sort');
    if (sort !== null && sort !== '') {
      const n = parseInt(sort, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 3) {
        this.sortBy.set(n as ProductSortBy);
      }
    } else {
      this.sortBy.set(ProductSortBy.PriceAsc);
    }
    this.priceFromStr.set(params.get('priceFrom') ?? '');
    this.priceToStr.set(params.get('priceTo') ?? '');
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

  private navigateQuery(partial: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: partial,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onCategoryChange(value: string | null): void {
    const v = value === '' || value == null ? null : value;
    this.navigateQuery({ categoryId: v });
  }

  onBrandChange(value: string | null): void {
    const v = value === '' || value == null ? null : value;
    this.navigateQuery({ brandId: v });
  }

  onSortChange(value: ProductSortBy): void {
    this.navigateQuery({ sort: String(value) });
  }

  onPriceFiltersApply(): void {
    const pf = parseOptionalFloat(this.priceFromStr());
    const pt = parseOptionalFloat(this.priceToStr());
    this.navigateQuery({
      priceFrom: pf != null ? String(pf) : null,
      priceTo: pt != null ? String(pt) : null,
    });
  }

  resetFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  openQuickView(product: ProductResponseDto): void {
    this.dialog.open<ProductQuickViewDialogComponent, ProductQuickViewDialogData>(
      ProductQuickViewDialogComponent,
      {
        panelClass: ['auth-dialog', 'product-quick-view-panel'],
        width: 'min(92vmin, 520px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'min(92vmin, 520px)',
        maxHeight: 'min(92vmin, calc(100vh - 24px))',
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
