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
import { catchError, forkJoin, Observable, of } from 'rxjs';
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
import {
  productPromotionLinkSlug,
  productPromotionNameBadgeText,
} from '../../../features/promotions/promotion-badge-label.util';
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
  /** Стрілки превʼю / lightbox — лише якщо після збирання списку є ≥2 пункти (унікальні ключі, без дубля main із галереєю). */
  showCarouselNavigation = computed(() => this.mediaItems().length > 1);
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
    this.loadVisualMedia();
    this.loadReviews();
    this.loadCategoryBreadcrumbs();
    this.loadBrand();
    this.loadAttributes();
  }

  /**
   * Головне фото й галерея збираються в одному циклі: раніше `loadImage` і `loadMediaGallery`
   * гнались паралельно й головний URL часто був ще null, тож при одній картці тільки в main (без рядків галереї) `mediaItems` лишалось порожнім.
   */
  private loadVisualMedia(): void {
    const p = this.product;
    if (!p?.id) {
      this.loadVisualMediaWithoutProductId(p);
      return;
    }

    const productId = p.id;
    this.imageLoading.set(true);

    forkJoin({
      mainUrl: this.resolveMainImageUrl$(p),
      images: this.productMedia.getImages(productId).pipe(catchError(() => of([]))),
      videos: this.productMedia.getVideos(productId).pipe(catchError(() => of([] as ProductVideoDto[]))),
    }).subscribe(({ mainUrl, images, videos }) => {
      if (!this.product || this.product.id !== productId) {
        return;
      }

      const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
      const sortedVideos = [...videos].sort((a, b) => a.sortOrder - b.sortOrder);

      const imageReqs = sortedImages.map((img) =>
        this.mediaUrlCache.getUrl(img.imageKey).pipe(catchError(() => of(null))),
      );
      const videoReqs = sortedVideos.map((v) =>
        this.mediaUrlCache.getUrl(v.videoKey).pipe(catchError(() => of(null))),
      );

      /* forkJoin([]) лише complete без next — головне фото без галереї/відео ніколи не зʼявлялося б. */
      const urlTasks = [...imageReqs, ...videoReqs];
      const resolved$ =
        urlTasks.length > 0 ? forkJoin(urlTasks) : of([] as (string | null)[]);

      resolved$.subscribe((resolved) => {
        if (!this.product || this.product.id !== productId) {
          return;
        }

        const items: ProductMediaItem[] = [];
        const mainKeyNorm = p.mainImageKey?.trim() || null;
        const seenGalleryKeys = new Set<string>();
        if (mainKeyNorm) {
          seenGalleryKeys.add(mainKeyNorm);
        }

        if (mainUrl) {
          items.push({
            kind: 'image',
            url: mainUrl,
            thumbUrl: mainUrl,
            key: mainKeyNorm ? `main-key-${mainKeyNorm}` : `main-${productId}`,
          });
        }

        let idx = 0;
        for (const img of sortedImages) {
          const url = resolved[idx++] as string | null;
          if (!url) continue;
          const galleryKey = img.imageKey?.trim() || '';
          if (!galleryKey) continue;
          if (seenGalleryKeys.has(galleryKey)) continue;
          if (mainUrl && url === mainUrl) continue;
          seenGalleryKeys.add(galleryKey);
          items.push({ kind: 'image', url, thumbUrl: url, key: `img-${img.id}` });
        }

        const seenVideoKeys = new Set<string>();
        for (const v of sortedVideos) {
          const url = resolved[idx++] as string | null;
          if (!url) continue;
          const videoKey = v.videoKey?.trim() || '';
          if (videoKey) {
            if (seenVideoKeys.has(videoKey)) continue;
            seenVideoKeys.add(videoKey);
          }
          items.push({ kind: 'video', url, thumbUrl: url, key: `vid-${v.id}` });
        }

        this.mediaItems.set(items);
        this.activeMediaIndex.set(0);

        if (items.length === 0) {
          this.imageUrl.set(null);
          this.imageLoading.set(false);
          return;
        }

        this.applyActiveMedia();
        this.imageLoading.set(false);
      });
    });
  }

  private resolveMainImageUrl$(p: ProductResponseDto): Observable<string | null> {
    const direct = p.mainImageUrl?.trim();
    if (direct) {
      return of(direct);
    }
    const key = p.mainImageKey?.trim();
    if (!key) {
      return of(null);
    }
    return this.mediaUrlCache.getUrl(key).pipe(catchError(() => of(null)));
  }

  private loadVisualMediaWithoutProductId(p: ProductResponseDto | undefined): void {
    if (!p) return;
    const direct = p.mainImageUrl?.trim();
    if (direct) {
      this.mediaItems.set([
        {
          kind: 'image',
          url: direct,
          thumbUrl: direct,
          key: 'main-orphan',
        },
      ]);
      this.activeMediaIndex.set(0);
      this.applyActiveMedia();
      this.imageLoading.set(false);
      return;
    }
    const key = p.mainImageKey?.trim();
    if (!key) {
      this.mediaItems.set([]);
      this.imageUrl.set(null);
      this.imageLoading.set(false);
      return;
    }
    this.imageLoading.set(true);
    this.mediaUrlCache.getUrl(key).subscribe({
      next: (url) => {
        if (!url) {
          this.mediaItems.set([]);
          this.imageUrl.set(null);
          this.imageLoading.set(false);
          return;
        }
        this.mediaItems.set([
          {
            kind: 'image',
            url,
            thumbUrl: url,
            key: 'main-orphan',
          },
        ]);
        this.activeMediaIndex.set(0);
        this.applyActiveMedia();
        this.imageLoading.set(false);
      },
      error: () => {
        this.mediaItems.set([]);
        this.imageUrl.set(null);
        this.imageLoading.set(false);
      },
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

    if (!this.showCarouselNavigation()) {
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
        this.patchActiveRasterMediaUrl(url);
        this.imageLoading.set(false);
      },
      error: () => {
        this.imageUrl.set(null);
        this.imageLoading.set(false);
      },
    });
  }

  /** Після refresh пресайнутого URL синхронізуємо рядок у `mediaItems`, інакше зображення лишиться зі старим url. */
  private patchActiveRasterMediaUrl(url: string | null): void {
    if (!url) return;
    const i = this.activeMediaIndex();
    const list = this.mediaItems();
    const cur = list[i];
    if (cur?.kind !== 'image') return;
    const nextList = [...list];
    nextList[i] = { ...cur, url, thumbUrl: url };
    this.mediaItems.set(nextList);
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

  promotionNameBadge(): string | null {
    return productPromotionNameBadgeText(this.product, this.lang(), this.translate.instant('PRODUCTS.PROMO_BADGE_FALLBACK'), {
      hideCartLevel: true,
    });
  }

  promotionSlug(): string | null {
    return productPromotionLinkSlug(this.product, { hideCartLevel: true });
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
