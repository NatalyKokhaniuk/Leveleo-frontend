export interface DeliveryDto {
  id: string;
  orderId?: string;
  trackingNumber?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface DeliveryTrackingHistoryItemDto {
  id?: string;
  status?: string;
  description?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

