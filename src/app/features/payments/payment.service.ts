import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { PaymentResponseDto } from './payment.types';

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return query.length > 0 ? `?${query.join('&')}` : '';
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private api = inject(ApiService);
  /** PaymentsController: /api/payments */
  private readonly base = '/payments';

  /** GET /api/payments/{paymentId} */
  getById(paymentId: string): Observable<PaymentResponseDto> {
    return this.api.get<PaymentResponseDto>(`${this.base}/${encodeURIComponent(paymentId)}`);
  }

  /** POST /api/payments/{paymentId}/cancel — Admin, Moderator */
  cancel(paymentId: string): Observable<PaymentResponseDto> {
    return this.api.post<PaymentResponseDto>(`${this.base}/${encodeURIComponent(paymentId)}/cancel`, {});
  }

  /** POST /api/payments/{paymentId}/refund — Admin, Moderator; query: amount?, reason? */
  refund(
    paymentId: string,
    opts?: { amount?: number; reason?: string },
  ): Observable<PaymentResponseDto> {
    const suffix = toQuery({
      amount: opts?.amount,
      reason: opts?.reason?.trim() || undefined,
    });
    return this.api.post<PaymentResponseDto>(
      `${this.base}/${encodeURIComponent(paymentId)}/refund${suffix}`,
      {},
    );
  }
}
