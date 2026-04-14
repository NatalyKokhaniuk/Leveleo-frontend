export interface PaymentDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  liqPayPaymentId?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

