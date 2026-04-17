/** GET /api/payments/{paymentId} */
export interface PaymentResponseDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  liqPayPaymentId?: string | null;
  /** Pending | Success | Failure | Refunded */
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}
