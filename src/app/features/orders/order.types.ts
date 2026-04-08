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
