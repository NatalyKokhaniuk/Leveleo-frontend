import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleGroup, MatButtonToggle } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth/services/auth.service';
import { ComparisonStateService } from '../../core/comparison/comparison-state.service';
import { MediaUrlCacheService } from '../../core/services/media-url-cache.service';
import { ProductAttributeValueResponseDto } from '../../features/product-attribute-values/product-attribute-value.types';
import { ProductAttributeValueService } from '../../features/product-attribute-values/product-attribute-value.service';
import {
  AttributeType,
  normalizeAttributeType,
  ProductAttributeResponseDto,
} from '../../features/product-attributes/product-attribute.types';
import { ProductAttributeService } from '../../features/product-attributes/product-attribute.service';
import { brandLocalizedName } from '../../features/brands/brand-display-i18n';
import { BrandService } from '../../features/brands/brand.service';
import { BrandResponseDto } from '../../features/brands/brand.types';
import { productLocalizedName } from '../../features/products/product-display-i18n';
import { sortProductsByComparisonAddedAtDesc } from '../../features/products/product-relation-sort.util';
import { UserProductRelationsService } from '../../features/user-product-relations/user-product-relations.service';
import {
  isArchivedFromSaleState,
  isCatalogPurchaseBlocked,
  isMissingFromDatabaseState,
  resolveProductCatalogDisplayState,
} from '../../features/products/product-catalog-display';
import { ProductResponseDto } from '../../features/products/product.types';
import { CategoryService } from '../../features/categories/category.service';
import { AttributeGroupService } from '../../features/attribute-groups/attribute-group.service';
import { AttributeGroupResponseDto } from '../../features/attribute-groups/attribute-group.types';
import { ProductCommerceToolbarComponent } from '../products/product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductDetailTabsComponent } from '../products/product-detail-tabs/product-detail-tabs.component';

const UNGROUPED_ATTRIBUTE_KEY = '__ungrouped__';

/** Клітинка таблиці порівняння: текст, булеві іконки або відсутнє значення. */
export type ComparisonAttrCell =
  | { kind: 'missing' }
  | { kind: 'text'; text: string }
  | { kind: 'boolean'; value: boolean };

export interface ComparisonAttributeValueRow {
  attrId: string;
  label: string;
  unit: string | null;
  values: ComparisonAttrCell[];
}

export interface ComparisonAttributeGroupSection {
  groupKey: string;
  groupTitle: string;
  stripe: number;
  rows: ComparisonAttributeValueRow[];
}

/** Фільтр рядків атрибутів у таблиці порівняння. */
export type ComparisonAttrFilterMode = 'all' | 'matching' | 'different' | 'allFilled';

@Component({
  selector: 'app-comparison',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslateModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleGroup,
    MatButtonToggle,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
  ],
  templateUrl: './comparison.html',
  styleUrl: './comparison.scss',
})
export class ComparisonPage implements OnInit {
  private auth = inject(AuthService);
  private relations = inject(UserProductRelationsService);
  private comparison = inject(ComparisonStateService);
  private categories = inject(CategoryService);
  private attributeGroups = inject(AttributeGroupService);
  private brands = inject(BrandService);
  private attributeService = inject(ProductAttributeService);
  private attributeValues = inject(ProductAttributeValueService);
  private mediaUrlCache = inject(MediaUrlCacheService);
  private translate = inject(TranslateService);

  loading = signal(false);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);
  categoryNames = signal<Map<string, string>>(new Map());
  brandCatalog = signal<BrandResponseDto[]>([]);
  activeCategoryId = signal<string | null>(null);
  imageUrls = signal<Map<string, string | null>>(new Map());
  allAttributes = signal<Map<string, ProductAttributeResponseDto>>(new Map());
  attributeGroupsById = signal<Map<string, AttributeGroupResponseDto>>(new Map());
  valuesByProduct = signal<Map<string, ProductAttributeValueResponseDto[]>>(new Map());
  lang = signal(this.translate.currentLang || 'uk');
  /** Режим відображення атрибутів у табличному порівнянні. */
  attrFilterMode = signal<ComparisonAttrFilterMode>('all');

  grouped = computed(() => {
    const names = this.categoryNames();
    const map = new Map<string, ProductResponseDto[]>();
    for (const p of this.items()) {
      const list = map.get(p.categoryId) ?? [];
      list.push(p);
      map.set(p.categoryId, list);
    }
    return Array.from(map.entries()).map(([categoryId, products]) => ({
      categoryId,
      categoryName: names.get(categoryId) ?? categoryId,
      products,
    }));
  });

  visibleItems = computed(() => {
    const id = this.activeCategoryId();
    if (!id) return this.items();
    return this.items().filter((p) => p.categoryId === id);
  });
  priceRow = computed(() => {
    return this.visibleItems().map((p) => this.productPriceLabel(p));
  });
  brandRow = computed(() => {
    return this.visibleItems().map((p) => this.brandCellById(p.brandId));
  });
  attributeRowGroups = computed((): ComparisonAttributeGroupSection[] => {
    const products = this.visibleItems();
    const attrs = this.allAttributes();
    const valuesMap = this.valuesByProduct();
    this.lang();

    const attrIds = new Set<string>();
    for (const p of products) {
      for (const r of valuesMap.get(p.id) ?? []) {
        attrIds.add(r.productAttributeId);
      }
    }

    const byGroup = new Map<string, string[]>();
    for (const attrId of attrIds) {
      const meta = attrs.get(attrId);
      const gid = meta?.attributeGroupId?.trim() || '';
      const key = gid || UNGROUPED_ATTRIBUTE_KEY;
      const list = byGroup.get(key) ?? [];
      list.push(attrId);
      byGroup.set(key, list);
    }

    for (const ids of byGroup.values()) {
      ids.sort((a, b) => this.attributeLabel(a).localeCompare(this.attributeLabel(b)));
    }

    const keys = Array.from(byGroup.keys()).sort((a, b) => {
      if (a === UNGROUPED_ATTRIBUTE_KEY) return 1;
      if (b === UNGROUPED_ATTRIBUTE_KEY) return -1;
      return this.attributeGroupLabel(a).localeCompare(this.attributeGroupLabel(b));
    });

    return keys.map((groupKey, stripe) => ({
      groupKey,
      groupTitle:
        groupKey === UNGROUPED_ATTRIBUTE_KEY
          ? this.translate.instant('COMPARISON.ATTR_GROUP_OTHER')
          : this.attributeGroupLabel(groupKey),
      stripe,
      rows: (byGroup.get(groupKey) ?? []).map((attrId) => ({
        attrId,
        label: this.attributeLabel(attrId),
        unit: attrs.get(attrId)?.unit?.trim() || null,
        values: products.map((p) => {
          const row = (valuesMap.get(p.id) ?? []).find((x) => x.productAttributeId === attrId);
          return this.comparisonAttributeCell(row, attrs.get(attrId));
        }),
      })),
    }));
  });

  /** Підпис активної категорії для підзаголовка таблиці. */
  activeCategoryLabel = computed(() => {
    const id = this.activeCategoryId();
    if (!id) return null;
    return this.grouped().find((g) => g.categoryId === id)?.categoryName ?? null;
  });

  /** Атрибутні групи з урахуванням обраного фільтра. */
  filteredAttributeRowGroups = computed((): ComparisonAttributeGroupSection[] => {
    const groups = this.attributeRowGroups();
    const mode = this.attrFilterMode();
    if (mode === 'all') {
      return groups;
    }

    const keepRow = (row: ComparisonAttributeValueRow): boolean => {
      const cells = row.values;
      switch (mode) {
        case 'matching':
          return this.comparisonCellsAllComparableMatch(cells);
        case 'different':
          return !this.comparisonCellsAllComparableMatch(cells);
        case 'allFilled':
          return this.comparisonCellsAllFilled(cells);
        default:
          return true;
      }
    };

    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter(keepRow),
      }))
      .filter((g) => g.rows.length > 0)
      .map((g, stripe) => ({ ...g, stripe }));
  });

  readonly isAuthenticated = this.auth.isAuthenticated;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
    if (this.auth.isAuthenticated()) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      items: this.relations.getMyComparison(),
      categories: this.categories.getAll().pipe(catchError(() => of([]))),
      brands: this.brands.getAll().pipe(catchError(() => of([]))),
      attributes: this.attributeService.getAll().pipe(catchError(() => of([]))),
      attributeGroups: this.attributeGroups.getAll().pipe(catchError(() => of([]))),
    })
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of({
            items: [] as ProductResponseDto[],
            categories: [] as { id: string; name: string }[],
            brands: [] as BrandResponseDto[],
            attributes: [] as ProductAttributeResponseDto[],
            attributeGroups: [] as AttributeGroupResponseDto[],
          });
        }),
      )
      .subscribe(({ items, categories, brands, attributes, attributeGroups }) => {
        const active = sortProductsByComparisonAddedAtDesc(items).filter((p) => p.isActive);
        this.items.set(active);
        this.categoryNames.set(new Map(categories.map((c) => [c.id, c.name])));
        this.brandCatalog.set(brands);
        this.allAttributes.set(new Map(attributes.map((a) => [a.id, a])));
        this.attributeGroupsById.set(new Map(attributeGroups.map((g) => [g.id, g])));
        this.loadAttributeValues(active);
        this.loadProductImages(active);
        this.loading.set(false);
      });
  }

  private loadAttributeValues(products: ProductResponseDto[]): void {
    if (products.length === 0) {
      this.valuesByProduct.set(new Map());
      return;
    }
    const requests = products.map((p) =>
      this.attributeValues
        .getByProductId(p.id)
        .pipe(catchError(() => of([] as ProductAttributeValueResponseDto[]))),
    );
    forkJoin(requests).subscribe((lists) => {
      const next = new Map<string, ProductAttributeValueResponseDto[]>();
      products.forEach((p, i) => next.set(p.id, lists[i] ?? []));
      this.valuesByProduct.set(next);
    });
  }

  private loadProductImages(products: ProductResponseDto[]): void {
    if (products.length === 0) {
      this.imageUrls.set(new Map());
      return;
    }
    const requests = products.map((p) => this.mediaUrlCache.getUrl(p.mainImageKey));
    forkJoin(requests).subscribe((urls) => {
      const next = new Map<string, string | null>();
      products.forEach((p, i) => next.set(p.id, urls[i] ?? null));
      this.imageUrls.set(next);
    });
  }

  remove(id: string): void {
    this.comparison.toggleComparison(id).subscribe(() => {
      this.items.update((rows) => rows.filter((p) => p.id !== id));
      this.valuesByProduct.update((map) => {
        const next = new Map(map);
        next.delete(id);
        return next;
      });
      this.imageUrls.update((map) => {
        const next = new Map(map);
        next.delete(id);
        return next;
      });
    });
  }

  compareCategory(categoryId: string): void {
    this.activeCategoryId.set(categoryId);
    this.attrFilterMode.set('all');
  }

  clearCategoryCompare(): void {
    this.activeCategoryId.set(null);
    this.attrFilterMode.set('all');
  }

  onAttrFilterChange(e: MatButtonToggleChange): void {
    const v = e.value as ComparisonAttrFilterMode;
    if (v === 'all' || v === 'matching' || v === 'different' || v === 'allFilled') {
      this.attrFilterMode.set(v);
    }
  }

  productLabel(p: ProductResponseDto): string {
    return productLocalizedName(p, this.lang());
  }

  productPublicLinkSegments(p: ProductResponseDto): string[] | null {
    const st = resolveProductCatalogDisplayState(p);
    if (isMissingFromDatabaseState(st) || isArchivedFromSaleState(st)) return null;
    const slug = p.slug?.trim();
    return slug ? ['/products', slug] : null;
  }

  productPurchaseBlocked(p: ProductResponseDto): boolean {
    return isCatalogPurchaseBlocked(p);
  }

  productImageUrl(productId: string): string | null {
    return this.imageUrls().get(productId) ?? null;
  }

  private attributeLabel(attributeId: string): string {
    const a = this.allAttributes().get(attributeId);
    if (!a) return attributeId;
    const lang = this.lang().toLowerCase().split('-')[0];
    const localized = a.translations?.find((t) => t.languageCode.toLowerCase().split('-')[0] === lang)?.name?.trim();
    if (localized) return localized;
    return a.name;
  }

  private attributeGroupLabel(groupId: string): string {
    const g = this.attributeGroupsById().get(groupId);
    if (!g) return groupId;
    const lang = this.lang().toLowerCase().split('-')[0];
    const localized = g.translations?.find((t) => t.languageCode.toLowerCase().split('-')[0] === lang)?.name?.trim();
    if (localized) return localized;
    return g.name?.trim() || groupId;
  }

  comparisonAttributeCell(
    row: ProductAttributeValueResponseDto | undefined,
    attr: ProductAttributeResponseDto | undefined,
  ): ComparisonAttrCell {
    if (!row) {
      return { kind: 'missing' };
    }
    const unit = attr?.unit?.trim() || null;
    if (attr && normalizeAttributeType(attr.type) === AttributeType.Boolean) {
      return { kind: 'boolean', value: this.coerceBooleanAttributeValue(row) };
    }
    return { kind: 'text', text: this.displayAttributeValueWithUnit(row, unit) };
  }

  private coerceBooleanAttributeValue(row: ProductAttributeValueResponseDto): boolean {
    const raw = row.boolValue as unknown;
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    const s = String(row.stringValue ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'так'].includes(s)) return true;
    if (['false', '0', 'no', 'n', 'ні'].includes(s)) return false;
    return false;
  }

  private displayAttributeValue(row: ProductAttributeValueResponseDto): string {
    if (row.stringValue != null && String(row.stringValue).trim() !== '') return row.stringValue;
    if (row.decimalValue != null) return String(row.decimalValue);
    if (row.intValue != null) return String(row.intValue);
    if (row.boolValue != null) return row.boolValue ? '✓' : '✗';
    const lang = this.lang().toLowerCase().split('-')[0];
    const tr = row.translations ?? [];
    const match = tr.find((t) => t.languageCode.toLowerCase().split('-')[0] === lang && t.value?.trim());
    if (match) return match.value;
    const uk = tr.find((t) => t.languageCode.toLowerCase().startsWith('uk') && t.value?.trim());
    if (uk) return uk.value;
    const en = tr.find((t) => t.languageCode.toLowerCase().startsWith('en') && t.value?.trim());
    if (en) return en.value;
    const any = tr.find((t) => t.value?.trim());
    return any?.value ?? '—';
  }

  private displayAttributeValueWithUnit(row: ProductAttributeValueResponseDto, unit: string | null): string {
    const value = this.displayAttributeValue(row);
    if (!unit || value === '—') {
      return value;
    }
    return `${value} ${unit}`;
  }

  private productPriceLabel(p: ProductResponseDto): string {
    const value = p.discountedPrice != null ? p.discountedPrice : p.price;
    return `${value} ${this.translate.instant('PRODUCTS.CURRENCY')}`;
  }

  private brandCellById(brandId: string): { label: string; slug: string | null } {
    const b = this.brandCatalog().find((x) => x.id === brandId);
    if (!b) {
      return { label: '—', slug: null };
    }
    return {
      label: brandLocalizedName(b, this.lang()),
      slug: b.slug?.trim() || null,
    };
  }

  private comparisonCellsComparableKey(cell: ComparisonAttrCell): string {
    switch (cell.kind) {
      case 'missing':
        return '|m|';
      case 'boolean':
        return cell.value ? '|b|1' : '|b|0';
      case 'text': {
        const t = cell.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        return `|t|${t}`;
      }
    }
  }

  private comparisonCellsAllComparableMatch(values: ComparisonAttrCell[]): boolean {
    if (values.length <= 1) return true;
    const k0 = this.comparisonCellsComparableKey(values[0]);
    return values.every((c) => this.comparisonCellsComparableKey(c) === k0);
  }

  private comparisonCellsAllFilled(values: ComparisonAttrCell[]): boolean {
    return values.length > 0 && values.every((c) => c.kind !== 'missing');
  }
}
