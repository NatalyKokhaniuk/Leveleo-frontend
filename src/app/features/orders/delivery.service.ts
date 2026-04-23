import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { DeliveryDto, DeliveryTrackingHistoryItemDto } from './delivery.types';

function asTrackingList(data: unknown): DeliveryTrackingHistoryItemDto[] {
  if (Array.isArray(data)) return data as DeliveryTrackingHistoryItemDto[];
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as DeliveryTrackingHistoryItemDto[];
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private api = inject(ApiService);
  private readonly base = '/Delivery';

  /** GET /api/Delivery/{id} */
  getById(deliveryId: string): Observable<DeliveryDto> {
    return this.api.get<DeliveryDto>(`${this.base}/${encodeURIComponent(deliveryId)}`);
  }

  /** GET /api/Delivery/order/{orderId} */
  getByOrderId(orderId: string): Observable<DeliveryDto> {
    return this.api.get<DeliveryDto>(`${this.base}/order/${encodeURIComponent(orderId)}`);
  }

  /** GET /api/Delivery/order-number/{orderNumber} */
  getByOrderNumber(orderNumber: string): Observable<DeliveryDto> {
    return this.api.get<DeliveryDto>(`${this.base}/order-number/${encodeURIComponent(orderNumber)}`);
  }

  /** GET /api/Delivery/tracking/{trackingNumber} */
  getByTrackingNumber(trackingNumber: string): Observable<DeliveryDto> {
    return this.api.get<DeliveryDto>(`${this.base}/tracking/${encodeURIComponent(trackingNumber)}`);
  }

  /** POST /api/Delivery/create/{orderId} */
  createForOrder(orderId: string): Observable<DeliveryDto> {
    return this.api.post<DeliveryDto>(`${this.base}/create/${encodeURIComponent(orderId)}`, {});
  }

  /** POST /api/Delivery/create-manual/{orderId}?trackingNumber=... */
  createManualForOrder(orderId: string, trackingNumber: string): Observable<DeliveryDto> {
    const tracking = trackingNumber.trim();
    return this.api.post<DeliveryDto>(
      `${this.base}/create-manual/${encodeURIComponent(orderId)}?trackingNumber=${encodeURIComponent(tracking)}`,
      {},
    );
  }

  /** PATCH emulation: POST /api/Delivery/{deliveryId}/status */
  updateStatus(deliveryId: string, body: Record<string, unknown>): Observable<DeliveryDto> {
    return this.api.post<DeliveryDto>(`${this.base}/${encodeURIComponent(deliveryId)}/status`, body);
  }

  /** POST /api/Delivery/{deliveryId}/cancel */
  cancel(deliveryId: string): Observable<DeliveryDto> {
    return this.api.post<DeliveryDto>(`${this.base}/${encodeURIComponent(deliveryId)}/cancel`, {});
  }

  /** GET /api/Delivery/{deliveryId}/tracking-history */
  getTrackingHistory(deliveryId: string): Observable<DeliveryTrackingHistoryItemDto[]> {
    return this.api
      .get<unknown>(`${this.base}/${encodeURIComponent(deliveryId)}/tracking-history`)
      .pipe(map(asTrackingList));
  }
}

