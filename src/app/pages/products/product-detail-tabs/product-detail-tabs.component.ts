import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  HostListener,
  inject,
  Input,
  OnChanges,
  OnInit,
  signal,
  SimpleChanges,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { brandLocalizedName } from '../../../features/brands/brand-display-i18n';
import { BrandService } from '../../../features/brands/brand.service';
import { BrandResponseDto } from '../../../features/brands/brand.types';
import { categoryLocalizedName } from '../../../features/categories/category-display-i18n';
import { CategoryBreadcrumbsDto, CategoryResponseDto } from '../../../features/categories/category.types';
import { CategoryService } from '../../../features/categories/category.service';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { ProductAttributeValueService } from '../../../features/product-attribute-values/product-attribute-value.service';
import { ProductAttributeValueResponseDto } from '../../../features/product-attribute-values/product-attribute-value.types';
import { ProductAttributeService } from '../../../features/product-attributes/product-attribute.service';
import { ProductAttributeResponseDto } from '../../../features/product-attributes/product-attribute.types';
import { ProductReviewService } from '../../../features/product-reviews/product-review.service';
import { ProductReviewPublicDto } from '../../../features/product-reviews/product-review.types';
import {
  productLocalizedDescription,
  productLocalizedName,
} from '../../../features/products/product-display-i18n';
import { formatAppliedPromotionBadgeLabel } from '../../../features/promotions/promotion-badge-label.util';
import { ProductMediaService } from '../../../features/products/product-media.service';
import { ProductResponseDto, ProductVideoDto } from '../../../features/products/product.types';
import { OrderItemReviewFormComponent } from '../../../shared/components/order-item-review-form/order-item-review-form.component';

type ProductMediaItem = {
  kind: 'image' | 'video';
  url: string;
  thumbUrl: string;
  key: string;
};

/** Фото зліва, таби справа: деталі / відгуки. */
@Component({
  selector: 'app-product-detail-tabs',
  standalone: true,
  imports: [
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    DecimalPipe,
    DatePipe,
    RouterLink,
    OrderItemReviewFormComponent,
  ],
  templateUrl: './product-detail-tabs.component.html',
  styleUrl: './product-detail-tabs.component.scss',
})
export class ProductDetailTabsComponent implements OnInit, OnChanges {
  private mediaUrlCache = inject(MediaUrlCacheService);
  private productMedia = inject(ProductMediaService);
  private reviewsApi = inject(ProductReviewService);
  private attributesApi = inject(ProductAttributeService);
  private attributeValuesApi = inject(ProductAttributeValueService);
  private categories = inject(CategoryService);
  private brands = inject(BrandService);
  private translate = inject(TranslateService);

  @Input({ required: true }) product!: ProductResponseDto;
  /** У вузькому діалозі — трохи компактніша сітка. */
  @Input() compact = false;
  /** Квадратний quick view: заповнення висоти, прокрутка лише в тілі табів. */
  @Input() dialogLayout = false;
  /** Назва показується в заголовку діалогу — прибрати дубль у вкладці «Деталі». */
  @Input() hideTitleInDetailsTab = false;
  /** Більший відступ між зірками рейтингу (наприклад, сторінка обраного). */
  @Input() roomyRating = false;
  /** Для компактних сценаріїв (наприклад, кошик) приховати опис. */
  @Input() hideDescription = false;
  /** Для компактних сценаріїв (наприклад, кошик) приховати атрибути. */
  @Input() hideAttributes = false;
  /** Для окремої сторінки товару: медіа-блок квадратний (висота не менша за ширину). */
  @Input() forceSquareMedia = false;
  /** Рядок замовлення: показати форму залишення відгуку у вкладці «Відгуки». */
  @Input() orderItemId: string | null = null;
  /** Відкрити вкладку відгуків (наприклад, у модалці з замовлення). */
  @Input() openOnReviewsTab = false;

  private lang = signal(this.translate.currentLang || 'uk');

  /** Індекс вкладки: 0 — деталі, 1 — відгуки. */
  selectedTabIndex = signal(0);

  imageUrl = signal<string | null>(null);
  mediaItems = signal<ProductMediaItem[]>([]);
  activeMediaIndex = signal(0);
  lightboxOpen = signal(false);
  imageLoading = signal(false);
  private imageErrorRetries = 0;
  private readonly maxImageErrorRetries = 2;
  reviewsLoading = signal(false);
  reviews = signal<ProductReviewPublicDto[]>([]);
  /** Фільтр списку відгуків за округленою оцінкою (зірками). */
  publicReviewStarsFilter = signal<'' | '1' | '2' | '3' | '4' | '5'>('');

  filteredPublicReviews = computed(() => {
    const stars = this.publicReviewStarsFilter();
    const list = this.reviews();
    if (!stars) return list;
    const n = Number(stars);
    return list.filter((r) => this.roundedReviewRating(r) === n);
  });
  attributeRows = signal<{ id: string; label: string; value: string }[]>([]);
  breadcrumbs = signal<{ label: string; slug: string }[]>([]);
  brandLabel = signal<string | null>(null);
  /** Для посилання на каталог за брендом. */
  brandSlug = signal<string | null>(null);

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
      this.loadCategoryBreadcrumbs();
      this.loadBrand();
      this.loadAttributes();
    });
    this.bootstrap();
    this.syncReviewsTab();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.imageErrorRetries = 0;
      this.closeLightbox();
      if (!changes['product'].firstChange && this.product) {
        this.publicReviewStarsFilter.set('');
        this.bootstrap();
      }
      if (!this.openOnReviewsTab) {
        this.selectedTabIndex.set(0);
      } else {
        this.syncReviewsTab();
      }
    }
    if (changes['openOnReviewsTab'] || changes['orderItemId']) {
      this.syncReviewsTab();
    }
  }

  private syncReviewsTab(): void {
    if (this.openOnReviewsTab && this.orderItemId) {
      this.selectedTabIndex.set(1);
    }
  }

  onTabIndexChange(index: number): void {
    this.selectedTabIndex.set(index);
  }

  onOrderReviewSaved(): void {
    this.loadReviews();
  }

  private bootstrap(): void {
    if (!this.product) {
      return;
    }
    this.loadImage();
    this.loadMediaGallery();
    this.loadReviews();
    this.loadCategoryBreadcrumbs();
    this.loadBrand();
    this.loadAttributes();
  }

  private loadImage(): void {
    const direct = this.product.mainImageUrl?.trim();
    if (direct) {
      this.imageUrl.set(direct);
      this.imageLoading.set(false);
      return;
    }
    const key = this.product.mainImageKey?.trim();
    if (!key) {
      this.imageUrl.set(null);
      this.imageLoading.set(false);
      return;
    }
    this.imageLoading.set(true);
    this.mediaUrlCache.getUrl(key).subscribe({
      next: (url) => {
        this.imageUrl.set(url);
        this.imageLoading.set(false);
      },
      error: () => {
        this.imageUrl.set(null);
        this.imageLoading.set(false);
      },
    });
  }

  private loadMediaGallery(): void {
    if (!this.product?.id) {
      this.mediaItems.set([]);
      this.activeMediaIndex.set(0);
      return;
    }

    forkJoin({
      images: this.productMedia.getImages(this.product.id).pipe(catchError(() => of([]))),
      videos: this.productMedia.getVideos(this.product.id).pipe(catchError(() => of([] as ProductVideoDto[]))),
    }).subscribe(({ images, videos }) => {
      const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
      const sortedVideos = [...videos].sort((a, b) => a.sortOrder - b.sortOrder);

      const imageReqs = sortedImages.map((img) =>
        this.mediaUrlCache.getUrl(img.imageKey).pipe(catchError(() => of(null))),
      );
      const videoReqs = sortedVideos.map((v) =>
        this.mediaUrlCache.getUrl(v.videoKey).pipe(catchError(() => of(null))),
      );

      forkJoin([...imageReqs, ...videoReqs]).subscribe((resolved) => {
        const items: ProductMediaItem[] = [];

        const mainImage = this.imageUrl();
        if (mainImage) {
          items.push({
            kind: 'image',
            url: mainImage,
            thumbUrl: mainImage,
            key: `main-${this.product.id}`,
          });
        }

        let idx = 0;
        for (const img of sortedImages) {
          const url = resolved[idx++] as string | null;
          if (!url) continue;
          if (mainImage && url === mainImage) continue;
          items.push({ kind: 'image', url, thumbUrl: url, key: `img-${img.id}` });
        }
        for (const v of sortedVideos) {
          const url = resolved[idx++] as string | null;
          if (!url) continue;
          items.push({ kind: 'video', url, thumbUrl: url, key: `vid-${v.id}` });
        }

        this.mediaItems.set(items);
        const currentIndex = items.findIndex((m) => m.url === this.imageUrl());
        const nextIndex = currentIndex >= 0 ? currentIndex : 0;
        this.activeMediaIndex.set(nextIndex);
        this.applyActiveMedia();
      });
    });
  }

  selectMedia(index: number): void {
    if (index < 0 || index >= this.mediaItems().length) return;
    this.activeMediaIndex.set(index);
    this.applyActiveMedia();
    this.imageLoading.set(false);
  }

  prevMedia(): void {
    const total = this.mediaItems().length;
    if (total <= 1) return;
    const next = (this.activeMediaIndex() - 1 + total) % total;
    this.selectMedia(next);
  }

  nextMedia(): void {
    const total = this.mediaItems().length;
    if (total <= 1) return;
    const next = (this.activeMediaIndex() + 1) % total;
    this.selectMedia(next);
  }

  isActiveMedia(index: number): boolean {
    return this.activeMediaIndex() === index;
  }

  currentMedia(): ProductMediaItem | null {
    const list = this.mediaItems();
    if (list.length === 0) return null;
    return list[this.activeMediaIndex()] ?? null;
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.lightboxOpen()) {
      event.preventDefault();
      this.closeLightbox();
      return;
    }

    const isArrowLeft = event.key === 'ArrowLeft';
    const isArrowRight = event.key === 'ArrowRight';
    if (!isArrowLeft && !isArrowRight) {
      return;
    }

    if (this.mediaItems().length <= 1) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const inEditable =
      tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
    if (inEditable) {
      return;
    }

    if (!this.lightboxOpen() && tag === 'video') {
      return;
    }

    event.preventDefault();
    if (isArrowLeft) {
      this.prevMedia();
    } else {
      this.nextMedia();
    }
  }

  openLightbox(): void {
    const media = this.currentMedia();
    if (!media) {
      return;
    }
    this.lightboxOpen.set(true);
  }

  closeLightbox(): void {
    this.lightboxOpen.set(false);
  }

  private applyActiveMedia(): void {
    const media = this.currentMedia();
    this.imageUrl.set(media?.url ?? null);
  }

  onImageError(): void {
    if (this.product?.mainImageUrl?.trim()) {
      this.imageUrl.set(null);
      this.imageLoading.set(false);
      return;
    }
    const key = this.product?.mainImageKey?.trim();
    if (!key) {
      return;
    }
    if (this.imageErrorRetries >= this.maxImageErrorRetries) {
      this.imageUrl.set(null);
      return;
    }
    this.imageErrorRetries++;
    this.imageLoading.set(true);
    this.mediaUrlCache.refreshUrl(key).subscribe({
      next: (url) => {
        this.imageUrl.set(url);
        this.imageLoading.set(false);
      },
      error: () => {
        this.imageUrl.set(null);
        this.imageLoading.set(false);
      },
    });
  }

  private loadReviews(): void {
    this.reviewsLoading.set(true);
    this.reviewsApi.getPublicByProductId(this.product.id).subscribe({
      next: (list) => {
        this.reviews.set(list ?? []);
        this.reviewsLoading.set(false);
      },
      error: () => {
        this.reviews.set([]);
        this.reviewsLoading.set(false);
      },
    });
  }

  private loadAttributes(): void {
    if (!this.product?.id) {
      this.attributeRows.set([]);
      return;
    }
    forkJoin({
      attributes: this.attributesApi.getAll().pipe(catchError(() => of([] as ProductAttributeResponseDto[]))),
      values: this.attributeValuesApi
        .getByProductId(this.product.id)
        .pipe(catchError(() => of([] as ProductAttributeValueResponseDto[]))),
    }).subscribe(({ attributes, values }) => {
      const attrsMap = new Map(attributes.map((a) => [a.id, a]));
      const rows = values
        .map((v) => {
          const attr = attrsMap.get(v.productAttributeId);
          if (!attr) return null;
          const label = this.localizedAttributeName(attr);
          const value = this.attributeValueToText(v, attr.unit?.trim() || null);
          if (!value) return null;
          return { id: attr.id, label, value };
        })
        .filter((r): r is { id: string; label: string; value: string } => r != null)
        .sort((a, b) => a.label.localeCompare(b.label));
      this.attributeRows.set(rows);
    });
  }

  private loadCategoryBreadcrumbs(): void {
    const categoryId = this.product?.categoryId;
    if (!categoryId) {
      this.breadcrumbs.set([]);
      return;
    }
    forkJoin({
      current: this.categories.getById(categoryId).pipe(catchError(() => of(null))),
      dto: this.categories.getBreadcrumbs(categoryId).pipe(
        catchError(() => of({ parents: [], children: [] } as CategoryBreadcrumbsDto)),
      ),
    }).subscribe(({ current, dto }) => {
      if (!current) {
        this.breadcrumbs.set([]);
        return;
      }
      const chain = this.buildCategoryChain(current, dto?.parents ?? []);
      this.breadcrumbs.set(
        chain
          .filter((c) => !!c?.slug)
          .map((c) => ({ label: categoryLocalizedName(c, this.lang()), slug: c.slug })),
      );
    });
  }

  private loadBrand(): void {
    const brandId = this.product?.brandId;
    if (!brandId) {
      this.brandLabel.set(null);
      this.brandSlug.set(null);
      return;
    }
    this.brands
      .getById(brandId)
      .pipe(catchError(() => of(null)))
      .subscribe((brand: BrandResponseDto | null) => {
        if (!brand) {
          this.brandLabel.set(null);
          this.brandSlug.set(null);
          return;
        }
        this.brandLabel.set(brandLocalizedName(brand, this.lang()));
        this.brandSlug.set(brand.slug?.trim() || null);
      });
  }

  private buildCategoryChain(
    current: CategoryResponseDto,
    parents: CategoryResponseDto[],
  ): CategoryResponseDto[] {
    const map = new Map<string, CategoryResponseDto>();
    map.set(current.id, current);
    for (const p of parents) {
      map.set(p.id, p);
    }
    const chain: CategoryResponseDto[] = [];
    let node: CategoryResponseDto | undefined = current;
    while (node) {
      chain.unshift(node);
      const parentId = node.parentId ?? null;
      if (!parentId) break;
      node = map.get(parentId);
    }
    return chain;
  }

  displayName(): string {
    return productLocalizedName(this.product, this.lang());
  }

  displayDescription(): string | null {
    return productLocalizedDescription(this.product, this.lang());
  }

  starFilled(index: number): boolean {
    const r = this.product.averageRating;
    if (r == null || Number.isNaN(r)) {
      return false;
    }
    return index < Math.round(Math.min(5, Math.max(0, r)));
  }

  displayPrice(): number {
    const p = this.product;
    const list = Number(p.price);
    const disc = p.discountedPrice;
    if (disc != null && !Number.isNaN(Number(disc))) {
      return Number(disc);
    }
    return list;
  }

  listPrice(): number {
    return Number(this.product.price);
  }

  hasDiscount(): boolean {
    const p = this.product;
    const list = Number(p.price);
    const disc = p.discountedPrice;
    if (disc == null || Number.isNaN(Number(disc))) {
      return false;
    }
    return Number(disc) < list - 0.01;
  }

  promotionLabel(): string | null {
    return formatAppliedPromotionBadgeLabel(this.product.appliedPromotion, this.lang());
  }

  promotionSlug(): string | null {
    const slug = this.product.appliedPromotion?.slug?.trim();
    return slug || null;
  }

  reviewStars(rating: number, index: number): boolean {
    return index < Math.round(Math.min(5, Math.max(0, rating)));
  }

  onPublicReviewStarsFilter(ev: MatSelectChange): void {
    const v = ev.value;
    const s = v === null || v === undefined || v === '' ? '' : String(v);
    this.publicReviewStarsFilter.set(s as '' | '1' | '2' | '3' | '4' | '5');
  }

  roundedReviewRating(r: ProductReviewPublicDto): number {
    return Math.round(Math.min(5, Math.max(0, Number(r.rating) || 0)));
  }

  reviewHasText(r: ProductReviewPublicDto): boolean {
    return !!(r.comment && r.comment.trim().length > 0);
  }

  private localizedAttributeName(attr: ProductAttributeResponseDto): string {
    const code = (this.lang() || 'uk').toLowerCase().split('-')[0];
    const tr = attr.translations?.find((t) => t.languageCode?.toLowerCase().split('-')[0] === code);
    return tr?.name?.trim() || attr.name;
  }

  private attributeValueToText(v: ProductAttributeValueResponseDto, unit: string | null): string | null {
    const value = this.displayAttributeValue(v);
    if (!value || value === '—') return null;
    if (!unit) return value;
    return `${value} ${unit}`;
  }

  private displayAttributeValue(v: ProductAttributeValueResponseDto): string {
    if (v.stringValue != null && String(v.stringValue).trim() !== '') return String(v.stringValue);
    if (v.decimalValue != null) return String(v.decimalValue);
    if (v.intValue != null) return String(v.intValue);
    if (v.boolValue != null) return v.boolValue ? '✓' : '✗';

    const code = (this.lang() || 'uk').toLowerCase().split('-')[0];
    const list = v.translations ?? [];
    const exact = list.find((t) => t.languageCode?.toLowerCase().split('-')[0] === code && t.value?.trim());
    if (exact?.value) return exact.value;
    const uk = list.find((t) => t.languageCode?.toLowerCase().startsWith('uk') && t.value?.trim());
    if (uk?.value) return uk.value;
    const en = list.find((t) => t.languageCode?.toLowerCase().startsWith('en') && t.value?.trim());
    if (en?.value) return en.value;
    const any = list.find((t) => t.value?.trim());
    return any?.value ?? '—';
  }
}
