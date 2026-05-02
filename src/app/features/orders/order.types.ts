import type { ProductCatalogDisplayState } from '../products/product-catalog-display';
import { ShoppingCartDto } from '../shopping-cart/shopping-cart.types';

export interface OrderCreateDto {
  userAddressId: string;
}

export interface OrderListFilterDto {
  startDate?: string;
  endDate?: string;
}

/** Query GET /api/Orders/admin/all (AdminOrderFilterDto) */
export interface AdminOrderListFilterDto extends OrderListFilterDto {
  page?: number;
  pageSize?: number;
  /** OrderStatus — рядок або число (JsonStringEnumConverter) */
  status?: string;
  sortBy?: 'CreatedAt' | 'TotalPayable' | 'Status' | string;
  sortDirection?: 'asc' | 'desc' | string;
}

export interface OrderListItemDto {
  id: string;
  number?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  totalPayable?: number | null;
  /** Альтернативні поля суми з API (за потреби) */
  totalAmount?: number | null;
  total?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Є хоч один товар із Products.isActive === false. */
  hasArchivedProducts?: boolean;
  /** Короткий текст адреси (admin/all, my-orders тощо) */
  addressSummary?: string | null;
  userId?: string | null;
}

export const ORDER_STATUS_VALUES = [
  'Pending',
  'Processing',
  'Shipped',
  'Completed',
  'Cancelled',
  'PaymentFailed',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

/** Значення `status` із API або legacy-форма (JsonStringEnumConverter + allowIntegerValues). */
export type OrderStatusApi = OrderStatus | string | number;

/**
 * Відповідь POST /api/Orders (201).
 * Успіх з оплатою LiqPay: разом `orderId`, пара для checkout — `data`/`payload` (той самий base64) і `signature`
 * (GenerateSignature від того ж payload). Помилка / зміна кошика: `shoppingCart`, `message`, без валідного `orderId` або без пари data+signature.
 */
export interface CreateOrderResultDto {
  /**
   * При успішному створенні замовлення — реальний id.
   * У гілці catch на бекенді (409, message «Order creation has failed») часто лишається Guid.Empty —
   * такий id не використовуйте: замовлення не створено, транзакція відкочена.
   */
  orderId?: string;
  /**
   * Base64 рядок для `<input name="data">` на https://www.liqpay.ua/api/3/checkout.
   * На бекенді дублює `data` (JsonPropertyName "data") для сумісності зі старими клієнтами.
   */
  payload?: string | Record<string, unknown> | null;
  /** Те саме, що `payload` — значення поля **data** форми LiqPay. */
  data?: string | null;
  /**
   * Base64 підпису (SHA1(private_key + data + private_key), далі base64 — як GenerateSignature у LiqPayService).
   * Поле форми: `name="signature"`.
   */
  signature?: string | null;
  shoppingCart?: ShoppingCartDto | null;
  message?: string | null;
  failureDetail?: string | null;
}

export interface OrderSummaryDto extends OrderListItemDto {
  totalAmount?: number | null;
  total?: number | null;
  totalOriginalPrice?: number | null;
  totalProductDiscount?: number | null;
  totalCartDiscount?: number | null;
  [key: string]: unknown;
}

/** Вкладено в замовлення; відповідає `AddressResponseDto` з `/api/Address`. */
export interface OrderAddressDto {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  /** `Warehouse` | `Doors` | `Postomat` у JSON або legacy-число. */
  deliveryType: string | number;
  formattedAddress: string;
  cityRef?: string | null;
  warehouseRef?: string | null;
  postomatRef?: string | null;
  cityName?: string | null;
  warehouseDescription?: string | null;
  street?: string | null;
  house?: string | null;
  flat?: string | null;
  additionalInfo?: string | null;
  isDefault?: boolean | null;
}

/** `PaymentResponseDto` — статус enum у JSON часто `"Pending"` | `"Success"` | …. */
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

/** `DeliveryResponseDto` */
export interface OrderDeliveryDto {
  id: string;
  orderId?: string;
  trackingNumber?: string | null;
  status?: string | null;
  estimatedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  novaPoshtaDocumentRef?: string | null;
  deliveryCost?: number | null;
  address?: OrderAddressDto | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

/** Знімок товару на момент рядка замовлення (OrderLineProductSummaryDto на бекенді). */
export interface OrderLineProductSummaryDto {
  id: string;
  slug?: string | null;
  name?: string | null;
  mainImageKey?: string | null;
  existsInCatalog?: boolean;
  isActive?: boolean | null;
  catalogDisplayState?: ProductCatalogDisplayState | string | null;
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
  productSnapshot?: OrderLineProductSummaryDto | null;
}

export interface OrderDetailDto extends OrderSummaryDto {
  number: string;
  address?: OrderAddressDto | null;
  delivery?: OrderDeliveryDto | null;
  payment?: OrderPaymentDto | null;
  orderItems?: OrderItemDto[] | null;
}

/** PUT /api/Orders/{orderId} — часткове оновлення (Optional на бекенді) */
export interface OrderUpdateDto {
  status?: string;
  addressId?: string;
}

/** @deprecated використовуйте OrderUpdateDto */
export type OrderAdminUpdateDto = OrderUpdateDto;

export interface PagedResultDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
}
