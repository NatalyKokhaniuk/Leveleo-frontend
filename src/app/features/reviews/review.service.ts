import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateReviewDto, PagedReviews, ProductReviewsDto, ReviewDto, UpdateReviewDto } from './review.types';

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Підтримка camelCase та PascalCase з ASP.NET. */
function normalizeReviewRow(raw: unknown): ReviewDto {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const g = (camel: string, pascal: string): unknown => r[camel] ?? r[pascal];
  const photos = r['photos'] ?? r['Photos'];
  const videos = r['videos'] ?? r['Videos'];
  return {
    id: String(g('id', 'Id') ?? ''),
    orderItemId: String(g('orderItemId', 'OrderItemId') ?? ''),
    productId: String(g('productId', 'ProductId') ?? ''),
    productSlug: (() => {
      const s = g('productSlug', 'ProductSlug');
      const t = typeof s === 'string' ? s.trim() : '';
      return t || null;
    })(),
    productName: String(g('productName', 'ProductName') ?? ''),
    rating: num(g('rating', 'Rating'), 0),
    comment: (g('comment', 'Comment') as string | null | undefined) ?? null,
    isApproved: Boolean(g('isApproved', 'IsApproved')),
    createdAt: String(g('createdAt', 'CreatedAt') ?? ''),
    updatedAt: String(g('updatedAt', 'UpdatedAt') ?? ''),
    photos: Array.isArray(photos) ? (photos as ReviewDto['photos']) : [],
    videos: Array.isArray(videos) ? (videos as ReviewDto['videos']) : [],
    orderStatus: (g('orderStatus', 'OrderStatus') as string | null | undefined) ?? null,
    isRejected: Boolean(g('isRejected', 'IsRejected')),
    moderationStatus: (g('moderationStatus', 'ModerationStatus') as string | null | undefined) ?? null,
  };
}

function asPagedReviews(raw: unknown, fallbackPage: number, fallbackPageSize: number): PagedReviews {
  if (!raw || typeof raw !== 'object') {
    return { items: [], totalCount: 0, page: fallbackPage, pageSize: fallbackPageSize };
  }
  const o = raw as Record<string, unknown>;
  const itemsRaw = o['items'] ?? o['Items'];
  const items = Array.isArray(itemsRaw) ? itemsRaw.map(normalizeReviewRow) : [];
  return {
    items,
    totalCount: num(o['totalCount'] ?? o['TotalCount'], items.length),
    page: num(o['page'] ?? o['Page'], fallbackPage),
    pageSize: num(o['pageSize'] ?? o['PageSize'], fallbackPageSize),
  };
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private base = '/api/Reviews';

  getPending(page: number, pageSize: number) {
    return this.http
      .get<unknown>(
        `${this.base}/pending?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`,
      )
      .pipe(map((raw) => asPagedReviews(raw, page, pageSize)));
  }

  /** Усі відгуки (схвалені + на модерації) для Admin/Moderator. */
  getAdminAll(page: number, pageSize: number) {
    return this.http
      .get<unknown>(
        `${this.base}/admin/all?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`,
      )
      .pipe(map((raw) => asPagedReviews(raw, page, pageSize)));
  }

  /** 404 → null (відгуку ще немає). */
  getByOrderItem(orderItemId: string): Observable<ReviewDto | null> {
    return this.http
      .get<ReviewDto>(`${this.base}/order-item/${encodeURIComponent(orderItemId)}`)
      .pipe(
        catchError((e: HttpErrorResponse) =>
          e.status === 404 ? of(null) : throwError(() => e),
        ),
      );
  }

  create(dto: CreateReviewDto) {
    return this.http.post<ReviewDto>(this.base, dto);
  }

  update(reviewId: string, dto: UpdateReviewDto) {
    return this.http.put<ReviewDto>(`${this.base}/${encodeURIComponent(reviewId)}`, dto);
  }

  approve(id: string) {
    return this.http.post<ReviewDto>(`${this.base}/${encodeURIComponent(id)}/approve`, {});
  }

  reject(id: string) {
    return this.http.post<ReviewDto>(`${this.base}/${encodeURIComponent(id)}/reject`, {});
  }

  /** Публічні схвалені відгуки для товару. */
  getProductReviews(productId: string, page = 1, pageSize = 50) {
    return this.http.get<ProductReviewsDto>(
      `${this.base}/product/${encodeURIComponent(productId)}?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`,
    );
  }

  /** Усі відгуки товару для адмінки (включно не схвалені). */
  getAdminProductReviews(productId: string, page = 1, pageSize = 50) {
    return this.http.get<ProductReviewsDto>(
      `${this.base}/admin/product/${encodeURIComponent(productId)}?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`,
    );
  }

  deleteReview(reviewId: string) {
    return this.http.delete(`${this.base}/${encodeURIComponent(reviewId)}`);
  }
}
