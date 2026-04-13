import { ShoppingCartDto } from '../shopping-cart/shopping-cart.types';

export interface OrderCreateDto {
  userAddressId: string;
}

export interface LiqPayPayloadDto {
  data?: string;
  signature?: string;
  [key: string]: unknown;
}

export interface CreateOrderResultDto {
  orderId?: string;
  payload?: LiqPayPayloadDto | null;
  shoppingCart?: ShoppingCartDto | null;
  message?: string | null;
}

/** Елемент списку GET /api/Orders/my-orders — поля залежать від бекенду. */
export interface OrderSummaryDto {
  id: string;
  orderNumber?: string | null;
  createdAt?: string | null;
  status?: string | null;
  totalAmount?: number | null;
  total?: number | null;
  [key: string]: unknown;
}
