/** GET /api/payments/{paymentId} — JSON camelCase, enum як рядки */
export interface PaymentResponseDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  /** Може бути null, якщо LiqPay ще не присвоїв id */
  liqPayPaymentId?: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export const PAYMENT_STATUS_VALUES = ['Pending', 'Success', 'Failure', 'Refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

/** POST /api/payments/{id}/cancel та /refund — успіх 200 з тілом повідомлення */
export interface PaymentMessageResponseDto {
  message?: string;
}

/** Елемент списку GET /api/payments?... */
export interface PaymentListItemDto {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  liqPayPaymentId: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  /** Термін дії інвойсу (частіше для Pending) */
  expireAt?: string;
}

/** Сортування GET /api/payments (без урахування регістру на бекенді) */
export type AdminPaymentSortBy = 'CreatedAt' | 'Amount' | 'Status' | 'ExpireAt';

/** Query GET /api/payments (AdminPaymentFilterDto) */
export interface AdminPaymentFilterDto {
  status?: string;
  /** ISO date-time, фільтр createdAt >= startDate */
  startDate?: string;
  /** ISO date-time, фільтр createdAt <= endDate */
  endDate?: string;
  sortBy?: AdminPaymentSortBy | string;
  sortDirection?: 'asc' | 'desc' | string;
  page?: number;
  pageSize?: number;
}
