import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BrandService } from '../../../../features/brands/brand.service';
import { BrandResponseDto } from '../../../../features/brands/brand.types';
import { CategoryService } from '../../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../../features/categories/category.types';
import { ProductAttributeService } from '../../../../features/product-attributes/product-attribute.service';
import {
  AttributeType,
  normalizeAttributeType,
  ProductAttributeResponseDto,
} from '../../../../features/product-attributes/product-attribute.types';
import { defaultProductFilter } from '../../../../features/products/product-filter.encode';
import { ProductService } from '../../../../features/products/product.service';
import {
  AttributeFilterValueDto,
  ProductResponseDto,
  ProductSortBy,
} from '../../../../features/products/product.types';

/** Сортування в таблиці: price / rating / sold — через API; інше — локально на поточній сторінці. */
type ProductTableSortKey =
  | 'name'
  | 'price'
  | 'stock'
  | 'available'
  | 'category'
  | 'brand'
  | 'rating'
  | 'sold'
  | 'isActive';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';
import { MediaImageThumbComponent } from '../shared/media-image-thumb/media-image-thumb.component';
import { ProductDeleteDialogComponent } from './product-delete-dialog/product-delete-dialog.component';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSnackBarModule,
    MediaImageThumbComponent,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class AdminProductsComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);
  private attributeService = inject(ProductAttributeService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();
  private searchDebounced$ = new Subject<string>();

  items = signal<ProductResponseDto[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  page = signal(1);
  readonly pageSize = 20;

  searchText = signal('');
  categoryId = signal<string | null>(null);
  brandId = signal<string | null>(null);
  /** Активний стовпець сортування таблиці (як у категорій/брендів). */
  tableSortKey = signal<ProductTableSortKey>('price');
  tableSortDir = signal<'asc' | 'desc'>('asc');
  includeInactive = signal(true);
  priceFrom = signal('');
  priceTo = signal('');
  attributeFilters = signal<AttributeFilterValueDto[]>([]);

  categories = signal<CategoryResponseDto[]>([]);
  brands = signal<BrandResponseDto[]>([]);
  filterableAttributes = signal<ProductAttributeResponseDto[]>([]);

  /** Чернетка фільтра за атрибутом (поля залежать від типу атрибута). */
  attrFilterAttrId = signal<string | null>(null);
  attrFilterString = signal('');
  /** Список допустимих значень (як на бекенді): через кому. */
  attrFilterIntegerListRaw = signal('');
  attrFilterDecimalListRaw = signal('');
  /** unset — ще не обрано; для API: так / ні. */
  attrFilterBoolChoice = signal<'unset' | 'yes' | 'no'>('unset');

  readonly AttributeType = AttributeType;
  readonly normalizeAttrType = normalizeAttributeType;

  /**
   * Умовні поля фільтра в шаблоні через @switch — надійніше за порівняння з enum у HTML
   * (і узгоджено з normalizeAttributeType / назвами типів з API).
   */
  filterAttrControlKind(attr: ProductAttributeResponseDto): 'string' | 'decimal' | 'integer' | 'boolean' {
    switch (normalizeAttributeType(attr.type)) {
      case AttributeType.String:
        return 'string';
      case AttributeType.Decimal:
        return 'decimal';
      case AttributeType.Integer:
        return 'integer';
      case AttributeType.Boolean:
        return 'boolean';
      default:
        return 'string';
    }
  }

  /** Поточний атрибут у селекторі фільтра (для умовних полів). */
  selectedFilterAttr = computed(() => {
    const id = this.attrFilterAttrId();
    if (!id) return undefined;
    return this.filterableAttributes().find((a) => a.id === id);
  });

  displayedColumns = [
    'image',
    'name',
    'price',
    'stock',
    'available',
    'category',
    'brand',
    'rating',
    'sold',
    'active',
    'actions',
  ];

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  /** Після відповіді API — додаткове локальне сортування (назва, залишок, рейтинг ↑ тощо). */
  displayedItems = computed(() => {
    const key = this.tableSortKey();
    const dir = this.tableSortDir();
    const list = [...this.items()];
    const m = dir === 'asc' ? 1 : -1;

    const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) * m;
    const cmpNum = (a: number, b: number) => (a === b ? 0 : a < b ? -m : m);

    switch (key) {
      case 'name':
        return list.sort((a, b) => cmpStr(a.name ?? '', b.name ?? ''));
      case 'price':
        return list;
      case 'rating':
        if (dir === 'desc') {
          return list;
        }
        return list.sort(
          (a, b) =>
            cmpNum(a.averageRating, b.averageRating) ||
            cmpStr(a.name ?? '', b.name ?? ''),
        );
      case 'sold':
        if (dir === 'desc') {
          return list;
        }
        return list.sort(
          (a, b) => cmpNum(a.totalSold, b.totalSold) || cmpStr(a.name ?? '', b.name ?? ''),
        );
      case 'stock':
        return list.sort((a, b) => cmpNum(a.stockQuantity, b.stockQuantity));
      case 'available':
        return list.sort((a, b) => cmpNum(a.availableQuantity, b.availableQuantity));
      case 'category':
        return list.sort((a, b) =>
          cmpStr(this.categoryLabel(a.categoryId), this.categoryLabel(b.categoryId)),
        );
      case 'brand':
        return list.sort((a, b) => cmpStr(this.brandLabel(a.brandId), this.brandLabel(b.brandId)));
      case 'isActive':
        return list.sort((a, b) => cmpNum(Number(a.isActive), Number(b.isActive)));
      default:
        return list;
    }
  });

  ProductSortBy = ProductSortBy;

  ngOnInit(): void {
    this.categoryService.getAll().subscribe({
      next: (c) => this.categories.set([...c].sort((a, b) => a.fullPath.localeCompare(b.fullPath))),
      error: () => {},
    });
    this.brandService.getAll().subscribe({
      next: (b) => this.brands.set([...b].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => {},
    });
    this.attributeService.getAll().subscribe({
      next: (a) => this.filterableAttributes.set(a.filter((x) => x.isFilterable)),
      error: () => {},
    });

    this.searchDebounced$
      .pipe(debounceTime(450), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        this.load();
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Мапінг на ProductSortBy для бекенду (ціна / рейтинг / продажі). Інші стовпці — завжди PriceAsc + локальне сортування. */
  private deriveApiSortBy(key: ProductTableSortKey, dir: 'asc' | 'desc'): ProductSortBy {
    switch (key) {
      case 'price':
        return dir === 'asc' ? ProductSortBy.PriceAsc : ProductSortBy.PriceDesc;
      case 'rating':
        return ProductSortBy.AverageRatingDesc;
      case 'sold':
        return ProductSortBy.TotalSoldDesc;
      default:
        return ProductSortBy.PriceAsc;
    }
  }

  changeSort(key: ProductTableSortKey): void {
    const oldKey = this.tableSortKey();
    const oldDir = this.tableSortDir();

    if (oldKey === key) {
      this.tableSortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.tableSortKey.set(key);
      this.tableSortDir.set(key === 'rating' || key === 'sold' ? 'desc' : 'asc');
    }

    const newKey = this.tableSortKey();
    const newDir = this.tableSortDir();
    if (this.deriveApiSortBy(oldKey, oldDir) !== this.deriveApiSortBy(newKey, newDir)) {
      this.page.set(1);
      this.load();
    }
  }

  sortIndicator(key: ProductTableSortKey): string {
    if (this.tableSortKey() !== key) {
      return '';
    }
    return this.tableSortDir() === 'asc' ? '↑' : '↓';
  }

  private parseDecimal(s: string): number | null {
    const t = s.trim().replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Пошук: GET /products/search?query=… (бекенд SearchAsync).
   * Фільтри: GET /products?filters=… без пошукового рядка в JSON.
   */
  load(): void {
    this.loading.set(true);
    const q = this.searchText().trim();
    const searchOnly = q.length > 0;

    const request$ = searchOnly
      ? this.productService.search(q, this.page(), this.pageSize)
      : this.productService.getPaged(
          defaultProductFilter({
            categoryId: this.categoryId(),
            brandId: this.brandId(),
            priceFrom: this.parseDecimal(this.priceFrom()),
            priceTo: this.parseDecimal(this.priceTo()),
            attributeFilters: this.attributeFilters(),
            includeInactive: this.includeInactive(),
            sortBy: this.deriveApiSortBy(this.tableSortKey(), this.tableSortDir()),
            searchQuery: null,
            page: this.page(),
            pageSize: this.pageSize,
          }),
        );

    request$.subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.LOAD_ERROR'), 'OK', { duration: 5000 });
      },
    });
  }

  onSearchInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    if (v.trim().length >= 1) {
      this.clearAllStructuredFilters();
    }
    this.searchText.set(v);
    this.searchDebounced$.next(v);
  }

  /** Очищує пошук (при зміні будь-якого фільтра). */
  private clearSearchText(): void {
    this.searchText.set('');
  }

  /** Скидає фільтри панелі (при введенні символа в пошук). «Показувати неактивні» лишаємо. */
  private clearAllStructuredFilters(): void {
    this.categoryId.set(null);
    this.brandId.set(null);
    this.priceFrom.set('');
    this.priceTo.set('');
    this.attributeFilters.set([]);
    this.attrFilterAttrId.set(null);
    this.resetAttrFilterDraft();
  }

  onFilterChange(): void {
    this.clearSearchText();
    this.page.set(1);
    this.load();
  }

  onPriceFromChange(event: Event): void {
    this.priceFrom.set((event.target as HTMLInputElement).value);
    this.onFilterChange();
  }

  onPriceToChange(event: Event): void {
    this.priceTo.set((event.target as HTMLInputElement).value);
    this.onFilterChange();
  }

  onAttrFilterStringInput(event: Event): void {
    this.attrFilterString.set((event.target as HTMLInputElement).value);
  }

  onAttrFilterIntegerListInput(event: Event): void {
    this.attrFilterIntegerListRaw.set((event.target as HTMLInputElement).value);
  }

  onAttrFilterDecimalListInput(event: Event): void {
    this.attrFilterDecimalListRaw.set((event.target as HTMLInputElement).value);
  }

  onAttrFilterBoolChange(value: string): void {
    if (value === 'unset' || value === 'yes' || value === 'no') {
      this.attrFilterBoolChoice.set(value);
    }
  }

  onAttrFilterAttrChange(id: string | null): void {
    this.attrFilterAttrId.set(id);
    this.resetAttrFilterDraft();
  }

  private resetAttrFilterDraft(): void {
    this.attrFilterString.set('');
    this.attrFilterIntegerListRaw.set('');
    this.attrFilterDecimalListRaw.set('');
    this.attrFilterBoolChoice.set('unset');
  }

  clearSearch(): void {
    this.searchText.set('');
    this.page.set(1);
    this.load();
  }

  categoryLabel(id: string): string {
    return this.categories().find((c) => c.id === id)?.fullPath ?? id;
  }

  brandLabel(id: string): string {
    return this.brands().find((b) => b.id === id)?.name ?? id;
  }

  attrName(attributeId: string): string {
    return this.filterableAttributes().find((a) => a.id === attributeId)?.name ?? attributeId;
  }

  private parseIntegerStrict(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    if (!/^-?\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  }

  private snackFilter(key: string): void {
    this.snack.open(this.translate.instant(key), 'OK', { duration: 4500 });
  }

  private snackFilterToken(key: string, token: string): void {
    this.snack.open(this.translate.instant(key, { token }), 'OK', { duration: 5000 });
  }

  /** Розбиття списку через кому; порожні фрагменти відкидаються. */
  private splitFilterList(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private parseIntegerList(raw: string): { ok: true; values: number[] } | { ok: false; token: string } {
    const parts = this.splitFilterList(raw);
    if (parts.length === 0) {
      return { ok: false, token: '' };
    }
    const values: number[] = [];
    for (const p of parts) {
      const n = this.parseIntegerStrict(p);
      if (n === null) {
        return { ok: false, token: p };
      }
      values.push(n);
    }
    return { ok: true, values: [...new Set(values)] };
  }

  private parseDecimalList(raw: string): { ok: true; values: number[] } | { ok: false; token: string } {
    const parts = this.splitFilterList(raw);
    if (parts.length === 0) {
      return { ok: false, token: '' };
    }
    const values: number[] = [];
    for (const p of parts) {
      const n = this.parseDecimal(p);
      if (n === null) {
        return { ok: false, token: p };
      }
      values.push(n);
    }
    return { ok: true, values: [...new Set(values)] };
  }

  addAttributeFilter(): void {
    const attrId = this.attrFilterAttrId()?.trim() ?? '';
    if (!attrId) {
      this.snackFilter('ADMIN.PRODUCT.ATTR_FILTER_PICK_ATTR');
      return;
    }
    const attr = this.filterableAttributes().find((a) => a.id === attrId);
    if (!attr) return;

    const dto: AttributeFilterValueDto = { attributeId: attrId };
    const t = normalizeAttributeType(attr.type);

    if (t === AttributeType.String) {
      const v = this.attrFilterString().trim();
      if (!v) {
        this.snackFilter('ADMIN.PRODUCT.ATTR_FILTER_STRING_EMPTY');
        return;
      }
      dto.stringValues = [v];
    } else if (t === AttributeType.Decimal) {
      const parsed = this.parseDecimalList(this.attrFilterDecimalListRaw());
      if (!parsed.ok) {
        if (!parsed.token) {
          this.snackFilter('ADMIN.PRODUCT.ATTR_FILTER_LIST_EMPTY');
        } else {
          this.snackFilterToken('ADMIN.PRODUCT.ATTR_FILTER_TOKEN_INVALID', parsed.token);
        }
        return;
      }
      dto.decimalValues = parsed.values;
    } else if (t === AttributeType.Integer) {
      const parsed = this.parseIntegerList(this.attrFilterIntegerListRaw());
      if (!parsed.ok) {
        if (!parsed.token) {
          this.snackFilter('ADMIN.PRODUCT.ATTR_FILTER_LIST_EMPTY');
        } else {
          this.snackFilterToken('ADMIN.PRODUCT.ATTR_FILTER_TOKEN_INVALID', parsed.token);
        }
        return;
      }
      dto.integerValues = parsed.values;
    } else if (t === AttributeType.Boolean) {
      const c = this.attrFilterBoolChoice();
      if (c === 'unset') {
        this.snackFilter('ADMIN.PRODUCT.ATTR_FILTER_BOOL_REQUIRED');
        return;
      }
      dto.booleanValues = [c === 'yes'];
    } else {
      return;
    }

    this.clearSearchText();
    this.attributeFilters.update((list) => [...list.filter((x) => x.attributeId !== attrId), dto]);
    this.resetAttrFilterDraft();
    this.page.set(1);
    this.load();
  }

  /** Короткий підпис обраного фільтра в чіпі. */
  attrFilterChipLabel(f: AttributeFilterValueDto): string {
    const name = this.attrName(f.attributeId);
    if (f.stringValues?.length) {
      return `${name}: ${f.stringValues.join(', ')}`;
    }
    if (f.decimalValues?.length) {
      return `${name}: ${f.decimalValues.join(', ')}`;
    }
    if (f.integerValues?.length) {
      return `${name}: ${f.integerValues.join(', ')}`;
    }
    if (f.booleanValues?.length) {
      const v = f.booleanValues[0];
      return `${name}: ${this.translate.instant(v ? 'ADMIN.PRODUCT.ATTR_BOOL_YES' : 'ADMIN.PRODUCT.ATTR_BOOL_NO')}`;
    }
    return name;
  }

  removeAttributeFilter(attributeId: string): void {
    this.clearSearchText();
    this.attributeFilters.update((list) => list.filter((x) => x.attributeId !== attributeId));
    this.page.set(1);
    this.load();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  confirmDelete(row: ProductResponseDto): void {
    const ref = this.dialog.open(ProductDeleteDialogComponent, {
      data: { name: row.name },
      width: 'min(440px, 100vw)',
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.productService.delete(row.id).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.DELETED'), 'OK', { duration: 4000 });
          this.load();
        },
        error: () => {
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.DELETE_ERROR'), 'OK', { duration: 5000 });
        },
      });
    });
  }
}
