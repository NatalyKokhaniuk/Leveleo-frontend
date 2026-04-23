import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/services/auth.service';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { CartStateService } from '../../../core/shopping-cart/cart-state.service';
import { brandLocalizedName } from '../../../features/brands/brand-display-i18n';
import { BrandService } from '../../../features/brands/brand.service';
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
  private brands = inject(BrandService);
  private translate = inject(TranslateService);
  readonly auth = inject(AuthService);
  private cart = inject(CartStateService);
  private snack = inject(MatSnackBar);

  /** Стабільний id для computed кошика при оновленні @Input. */
  private cardProductId = signal('');
  cartBusy = signal(false);

  qty = computed(() => this.cart.quantities().get(this.cardProductId()) ?? 0);

  /** Поточна мова UI — для назви з перекладів товару. */
  private lang = signal(this.translate.currentLang || 'uk');

  @Input({ required: true }) product!: ProductResponseDto;
  @Input() isFavorite = false;

  favoriteToggled = output<void>();
  /** Відкрити картку (модалка деталей) — не навігація. */
  openDetail = output<void>();

  imageUrl = signal<string | null>(null);
  imageLoading = signal(false);
  /** Локалізована назва бренду для картки. */
  brandName = signal<string | null>(null);
  /** Slug для посилання `/products/brand/:slug`. */
  brandSlug = signal<string | null>(null);
  /** Скільки разів уже перезавантажували URL після помилки &lt;img&gt; (захист від циклу). */
  private imageErrorRetries = 0;
  private readonly maxImageErrorRetries = 2;

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
      this.loadBrand();
    });
    if (this.product) {
      this.cardProductId.set(this.product.id);
      this.loadImage();
      this.loadBrand();
    }
  }

  displayName(): string {
    return productLocalizedName(this.product, this.lang());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      this.imageErrorRetries = 0;
      if (this.product?.id) {
        this.cardProductId.set(this.product.id);
      }
      if (!changes['product'].firstChange && this.product) {
        this.loadImage();
        this.loadBrand();
      }
    }
  }

  private loadBrand(): void {
    const brandId = this.product?.brandId?.trim();
    if (!brandId) {
      this.brandName.set(null);
      this.brandSlug.set(null);
      return;
    }
    this.brands
      .getById(brandId)
      .pipe(take(1), catchError(() => of(null)))
      .subscribe((brand) => {
        if (this.product?.brandId?.trim() !== brandId) {
          return;
        }
        if (!brand) {
          this.brandName.set(null);
          this.brandSlug.set(null);
          return;
        }
        const slug = brand.slug?.trim() || null;
        this.brandSlug.set(slug);
        this.brandName.set(brandLocalizedName(brand, this.lang()));
      });
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

  /** Pre-signed URL прострочився в браузері, а кеш ще вважав його валідним — запитуємо новий. */
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

  maxAvailableQuantity(): number | null {
    const p = this.product;
    if (!p) return null;
    const avail = p.availableQuantity;
    if (typeof avail === 'number' && !Number.isNaN(avail)) {
      return Math.max(0, avail);
    }
    const stock = p.stockQuantity;
    if (typeof stock === 'number' && !Number.isNaN(stock)) {
      return Math.max(0, stock);
    }
    return null;
  }

  canAddMoreToCart(): boolean {
    const max = this.maxAvailableQuantity();
    if (max == null) return true;
    return this.qty() < max;
  }

  cartButtonDisabled(): boolean {
    if (this.cartBusy()) return true;
    if (!this.auth.isAuthenticated()) return false;
    return !this.canAddMoreToCart();
  }

  onCartClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.snack.open(this.translate.instant('CART.GUEST_ONLY'), undefined, { duration: 4500 });
      return;
    }
    if (!this.canAddMoreToCart()) {
      return;
    }
    const id = this.product?.id;
    if (!id) return;
    this.cartBusy.set(true);
    this.cart
      .addToCart(id, 1)
      .pipe(finalize(() => this.cartBusy.set(false)))
      .subscribe({
        error: () => {
          this.snack.open(this.translate.instant('PRODUCTS.LOAD_ERROR'), undefined, { duration: 4000 });
        },
      });
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

  /** Знижка на товар: друга ціна нижча за каталожну (з толерантністю до float). */
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
}
