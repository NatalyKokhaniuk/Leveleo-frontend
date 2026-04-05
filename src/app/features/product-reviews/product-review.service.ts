import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { ProductReviewPublicDto } from './product-review.types';

/**
 * Публічні відгуки по товару.
 * Очікується GET /api/products/{id}/reviews (масив або { items }).
 * Якщо ендпоінта ще немає — повертається порожній масив.
 */
@Injectable({ providedIn: 'root' })
export class ProductReviewService {
  private api = inject(ApiService);

  getPublicByProductId(productId: string): Observable<ProductReviewPublicDto[]> {
    return this.api.get<unknown>(`/products/${encodeURIComponent(productId)}/reviews`).pipe(
      map((body) => this.normalizeList(body)),
      catchError(() => of([])),
    );
  }

  private normalizeList(body: unknown): ProductReviewPublicDto[] {
    if (Array.isArray(body)) {
      return body.map((x, i) => this.normalizeOne(x, i)).filter((x): x is ProductReviewPublicDto => x != null);
    }
    if (body && typeof body === 'object' && 'items' in body) {
      const items = (body as { items?: unknown }).items;
      if (Array.isArray(items)) {
        return items.map((x, i) => this.normalizeOne(x, i)).filter((x): x is ProductReviewPublicDto => x != null);
      }
    }
    return [];
  }

  private normalizeOne(raw: unknown, index: number): ProductReviewPublicDto | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const o = raw as Record<string, unknown>;
    const id =
      typeof o['id'] === 'string'
        ? o['id']
        : typeof o['Id'] === 'string'
          ? (o['Id'] as string)
          : `idx-${index}`;
    const rating = Number(o['rating'] ?? o['Rating'] ?? 0);
    const comment =
      typeof o['comment'] === 'string'
        ? o['comment']
        : typeof o['Comment'] === 'string'
          ? (o['Comment'] as string)
          : typeof o['text'] === 'string'
            ? (o['text'] as string)
            : null;
    const userDisplayName =
      typeof o['userDisplayName'] === 'string'
        ? o['userDisplayName']
        : typeof o['UserDisplayName'] === 'string'
          ? (o['UserDisplayName'] as string)
          : typeof o['authorName'] === 'string'
            ? (o['authorName'] as string)
            : null;
    const createdAt =
      typeof o['createdAt'] === 'string'
        ? o['createdAt']
        : typeof o['CreatedAt'] === 'string'
          ? (o['CreatedAt'] as string)
          : null;
    return {
      id,
      rating: Number.isFinite(rating) ? rating : 0,
      comment,
      userDisplayName,
      createdAt,
    };
  }
}
