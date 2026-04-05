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
  private fetchedAt = signal<number | null>(null);

  /** За замовчуванням 15 хв — баланс між «не дьоргати API» і актуальністю. */
  private readonly defaultTtlMs = 15 * 60 * 1000;

  readonly cachedItems = this.items.asReadonly();

  /**
   * Повертає список товарів (з кешу або з API).
   */
  load(
    filter: ProductFilterDto,
    options?: { force?: boolean; maxAgeMs?: number },
  ): Observable<{ items: ProductResponseDto[]; fromCache: boolean }> {
    const key = encodeProductFilters(filter);
    const maxAge = options?.maxAgeMs ?? this.defaultTtlMs;
    const now = Date.now();
    const last = this.fetchedAt();
    const sameKey = this.filterKey() === key;
    const fresh = last != null && now - last < maxAge;

    if (!options?.force && sameKey && fresh && last != null) {
      return of({ items: [...this.items()], fromCache: true });
    }

    return this.productService.getPaged(filter).pipe(
      tap((res) => {
        this.filterKey.set(key);
        this.items.set(res.items ?? []);
        this.fetchedAt.set(Date.now());
      }),
      map((res) => ({ items: res.items ?? [], fromCache: false })),
    );
  }

  /** Примусово наступне завантаження піде в мережу. */
  invalidate(): void {
    this.filterKey.set(null);
    this.fetchedAt.set(null);
    this.items.set([]);
  }
}
