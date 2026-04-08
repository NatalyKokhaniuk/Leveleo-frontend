import { ProductResponseDto } from '../products/product.types';

/** Відповідає ShoppingCartDto / ShoppingCartItemDto на бекенді. */
export interface ShoppingCartItemDto {
  /** Старий/спрощений формат. */
  productId?: string;
  /** Актуальний формат з бекенду (див. ShoppingCartService.MapToDtoAsync). */
  product?: ProductResponseDto;
  quantity: number;
  price?: number;
  priceAfterProductPromotion?: number;
  priceAfterCartPromotion?: number;
}

export interface AppliedCartPromotionDto {
  id: string;
  slug?: string;
  name?: string | null;
  discountType?: number;
  discountValue?: number;
}

export interface ShoppingCartDto {
  couponCode?: string | null;
  items?: ShoppingCartItemDto[] | null;
  totalOriginalPrice?: number;
  totalProductDiscount?: number;
  totalCartDiscount?: number;
  totalPayable?: number;
  appliedCartPromotion?: AppliedCartPromotionDto | null;
}

export interface AddCartItemDto {
  productId: string;
  quantity: number;
}

export interface ApplyCouponDto {
  couponCode: string;
}
