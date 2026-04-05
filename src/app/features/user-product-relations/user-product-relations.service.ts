import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
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
 */
@Injectable({ providedIn: 'root' })
export class UserProductRelationsService {
  private api = inject(ApiService);
  private base = '/UserProductRelations';

  getMyFavorites(): Observable<ProductResponseDto[]> {
    return this.api.get<ProductResponseDto[]>(`${this.base}/favorites/me`);
  }

  addToFavorites(productId: string): Observable<ProductRelationResultDto> {
    return this.api.post<ProductRelationResultDto>(`${this.base}/${encodeURIComponent(productId)}/favorites`, {});
  }

  removeFromFavorites(productId: string): Observable<ProductRelationResultDto> {
    return this.api.delete<ProductRelationResultDto>(`${this.base}/${encodeURIComponent(productId)}/favorites`);
  }
}
