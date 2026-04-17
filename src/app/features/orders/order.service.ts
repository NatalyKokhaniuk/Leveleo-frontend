import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import {
  AdminOrderListFilterDto,
  CreateOrderResultDto,
  OrderAdminUpdateDto,
  OrderCreateDto,
  OrderDetailDto,
  OrderListFilterDto,
  OrderSummaryDto,
  PagedResultDto,
} from './order.types';

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return query.length > 0 ? `?${query.join('&')}` : '';
}

function asOrderList(data: unknown): OrderSummaryDto[] {
  if (Array.isArray(data)) return data as OrderSummaryDto[];
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as OrderSummaryDto[];
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private api = inject(ApiService);
  /** OrdersController: /api/Orders */
  private readonly base = '/Orders';

  create(dto: OrderCreateDto): Observable<CreateOrderResultDto> {
    return this.api.post<CreateOrderResultDto>(this.base, dto);
  }

  /** GET /api/Orders/my-orders?startDate=&endDate= */
  getMyOrders(filters: OrderListFilterDto = {}): Observable<OrderSummaryDto[]> {
    const suffix = toQuery({ startDate: filters.startDate, endDate: filters.endDate });
    return this.api.get<unknown>(`${this.base}/my-orders${suffix}`).pipe(map(asOrderList));
  }

  /** GET /api/Orders/{orderId} */
  getById(orderId: string): Observable<OrderDetailDto> {
    return this.api.get<OrderDetailDto>(`${this.base}/${encodeURIComponent(orderId)}`);
  }

  /** GET /api/Orders/number/{orderNumber} */
  getByOrderNumber(orderNumber: string): Observable<OrderDetailDto> {
    return this.api.get<OrderDetailDto>(`${this.base}/number/${encodeURIComponent(orderNumber)}`);
  }

  /** GET /api/Orders/user/{userId}?startDate=&endDate= */
  getUserOrders(userId: string, filters: OrderListFilterDto = {}): Observable<OrderSummaryDto[]> {
    const suffix = toQuery({ startDate: filters.startDate, endDate: filters.endDate });
    return this.api
      .get<unknown>(`${this.base}/user/${encodeURIComponent(userId)}${suffix}`)
      .pipe(map(asOrderList));
  }

  /** GET /api/Orders/admin/all?... */
  getAdminAll(filters: AdminOrderListFilterDto = {}): Observable<PagedResultDto<OrderSummaryDto>> {
    const suffix = toQuery({
      page: filters.page,
      pageSize: filters.pageSize,
      status: filters.status,
      orderNumber: filters.orderNumber,
      userId: filters.userId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    });
    return this.api
      .get<unknown>(`${this.base}/admin/all${suffix}`)
      .pipe(map((raw) => asPagedOrderList(raw, filters.page, filters.pageSize)));
  }

  /** PUT /api/Orders/{orderId} */
  update(orderId: string, dto: OrderAdminUpdateDto): Observable<OrderDetailDto> {
    return this.api.put<OrderDetailDto>(`${this.base}/${encodeURIComponent(orderId)}`, dto);
  }

  /** POST /api/Orders/{orderId}/cancel */
  cancel(orderId: string): Observable<OrderDetailDto> {
    return this.api.post<OrderDetailDto>(`${this.base}/${encodeURIComponent(orderId)}/cancel`, {});
  }
}

function asPagedOrderList(
  data: unknown,
  fallbackPage = 1,
  fallbackPageSize = 20,
): PagedResultDto<OrderSummaryDto> {
  if (!data || typeof data !== 'object') {
    return { items: [], page: fallbackPage, pageSize: fallbackPageSize, totalCount: 0, totalPages: 0 };
  }
  const o = data as Record<string, unknown>;
  const items = asOrderList(o['items'] ?? o['Items'] ?? []);
  const page = num(o['page'] ?? o['Page'], fallbackPage);
  const pageSize = num(o['pageSize'] ?? o['PageSize'], fallbackPageSize);
  const totalCount = num(o['totalCount'] ?? o['TotalCount'], items.length);
  const totalPages = num(o['totalPages'] ?? o['TotalPages'], Math.ceil(totalCount / Math.max(1, pageSize)));
  return { items, page, pageSize, totalCount, totalPages };
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
