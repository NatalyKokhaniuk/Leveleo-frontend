import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ProductService } from './product.service';
import { encodeProductFilters } from './product-filter.encode';
import type { ProductFilterDto, ProductResponseDto } from './product.types';

/**
 * Кешує останній успішний список товарів для однакового фільтра,
 * щоб повторний візит на /products не робив зайвий HTTP-запит.
 * Оновлення з бекенду — після TTL або {@link invalidate}.
 */
@Injectable({ providedIn: 'root' })
export class ProductCatalogStateService {
  private productService = inject(ProductService);

  private filterKey = signal<string | null>(null);
  private items = signal<ProductResponseDto[]>([]);
  private totalCount = signal(0);
  private fetchedAt = signal<number | null>(null);

  /** За замовчуванням 15 хв — баланс між «не дьоргати API» і актуальністю. */
  private readonly defaultTtlMs = 15 * 60 * 1000;

  readonly cachedItems = this.items.asReadonly();

  /**
   * Чи є актуальний кеш для цього фільтра (TTL не минув).
   * Використовуйте перед показом спінера на /products: при поверненні на сторінку
   * з тим самим фільтром список береться з пам’яті (~кілька десятків DTO), без HTTP.
   */
  isFreshCache(filter: ProductFilterDto): boolean {
    const key = encodeProductFilters(filter);
    const now = Date.now();
    const last = this.fetchedAt();
    const sameKey = this.filterKey() === key;
    const fresh = last != null && now - last < this.defaultTtlMs;
    return sameKey && fresh && last != null;
  }

  /**
   * Повертає список товарів (з кешу або з API).
   */
  load(
    filter: ProductFilterDto,
    options?: { force?: boolean; maxAgeMs?: number },
  ): Observable<{ items: ProductResponseDto[]; totalCount: number; fromCache: boolean }> {
    const key = encodeProductFilters(filter);
    const maxAge = options?.maxAgeMs ?? this.defaultTtlMs;
    const now = Date.now();
    const last = this.fetchedAt();
    const sameKey = this.filterKey() === key;
    const fresh = last != null && now - last < maxAge;

    if (!options?.force && sameKey && fresh && last != null) {
      return of({
        items: [...this.items()],
        totalCount: this.totalCount(),
        fromCache: true,
      });
    }

    const promo = !!filter.onlyWithActiveProductPromotion;
    const req$ = promo
      ? this.productService.getPromotional({
          page: filter.page,
          pageSize: filter.pageSize,
          sortBy: filter.sortBy,
          categoryId: filter.categoryId,
          brandId: filter.brandId,
        })
      : this.productService.getPaged(filter);

    return req$.pipe(
      tap((res) => {
        this.filterKey.set(key);
        this.items.set(res.items ?? []);
        this.totalCount.set(Math.max(0, res.totalCount ?? 0));
        this.fetchedAt.set(Date.now());
      }),
      map((res) => ({
        items: res.items ?? [],
        totalCount: Math.max(0, res.totalCount ?? 0),
        fromCache: false,
      })),
    );
  }

  /** Примусово наступне завантаження піде в мережу. */
  invalidate(): void {
    this.filterKey.set(null);
    this.fetchedAt.set(null);
    this.items.set([]);
    this.totalCount.set(0);
  }
}
