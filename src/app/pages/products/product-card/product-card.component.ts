import { DecimalPipe } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { productLocalizedName } from '../../../features/products/product-display-i18n';
import { formatAppliedPromotionBadgeLabel } from '../../../features/promotions/promotion-badge-label.util';
import { ProductResponseDto } from '../../../features/products/product.types';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [MatIconModule, TranslateModule, DecimalPipe, RouterLink],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent implements OnInit, OnChanges {
  private mediaUrlCache = inject(MediaUrlCacheService);
  private translate = inject(TranslateService);

  /** Поточна мова UI — для назви з перекладів товару. */
  private lang = signal(this.translate.currentLang || 'uk');

  @Input({ required: true }) product!: ProductResponseDto;
  @Input() isFavorite = false;

  favoriteToggled = output<void>();
  /** Відкрити картку (модалка деталей) — не навігація. */
  openDetail = output<void>();

  imageUrl = signal<string | null>(null);
  imageLoading = signal(false);
  /** Скільки разів уже перезавантажували URL після помилки &lt;img&gt; (захист від циклу). */
  private imageErrorRetries = 0;
  private readonly maxImageErrorRetries = 2;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
    if (this.product) {
      this.loadImage();
    }
  }

  displayName(): string {
    return productLocalizedName(this.product, this.lang());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.imageErrorRetries = 0;
      if (!changes['product'].firstChange && this.product) {
        this.loadImage();
      }
    }
  }

  private loadImage(): void {
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

  /** Pre-signed URL прострочився в браузері, а кеш ще вважав його валідним — запитуємо новий. */
  onImageError(): void {
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

  onCardClick(): void {
    this.openDetail.emit();
  }

  onCardKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openDetail.emit();
    }
  }

  onFavoriteClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggled.emit();
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
    return p.discountedPrice != null ? p.discountedPrice : p.price;
  }

  listPrice(): number {
    return this.product.price;
  }

  hasDiscount(): boolean {
    const p = this.product;
    return p.discountedPrice != null && p.discountedPrice < p.price;
  }

  promotionLabel(): string | null {
    return formatAppliedPromotionBadgeLabel(this.product.appliedPromotion);
  }

  promotionSlug(): string | null {
    const slug = this.product.appliedPromotion?.slug?.trim();
    return slug || null;
  }
}
