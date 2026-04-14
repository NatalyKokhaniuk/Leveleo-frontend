import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { PaymentDto } from './payment.types';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private api = inject(ApiService);
  private readonly base = '/payments';

  /** GET /api/payments/{paymentId} */
  getById(paymentId: string): Observable<PaymentDto> {
    return this.api.get<PaymentDto>(`${this.base}/${encodeURIComponent(paymentId)}`);
  }

  /** POST /api/payments/{paymentId}/cancel */
  cancel(paymentId: string): Observable<PaymentDto> {
    return this.api.post<PaymentDto>(`${this.base}/${encodeURIComponent(paymentId)}/cancel`, {});
  }

  /** POST /api/payments/{paymentId}/refund */
  refund(paymentId: string): Observable<PaymentDto> {
    return this.api.post<PaymentDto>(`${this.base}/${encodeURIComponent(paymentId)}/refund`, {});
  }
}

