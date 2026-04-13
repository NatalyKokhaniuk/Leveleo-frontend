import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { MediaUrlCacheService } from '../../core/services/media-url-cache.service';
import {
  promotionLocalizedDescription,
  promotionLocalizedName,
} from '../../features/promotions/promotion-display-i18n';
import { PromotionService } from '../../features/promotions/promotion.service';
import { DiscountType, PromotionResponseDto } from '../../features/promotions/promotion.types';
import { toDiscountType, toPromotionLevel } from '../../features/promotions/promotion-enum.util';
import { PromotionLevel } from '../../features/promotions/promotion.types';

@Component({
  selector: 'app-promotions-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, MatIconModule, DatePipe],
  templateUrl: './promotions.html',
  styleUrl: './promotions.scss',
})
export class PromotionsPage {
  private promotionsApi = inject(PromotionService);
  private media = inject(MediaUrlCacheService);
  private translate = inject(TranslateService);

  loading = signal(true);
  loadError = signal(false);
  rows = signal<PromotionResponseDto[]>([]);
  imageUrls = signal<Map<string, string | null>>(new Map());
  /** Оновлюється при зміні мови, щоб перерахувати назви/описи з translations. */
  private langTick = signal(0);

  readonly DiscountType = DiscountType;
  readonly PromotionLevel = PromotionLevel;

  constructor() {
    this.translate.onLangChange.subscribe(() => this.langTick.update((n) => n + 1));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    /** API `GET /promotions/active` повертає лише id/slug/дати; повні картки — через `getById`. */
    this.promotionsApi
      .getActive()
      .pipe(
        switchMap((list) => {
          const arr = list ?? [];
          if (arr.length === 0) {
            return of([] as PromotionResponseDto[]);
          }
          return forkJoin(
            arr.map((p) =>
              this.promotionsApi.getById(p.id).pipe(catchError(() => of(p))),
            ),
          );
        }),
      )
      .subscribe({
        next: (list) => {
          this.rows.set(list);
          this.loadImages(list);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  private loadImages(list: PromotionResponseDto[]): void {
    if (!list.length) {
      this.imageUrls.set(new Map());
      this.loading.set(false);
      return;
    }
    forkJoin(list.map((p) => this.media.getUrl(p.imageKey).pipe(catchError(() => of(null))))).subscribe((urls) => {
      const map = new Map<string, string | null>();
      list.forEach((p, idx) => map.set(p.id, urls[idx] ?? null));
      this.imageUrls.set(map);
      this.loading.set(false);
    });
  }

  imageUrl(id: string): string | null {
    return this.imageUrls().get(id) ?? null;
  }

  displayName(p: PromotionResponseDto): string {
    this.langTick();
    const lang = this.translate.currentLang || 'uk';
    return promotionLocalizedName(p, lang);
  }

  displayDescription(p: PromotionResponseDto): string | null {
    this.langTick();
    const lang = this.translate.currentLang || 'uk';
    return promotionLocalizedDescription(p, lang);
  }

  levelKey(p: PromotionResponseDto): string {
    return toPromotionLevel(p.level) === PromotionLevel.Cart
      ? 'ADMIN.PROMOTION.LEVEL_CART'
      : 'ADMIN.PROMOTION.LEVEL_PRODUCT';
  }

  discountText(p: PromotionResponseDto): string {
    const type = toDiscountType(p.discountType ?? DiscountType.Percentage);
    const value = p.discountValue ?? 0;
    if (type === DiscountType.FixedAmount) {
      return `${value.toLocaleString('uk-UA')} ₴`;
    }
    return `${value}%`;
  }

  promotionProductsLink(p: PromotionResponseDto): string[] | null {
    if (toPromotionLevel(p.level) !== PromotionLevel.Product) {
      return null;
    }
    const slug = p.slug?.trim();
    if (slug) {
      return ['/products', 'promotion', slug];
    }
    return ['/products'];
  }

  promotionProductsQuery(p: PromotionResponseDto): Record<string, string> | null {
    if (toPromotionLevel(p.level) !== PromotionLevel.Product) {
      return null;
    }
    if (p.slug?.trim()) {
      return {};
    }
    return { promotionId: p.id };
  }
}
