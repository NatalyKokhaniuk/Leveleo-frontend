import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { PagedResultDto } from '../orders/order.types';
import {
  AdminPaymentFilterDto,
  PaymentListItemDto,
  PaymentMessageResponseDto,
  PaymentResponseDto,
} from './payment.types';

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return query.length > 0 ? `?${query.join('&')}` : '';
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asPagedPaymentList(
  data: unknown,
  fallbackPage = 1,
  fallbackPageSize = 20,
): PagedResultDto<PaymentListItemDto> {
  if (!data || typeof data !== 'object') {
    return { items: [], page: fallbackPage, pageSize: fallbackPageSize, totalCount: 0, totalPages: 0 };
  }
  const o = data as Record<string, unknown>;
  const rawItems = o['items'] ?? o['Items'] ?? [];
  const items = Array.isArray(rawItems) ? (rawItems as PaymentListItemDto[]) : [];
  const page = num(o['page'] ?? o['Page'], fallbackPage);
  const pageSize = num(o['pageSize'] ?? o['PageSize'], fallbackPageSize);
  const totalCount = num(o['totalCount'] ?? o['TotalCount'], items.length);
  const totalPages = num(o['totalPages'] ?? o['TotalPages'], Math.ceil(totalCount / Math.max(1, pageSize)));
  return { items, page, pageSize, totalCount, totalPages };
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private api = inject(ApiService);
  /**
   * GET /api/payments — список (Admin/Moderator), GET /api/payments/{id} — картка,
   * POST cancel/refund/callback — за документацією API.
   */
  private readonly base = '/payments';

  /**
   * GET /api/payments?status=&startDate=&endDate=&sortBy=&sortDirection=&page=&pageSize=
   * PagedResultDto&lt;PaymentListItemDto&gt;
   */
  getPaged(filters: AdminPaymentFilterDto = {}): Observable<PagedResultDto<PaymentListItemDto>> {
    const suffix = toQuery({
      status: filters.status,
      startDate: filters.startDate,
      endDate: filters.endDate,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    return this.api
      .get<unknown>(`${this.base}${suffix}`)
      .pipe(map((raw) => asPagedPaymentList(raw, filters.page, filters.pageSize)));
  }

  /** GET /api/payments/{paymentId} */
  getById(paymentId: string): Observable<PaymentResponseDto> {
    return this.api.get<PaymentResponseDto>(`${this.base}/${encodeURIComponent(paymentId)}`);
  }

  cancel(paymentId: string): Observable<PaymentResponseDto> {
    return this.api
      .post<PaymentMessageResponseDto>(`${this.base}/${encodeURIComponent(paymentId)}/cancel`, {})
      .pipe(switchMap(() => this.getById(paymentId)));
  }

  refund(
    paymentId: string,
    opts?: { amount?: number; reason?: string },
  ): Observable<PaymentResponseDto> {
    const suffix = toQuery({
      amount: opts?.amount,
      reason: opts?.reason?.trim() || undefined,
    });
    return this.api
      .post<PaymentMessageResponseDto>(
        `${this.base}/${encodeURIComponent(paymentId)}/refund${suffix}`,
        {},
      )
      .pipe(switchMap(() => this.getById(paymentId)));
  }
}
