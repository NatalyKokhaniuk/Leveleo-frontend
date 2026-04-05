import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnChanges,
  OnInit,
  signal,
  SimpleChanges,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { ProductReviewService } from '../../../features/product-reviews/product-review.service';
import { ProductReviewPublicDto } from '../../../features/product-reviews/product-review.types';
import {
  productLocalizedDescription,
  productLocalizedName,
} from '../../../features/products/product-display-i18n';
import { ProductResponseDto } from '../../../features/products/product.types';

/** Фото зліва, таби справа: деталі / відгуки. */
@Component({
  selector: 'app-product-detail-tabs',
  standalone: true,
  imports: [
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    DecimalPipe,
    DatePipe,
  ],
  templateUrl: './product-detail-tabs.component.html',
  styleUrl: './product-detail-tabs.component.scss',
})
export class ProductDetailTabsComponent implements OnInit, OnChanges {
  private mediaUrlCache = inject(MediaUrlCacheService);
  private reviewsApi = inject(ProductReviewService);
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

  private lang = signal(this.translate.currentLang || 'uk');

  imageUrl = signal<string | null>(null);
  imageLoading = signal(false);
  reviewsLoading = signal(false);
  reviews = signal<ProductReviewPublicDto[]>([]);

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
    this.bootstrap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange && this.product) {
      this.bootstrap();
    }
  }

  private bootstrap(): void {
    if (!this.product) {
      return;
    }
    this.loadImage();
    this.loadReviews();
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
    const pr = this.product.appliedPromotion;
    if (!pr) {
      return null;
    }
    return pr.name?.trim() || null;
  }

  reviewStars(rating: number, index: number): boolean {
    return index < Math.round(Math.min(5, Math.max(0, rating)));
  }

  reviewHasText(r: ProductReviewPublicDto): boolean {
    return !!(r.comment && r.comment.trim().length > 0);
  }
}
