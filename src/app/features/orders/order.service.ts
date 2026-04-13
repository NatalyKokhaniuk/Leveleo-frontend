import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { CreateOrderResultDto, OrderCreateDto, OrderSummaryDto } from './order.types';

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

  /** GET /api/Orders/my-orders */
  getMyOrders(startDate?: string, endDate?: string): Observable<OrderSummaryDto[]> {
    const qs: string[] = [];
    if (startDate) qs.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) qs.push(`endDate=${encodeURIComponent(endDate)}`);
    const suffix = qs.length ? `?${qs.join('&')}` : '';
    return this.api.get<unknown>(`${this.base}/my-orders${suffix}`).pipe(map(asOrderList));
  }

  /** GET /api/Orders/{orderId} */
  getById(orderId: string): Observable<unknown> {
    return this.api.get<unknown>(`${this.base}/${orderId}`);
  }

  /** GET /api/Orders/number/{orderNumber} */
  getByOrderNumber(orderNumber: string): Observable<unknown> {
    return this.api.get<unknown>(`${this.base}/number/${encodeURIComponent(orderNumber)}`);
  }
}
