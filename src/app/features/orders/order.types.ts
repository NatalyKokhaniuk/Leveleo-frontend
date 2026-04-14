import { ShoppingCartDto } from '../shopping-cart/shopping-cart.types';

export interface OrderCreateDto {
  userAddressId: string;
}

export interface OrderListFilterDto {
  startDate?: string;
  endDate?: string;
}

export interface AdminOrderListFilterDto extends OrderListFilterDto {
  page?: number;
  pageSize?: number;
  status?: string;
  orderNumber?: string;
  userId?: string;
}

export interface CreateOrderResultDto {
  orderId?: string;
  payload?: string | Record<string, unknown> | null;
  shoppingCart?: ShoppingCartDto | null;
  message?: string | null;
}

export interface OrderSummaryDto {
  id: string;
  number?: string | null;
  orderNumber?: string | null; // backward compatibility
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  userId?: string | null;
  totalAmount?: number | null;
  totalPayable?: number | null;
  total?: number | null;
  totalOriginalPrice?: number | null;
  totalProductDiscount?: number | null;
  totalCartDiscount?: number | null;
  [key: string]: unknown;
}

export interface OrderAddressDto {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  deliveryType: string | number;
  formattedAddress: string;
  cityName?: string | null;
  warehouseDescription?: string | null;
  street?: string | null;
  house?: string | null;
  flat?: string | null;
  additionalInfo?: string | null;
}

export interface OrderPaymentDto {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  liqPayPaymentId?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OrderDeliveryDto {
  id: string;
  orderId?: string;
  trackingNumber?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountedUnitPrice: number;
  totalOriginalPrice: number;
  totalDiscountedPrice: number;
}

export interface OrderDetailDto extends OrderSummaryDto {
  number: string;
  address?: OrderAddressDto | null;
  delivery?: OrderDeliveryDto | null;
  payment?: OrderPaymentDto | null;
  orderItems?: OrderItemDto[] | null;
}

export interface OrderAdminUpdateDto {
  status?: string;
  userAddressId?: string;
}

export interface PagedResultDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
}
