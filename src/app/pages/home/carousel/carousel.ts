import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { categoryLocalizedName } from '../../../features/categories/category-display-i18n';
import { CategoryService } from '../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../features/categories/category.types';
import { promotionLocalizedName } from '../../../features/promotions/promotion-display-i18n';
import { toPromotionLevel } from '../../../features/promotions/promotion-enum.util';
import { PromotionService } from '../../../features/promotions/promotion.service';
import { PromotionLevel, PromotionResponseDto } from '../../../features/promotions/promotion.types';

/** Слайд каруселі: категорія або товарна акція без купона (для гостей). */
export type HomeCarouselSlide =
  | { kind: 'category'; category: CategoryResponseDto; imageUrl: string }
  | { kind: 'promotion'; promotion: PromotionResponseDto; imageUrl: string };

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class CarouselComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private categoriesApi = inject(CategoryService);
  private promotionsApi = inject(PromotionService);
  private mediaUrlCache = inject(MediaUrlCacheService);
  private translate = inject(TranslateService);

  slides = signal<HomeCarouselSlide[]>([]);
  loading = signal(true);
  loadError = signal(false);
  lang = signal(this.translate.currentLang || 'uk');

  currentIndex = signal(0);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
    this.loadSlides();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  label(slide: HomeCarouselSlide): string {
    const lang = this.lang();
    if (slide.kind === 'category') {
      return categoryLocalizedName(slide.category, lang);
    }
    return promotionLocalizedName(slide.promotion, lang);
  }

  slideLink(slide: HomeCarouselSlide): string[] {
    if (slide.kind === 'category') {
      return ['/products', 'category', slide.category.slug];
    }
    return ['/products', 'promotion', slide.promotion.slug];
  }

  slideTrackId(slide: HomeCarouselSlide): string {
    return slide.kind === 'category' ? `c-${slide.category.id}` : `p-${slide.promotion.id}`;
  }

  onSlideImgError(slide: HomeCarouselSlide): void {
    const key =
      slide.kind === 'category'
        ? slide.category.imageKey?.trim()
        : slide.promotion.imageKey?.trim();
    if (!key) return;
    this.mediaUrlCache.refreshUrl(key).subscribe((url) => {
      if (!url) return;
      this.slides.update((list) =>
        list.map((s) => {
          if (slide.kind === 'category' && s.kind === 'category' && s.category.id === slide.category.id) {
            return { ...s, imageUrl: url };
          }
          if (slide.kind === 'promotion' && s.kind === 'promotion' && s.promotion.id === slide.promotion.id) {
            return { ...s, imageUrl: url };
          }
          return s;
        }),
      );
    });
  }

  /**
   * Чергування: категорія, акція, категорія, акція… залишок — підряд.
   * Так акції опиняються «між» слайдами категорій.
   */
  private interleaveCategoryAndPromotionSlides(
    categories: HomeCarouselSlide[],
    promotions: HomeCarouselSlide[],
  ): HomeCarouselSlide[] {
    const out: HomeCarouselSlide[] = [];
    const n = Math.min(categories.length, promotions.length);
    for (let i = 0; i < n; i++) {
      out.push(categories[i]);
      out.push(promotions[i]);
    }
    for (let i = n; i < categories.length; i++) {
      out.push(categories[i]);
    }
    for (let i = n; i < promotions.length; i++) {
      out.push(promotions[i]);
    }
    return out;
  }

  private loadSlides(): void {
    this.loading.set(true);
    this.loadError.set(false);
    let categoriesRequestFailed = false;

    forkJoin({
      categories: this.categoriesApi.getAll().pipe(
        catchError(() => {
          categoriesRequestFailed = true;
          return of([] as CategoryResponseDto[]);
        }),
      ),
      promotions: this.promotionsApi.getActive({ guestEligibleOnly: true }).pipe(
        catchError(() => of([] as PromotionResponseDto[])),
      ),
    })
      .pipe(
        switchMap(({ categories, promotions }) => {
          const lang = this.lang();

          const withKeyCats = (categories ?? [])
            .filter((c) => c.isActive && !!(c.imageKey ?? '').trim())
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

          const productPromosGuest = (promotions ?? []).filter(
            (p) =>
              p.isActive &&
              toPromotionLevel(p.level) === PromotionLevel.Product &&
              !!(p.imageKey ?? '').trim() &&
              !p.isCoupon &&
              !p.isPersonal,
          );
          productPromosGuest.sort((a, b) =>
            promotionLocalizedName(a, lang).localeCompare(promotionLocalizedName(b, lang), undefined, {
              sensitivity: 'base',
            }),
          );

          const urlTasks: Observable<HomeCarouselSlide | null>[] = [
            ...withKeyCats.map((c) =>
              this.mediaUrlCache.getUrl(c.imageKey).pipe(
                map((url) =>
                  url
                    ? ({ kind: 'category' as const, category: c, imageUrl: url } satisfies HomeCarouselSlide)
                    : null,
                ),
              ),
            ),
            ...productPromosGuest.map((p) =>
              this.mediaUrlCache.getUrl(p.imageKey!).pipe(
                map((url) =>
                  url
                    ? ({ kind: 'promotion' as const, promotion: p, imageUrl: url } satisfies HomeCarouselSlide)
                    : null,
                ),
              ),
            ),
          ];

          if (urlTasks.length === 0) {
            return of({
              merged: [] as HomeCarouselSlide[],
              categoriesRequestFailed,
            });
          }

          /** Один провалений URL не має «вішати» весь forkJoin (раніше loading лишався true). */
          const safeTasks = urlTasks.map((obs) =>
            obs.pipe(catchError(() => of(null as HomeCarouselSlide | null))),
          );

          return forkJoin(safeTasks).pipe(
            map((rows) => {
              const nCat = withKeyCats.length;
              const catSlides = rows.slice(0, nCat).filter((r): r is HomeCarouselSlide => r != null);
              const promoSlides = rows.slice(nCat).filter((r): r is HomeCarouselSlide => r != null);
              const merged = this.interleaveCategoryAndPromotionSlides(catSlides, promoSlides);
              return { merged, categoriesRequestFailed };
            }),
          );
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ merged, categoriesRequestFailed: catFailed }) => {
          this.slides.set(merged);
          this.currentIndex.set(0);
          this.loadError.set(merged.length === 0 && catFailed);
          this.restartAutoSlide();
        },
        error: () => {
          this.slides.set([]);
          this.currentIndex.set(0);
          this.loadError.set(true);
          this.restartAutoSlide();
        },
      });
  }

  private restartAutoSlide(): void {
    this.stopAutoSlide();
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.slides().length <= 1) return;
    this.intervalId = setInterval(() => {
      if (!this.paused) {
        this.next();
      }
    }, 5000);
  }

  private stopAutoSlide(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  next(): void {
    const n = this.slides().length;
    if (n === 0) return;
    this.currentIndex.set((this.currentIndex() + 1) % n);
  }

  prev(): void {
    const n = this.slides().length;
    if (n === 0) return;
    this.currentIndex.set((this.currentIndex() - 1 + n) % n);
  }

  goTo(i: number): void {
    const n = this.slides().length;
    if (n === 0 || i < 0 || i >= n) return;
    this.currentIndex.set(i);
  }
}
