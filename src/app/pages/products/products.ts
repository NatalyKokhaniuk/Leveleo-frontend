import { isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, combineLatest, forkJoin, fromEvent, of } from 'rxjs';
import { BrandService } from '../../features/brands/brand.service';
import { BrandResponseDto } from '../../features/brands/brand.types';
import { brandLocalizedName } from '../../features/brands/brand-display-i18n';
import { CategoryService } from '../../features/categories/category.service';
import { CategoryResponseDto } from '../../features/categories/category.types';
import { categoryLocalizedName } from '../../features/categories/category-display-i18n';
import { AttributeGroupService } from '../../features/attribute-groups/attribute-group.service';
import { AttributeGroupResponseDto } from '../../features/attribute-groups/attribute-group.types';
import {
  AttributeType,
  normalizeAttributeType,
  ProductAttributeResponseDto,
} from '../../features/product-attributes/product-attribute.types';
import { ProductAttributeService } from '../../features/product-attributes/product-attribute.service';
import { ProductCatalogStateService } from '../../features/products/product-catalog.state';
import { defaultProductFilter } from '../../features/products/product-filter.encode';
import { normalizeUiLang } from '../../features/products/product-display-i18n';
import {
  AttributeFilterValueDto,
  ProductResponseDto,
  ProductSortBy,
} from '../../features/products/product.types';
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

function parseOptionalInt(s: string): number | null {
  const t = s.trim();
  if (!t) {
    return null;
  }
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function parseAttrFiltersQuery(raw: string | null): AttributeFilterValueDto[] {
  if (!raw || raw.trim() === '') {
    return [];
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) {
      return [];
    }
    return v.filter(
      (x): x is AttributeFilterValueDto =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as AttributeFilterValueDto).attributeId === 'string',
    );
  } catch {
    return [];
  }
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
    MatIconModule,
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
  private attributeGroupService = inject(AttributeGroupService);
  private productAttributeService = inject(ProductAttributeService);
  private platformId = inject(PLATFORM_ID);

  loading = signal(true);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);

  /** Дзеркало query / slug-маршруту */
  categoryId = signal<string | null>(null);
  brandId = signal<string | null>(null);
  sortBy = signal<ProductSortBy>(ProductSortBy.PriceAsc);
  priceFromStr = signal('');
  priceToStr = signal('');

  /** Фільтри за атрибутами (дзеркало `attrFilters` у query). */
  attributeFilters = signal<AttributeFilterValueDto[]>([]);
  filterableAttrs = signal<ProductAttributeResponseDto[]>([]);
  attributeGroups = signal<AttributeGroupResponseDto[]>([]);
  stringDraft = signal<Record<string, string>>({});
  boolDraft = signal<Record<string, boolean | ''>>({});
  intFromDraft = signal<Record<string, string>>({});
  intToDraft = signal<Record<string, string>>({});
  decFromDraft = signal<Record<string, string>>({});
  decToDraft = signal<Record<string, string>>({});

  attributeFilterBlocks = computed(() => {
    const groups = this.attributeGroups();
    const byGroup = new Map<string, ProductAttributeResponseDto[]>();
    for (const a of this.filterableAttrs()) {
      const gid = a.attributeGroupId?.trim() ?? '';
      if (!byGroup.has(gid)) {
        byGroup.set(gid, []);
      }
      byGroup.get(gid)!.push(a);
    }
    return groups
      .map((g) => ({ group: g, attributes: byGroup.get(g.id) ?? [] }))
      .filter((b) => b.attributes.length > 0);
  });

  /** Скільки груп атрибутів показувати у «згорнутому» режимі (як ряд карток брендів на головній). */
  attrFilterGroupRowCount = signal(5);
  attrFiltersExpanded = signal(false);

  visibleAttributeBlocks = computed(() => {
    const blocks = this.attributeFilterBlocks();
    const n = this.attrFilterGroupRowCount();
    if (this.attrFiltersExpanded() || blocks.length <= n) {
      return blocks;
    }
    return blocks.slice(0, n);
  });

  showAttributeFiltersToggle = computed(() => {
    return this.attributeFilterBlocks().length > this.attrFilterGroupRowCount();
  });

  filterCategories = signal<CategoryResponseDto[]>([]);
  brands = signal<BrandResponseDto[]>([]);
  lang = signal(this.translate.currentLang || 'uk');

  readonly ProductSortBy = ProductSortBy;
  readonly AttributeType = AttributeType;

  private brandsCatalogResolved = false;
  private categoriesCatalogResolved = false;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });

    if (isPlatformBrowser(this.platformId)) {
      this.updateAttrFilterGroupRowCount();
      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateAttrFilterGroupRowCount());
    }

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

    forkJoin({
      groups: this.attributeGroupService.getAll().pipe(
        catchError(() => of([] as AttributeGroupResponseDto[])),
      ),
      attrs: this.productAttributeService.getAll().pipe(
        catchError(() => of([] as ProductAttributeResponseDto[])),
      ),
    }).subscribe(({ groups, attrs }) => {
      this.attributeGroups.set([...groups].sort((a, b) => a.name.localeCompare(b.name)));
      const filterable = attrs
        .filter((a) => a.isFilterable)
        .sort((a, b) => a.name.localeCompare(b.name));
      this.filterableAttrs.set(filterable);
      this.syncDraftsFromAttributeFilters();
    });
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
    const af = query.get('attrFilters');
    if (af !== null && af !== '') {
      o['attrFilters'] = af;
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
    this.attributeFilters.set(parseAttrFiltersQuery(query.get('attrFilters')));
    this.applySortAndPriceFromQuery(query);
    this.syncDraftsFromAttributeFilters();
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
      attributeFilters: [...this.attributeFilters()],
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

  groupLabel(g: AttributeGroupResponseDto): string {
    const code = normalizeUiLang(this.lang());
    const tr = g.translations?.find((t) => t.languageCode?.toLowerCase().startsWith(code));
    return tr?.name?.trim() || g.name;
  }

  attrLabel(a: ProductAttributeResponseDto): string {
    const code = normalizeUiLang(this.lang());
    const tr = a.translations?.find((t) => t.languageCode?.toLowerCase().startsWith(code));
    return tr?.name?.trim() || a.name;
  }

  attrKind(a: ProductAttributeResponseDto): 'string' | 'bool' | 'int' | 'dec' {
    const t = normalizeAttributeType(a.type);
    if (t === AttributeType.String) {
      return 'string';
    }
    if (t === AttributeType.Boolean) {
      return 'bool';
    }
    if (t === AttributeType.Integer) {
      return 'int';
    }
    return 'dec';
  }

  setStringDraft(id: string, v: string): void {
    this.stringDraft.update((m) => ({ ...m, [id]: v }));
  }

  setBoolDraft(id: string, v: string): void {
    let b: boolean | '' = '';
    if (v === 'true') {
      b = true;
    } else if (v === 'false') {
      b = false;
    }
    this.boolDraft.update((m) => ({ ...m, [id]: b }));
  }

  setIntFromDraft(id: string, v: string): void {
    this.intFromDraft.update((m) => ({ ...m, [id]: v }));
  }

  setIntToDraft(id: string, v: string): void {
    this.intToDraft.update((m) => ({ ...m, [id]: v }));
  }

  setDecFromDraft(id: string, v: string): void {
    this.decFromDraft.update((m) => ({ ...m, [id]: v }));
  }

  setDecToDraft(id: string, v: string): void {
    this.decToDraft.update((m) => ({ ...m, [id]: v }));
  }

  boolSelectValue(id: string): string {
    const b = this.boolDraft()[id];
    if (b === true) {
      return 'true';
    }
    if (b === false) {
      return 'false';
    }
    return '';
  }

  private syncDraftsFromAttributeFilters(): void {
    const filters = this.attributeFilters();
    const map = new Map(filters.map((f) => [f.attributeId, f]));
    const str: Record<string, string> = {};
    const bool: Record<string, boolean | ''> = {};
    const intF: Record<string, string> = {};
    const intT: Record<string, string> = {};
    const decF: Record<string, string> = {};
    const decT: Record<string, string> = {};
    for (const a of this.filterableAttrs()) {
      const f = map.get(a.id);
      const t = normalizeAttributeType(a.type);
      const id = a.id;
      if (t === AttributeType.String) {
        str[id] = f?.stringValues?.[0] ?? '';
      } else if (t === AttributeType.Boolean) {
        const bv = f?.booleanValues;
        bool[id] = bv && bv.length > 0 ? bv[0]! : '';
      } else if (t === AttributeType.Integer) {
        const iv = f?.integerValues ?? [];
        intF[id] = iv[0] != null ? String(iv[0]) : '';
        intT[id] = iv[1] != null ? String(iv[1]) : '';
      } else if (t === AttributeType.Decimal) {
        const dv = f?.decimalValues ?? [];
        decF[id] = dv[0] != null ? String(dv[0]) : '';
        decT[id] = dv[1] != null ? String(dv[1]) : '';
      }
    }
    this.stringDraft.set(str);
    this.boolDraft.set(bool);
    this.intFromDraft.set(intF);
    this.intToDraft.set(intT);
    this.decFromDraft.set(decF);
    this.decToDraft.set(decT);
  }

  private buildFiltersFromDrafts(): AttributeFilterValueDto[] {
    const out: AttributeFilterValueDto[] = [];
    const str = this.stringDraft();
    const bool = this.boolDraft();
    const intF = this.intFromDraft();
    const intT = this.intToDraft();
    const decF = this.decFromDraft();
    const decT = this.decToDraft();
    for (const a of this.filterableAttrs()) {
      const t = normalizeAttributeType(a.type);
      const id = a.id;
      if (t === AttributeType.String) {
        const s = str[id]?.trim();
        if (s) {
          out.push({ attributeId: id, stringValues: [s] });
        }
      } else if (t === AttributeType.Boolean) {
        const b = bool[id];
        if (b === true || b === false) {
          out.push({ attributeId: id, booleanValues: [b] });
        }
      } else if (t === AttributeType.Integer) {
        const from = parseOptionalInt(intF[id] ?? '');
        const to = parseOptionalInt(intT[id] ?? '');
        const vals: number[] = [];
        if (from != null) {
          vals.push(from);
        }
        if (to != null) {
          vals.push(to);
        }
        if (vals.length) {
          out.push({ attributeId: id, integerValues: vals });
        }
      } else if (t === AttributeType.Decimal) {
        const from = parseOptionalFloat(decF[id] ?? '');
        const to = parseOptionalFloat(decT[id] ?? '');
        const vals: number[] = [];
        if (from != null) {
          vals.push(from);
        }
        if (to != null) {
          vals.push(to);
        }
        if (vals.length) {
          out.push({ attributeId: id, decimalValues: vals });
        }
      }
    }
    return out;
  }

  private mergeQueryParams(state: {
    sortBy: ProductSortBy;
    priceFromStr: string;
    priceToStr: string;
    attributeFilters: AttributeFilterValueDto[];
  }): Record<string, string | null> {
    const query: Record<string, string | null> = {};
    if (state.sortBy !== ProductSortBy.PriceAsc) {
      query['sort'] = String(state.sortBy);
    }
    const pf = parseOptionalFloat(state.priceFromStr);
    const pt = parseOptionalFloat(state.priceToStr);
    if (pf != null) {
      query['priceFrom'] = String(pf);
    }
    if (pt != null) {
      query['priceTo'] = String(pt);
    }
    if (state.attributeFilters.length > 0) {
      query['attrFilters'] = JSON.stringify(state.attributeFilters);
    } else {
      query['attrFilters'] = null;
    }
    return query;
  }

  private navigateToProducts(state: {
    brandId: string | null;
    categoryId: string | null;
    sortBy?: ProductSortBy;
    priceFromStr?: string;
    priceToStr?: string;
    attributeFilters?: AttributeFilterValueDto[];
  }): void {
    const sortBy = state.sortBy ?? this.sortBy();
    const priceFromStr = state.priceFromStr ?? this.priceFromStr();
    const priceToStr = state.priceToStr ?? this.priceToStr();
    const brandId = state.brandId;
    const categoryId = state.categoryId;
    const attributeFilters =
      state.attributeFilters !== undefined ? state.attributeFilters : this.attributeFilters();

    const query = this.mergeQueryParams({
      sortBy,
      priceFromStr,
      priceToStr,
      attributeFilters,
    });

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

  applyAttributeFilters(): void {
    const built = this.buildFiltersFromDrafts();
    this.navigateToProducts({
      brandId: this.brandId(),
      categoryId: this.categoryId(),
      attributeFilters: built,
    });
  }

  /** Відповідає сітці брендів: скільки «карток» у ряду → скільки груп атрибутів у згорнутому вигляді. */
  private updateAttrFilterGroupRowCount(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const w = window.innerWidth;
    if (w < 640) {
      this.attrFilterGroupRowCount.set(2);
    } else if (w < 768) {
      this.attrFilterGroupRowCount.set(3);
    } else if (w < 1024) {
      this.attrFilterGroupRowCount.set(4);
    } else if (w < 1280) {
      this.attrFilterGroupRowCount.set(5);
    } else {
      this.attrFilterGroupRowCount.set(6);
    }
  }

  toggleAttributeFilters(): void {
    this.attrFiltersExpanded.update((e) => !e);
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
