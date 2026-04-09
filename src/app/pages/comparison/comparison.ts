import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth/services/auth.service';
import { ComparisonStateService } from '../../core/comparison/comparison-state.service';
import { MediaUrlCacheService } from '../../core/services/media-url-cache.service';
import { ProductAttributeValueResponseDto } from '../../features/product-attribute-values/product-attribute-value.types';
import { ProductAttributeValueService } from '../../features/product-attribute-values/product-attribute-value.service';
import { ProductAttributeResponseDto } from '../../features/product-attributes/product-attribute.types';
import { ProductAttributeService } from '../../features/product-attributes/product-attribute.service';
import { brandLocalizedName } from '../../features/brands/brand-display-i18n';
import { BrandService } from '../../features/brands/brand.service';
import { BrandResponseDto } from '../../features/brands/brand.types';
import { productLocalizedName } from '../../features/products/product-display-i18n';
import { UserProductRelationsService } from '../../features/user-product-relations/user-product-relations.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { CategoryService } from '../../features/categories/category.service';
import { HorizontalDragScrollDirective } from '../../shared/directives/horizontal-drag-scroll.directive';
import { ProductCommerceToolbarComponent } from '../products/product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductDetailTabsComponent } from '../products/product-detail-tabs/product-detail-tabs.component';
import {
  ProductQuickViewDialogComponent,
  ProductQuickViewDialogData,
} from '../products/product-quick-view-dialog/product-quick-view-dialog.component';

@Component({
  selector: 'app-comparison',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    HorizontalDragScrollDirective,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
  ],
  templateUrl: './comparison.html',
  styleUrl: './comparison.scss',
})
export class ComparisonPage implements OnInit {
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private relations = inject(UserProductRelationsService);
  private comparison = inject(ComparisonStateService);
  private categories = inject(CategoryService);
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
  valuesByProduct = signal<Map<string, ProductAttributeValueResponseDto[]>>(new Map());
  lang = signal(this.translate.currentLang || 'uk');
  brandNames = computed(() => {
    const lang = this.lang();
    return new Map(this.brandCatalog().map((b) => [b.id, brandLocalizedName(b, lang)]));
  });

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
    return this.visibleItems().map((p) => this.brandLabelById(p.brandId));
  });
  attributeRows = computed(() => {
    const products = this.visibleItems();
    const attrs = this.allAttributes();
    const valuesMap = this.valuesByProduct();
    const attrIds = new Set<string>();
    for (const p of products) {
      const rows = valuesMap.get(p.id) ?? [];
      for (const r of rows) {
        attrIds.add(r.productAttributeId);
      }
    }
    const sorted = Array.from(attrIds).sort((a, b) => this.attributeLabel(a).localeCompare(this.attributeLabel(b)));
    return sorted.map((attrId) => ({
      attrId,
      label: this.attributeLabel(attrId),
      unit: attrs.get(attrId)?.unit?.trim() || null,
      values: products.map((p) => {
        const row = (valuesMap.get(p.id) ?? []).find((x) => x.productAttributeId === attrId);
        return row ? this.displayAttributeValueWithUnit(row, attrs.get(attrId)?.unit?.trim() || null) : '—';
      }),
    }));
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
    })
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of({
            items: [] as ProductResponseDto[],
            categories: [] as { id: string; name: string }[],
            brands: [] as BrandResponseDto[],
            attributes: [] as ProductAttributeResponseDto[],
          });
        }),
      )
      .subscribe(({ items, categories, brands, attributes }) => {
        const active = items.filter((p) => p.isActive);
        this.items.set(active);
        this.categoryNames.set(new Map(categories.map((c) => [c.id, c.name])));
        this.brandCatalog.set(brands);
        this.allAttributes.set(new Map(attributes.map((a) => [a.id, a])));
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
  }

  clearCategoryCompare(): void {
    this.activeCategoryId.set(null);
  }

  productLabel(p: ProductResponseDto): string {
    return productLocalizedName(p, this.lang());
  }

  productImageUrl(productId: string): string | null {
    return this.imageUrls().get(productId) ?? null;
  }

  openQuickViewFromLink(event: MouseEvent, product: ProductResponseDto): void {
    event.preventDefault();
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

  private attributeLabel(attributeId: string): string {
    const a = this.allAttributes().get(attributeId);
    if (!a) return attributeId;
    const lang = this.lang().toLowerCase().split('-')[0];
    const localized = a.translations?.find((t) => t.languageCode.toLowerCase().split('-')[0] === lang)?.name?.trim();
    if (localized) return localized;
    return a.name;
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

  private brandLabelById(brandId: string): string {
    return this.brandNames().get(brandId) ?? '—';
  }
}
