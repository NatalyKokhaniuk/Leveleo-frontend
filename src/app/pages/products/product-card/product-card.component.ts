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
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { ProductResponseDto } from '../../../features/products/product.types';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [MatIconModule, TranslateModule, DecimalPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent implements OnInit, OnChanges {
  private mediaUrlCache = inject(MediaUrlCacheService);

  @Input({ required: true }) product!: ProductResponseDto;
  @Input() isFavorite = false;

  favoriteToggled = output<void>();
  /** Відкрити картку (модалка деталей) — не навігація. */
  openDetail = output<void>();

  imageUrl = signal<string | null>(null);
  imageLoading = signal(false);

  ngOnInit(): void {
    if (this.product) {
      this.loadImage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && !changes['product'].firstChange && this.product) {
      this.loadImage();
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
    const pr = this.product.appliedPromotion;
    if (!pr) {
      return null;
    }
    const n = pr.name?.trim();
    return n || null;
  }
}
