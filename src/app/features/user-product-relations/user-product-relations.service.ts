import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { normalizeProductResponseDto } from '../products/product-response-normalize.util';
import { ProductResponseDto } from '../products/product.types';

/** Відповідь POST/DELETE favourites (бекенд може повертати додаткові поля). */
export interface ProductRelationResultDto {
  success?: boolean;
  message?: string;
}

/**
 * Відповідає UserProductRelationsController (Authorize).
 * GET /api/UserProductRelations/favorites/me
 * POST /api/UserProductRelations/{productId}/favorites
 * DELETE /api/UserProductRelations/{productId}/favorites
 *
 * Порівняння: GET/POST/DELETE …/comparison/me та …/{productId}/comparison
 */
@Injectable({ providedIn: 'root' })
export class UserProductRelationsService {
  private api = inject(ApiService);
  private base = '/UserProductRelations';

  getMyFavorites(): Observable<ProductResponseDto[]> {
    return this.api.get<unknown>(`${this.base}/favorites/me`).pipe(
      map((raw) =>
        Array.isArray(raw) ? raw.map(normalizeProductResponseDto) : ([] as ProductResponseDto[]),
      ),
    );
  }

  addToFavorites(productId: string): Observable<ProductRelationResultDto> {
    return this.api.post<ProductRelationResultDto>(`${this.base}/${encodeURIComponent(productId)}/favorites`, {});
  }

  removeFromFavorites(productId: string): Observable<ProductRelationResultDto> {
    return this.api.delete<ProductRelationResultDto>(`${this.base}/${encodeURIComponent(productId)}/favorites`);
  }

  getMyComparison(): Observable<ProductResponseDto[]> {
    return this.api.get<unknown>(`${this.base}/comparison/me`).pipe(
      map((raw) =>
        Array.isArray(raw) ? raw.map(normalizeProductResponseDto) : ([] as ProductResponseDto[]),
      ),
    );
  }

  addToComparison(productId: string): Observable<ProductRelationResultDto> {
    return this.api.post<ProductRelationResultDto>(
      `${this.base}/${encodeURIComponent(productId)}/comparison`,
      {},
    );
  }

  removeFromComparison(productId: string): Observable<ProductRelationResultDto> {
    return this.api.delete<ProductRelationResultDto>(
      `${this.base}/${encodeURIComponent(productId)}/comparison`,
    );
  }
}
