import { ProductResponseDto } from '../products/product.types';
import type { PromotionTranslationDto } from '../promotions/promotion.types';

/** Відповідає ShoppingCartDto / ShoppingCartItemDto на бекенді. */
export interface ShoppingCartItemDto {
  /** Старий/спрощений формат. */
  productId?: string;
  /** Актуальний формат з бекенду (див. ShoppingCartService.MapToDtoAsync). */
  product?: ProductResponseDto;
  quantity: number;
  /** Оригінальна ціна за одиницю в контексті кошика (GET /me). */
  price?: number;
  priceAfterProductPromotion?: number;
  priceAfterCartPromotion?: number;
}

/** Рядок кошика на UI: товар + пер-юніт ціни з ShoppingCartItemDto (джерело істини — GET /me). */
export interface CartLineView {
  product: ProductResponseDto;
  quantity: number;
  unitListPrice: number;
  unitAfterProductPromotion: number;
  unitAfterCartPromotion: number;
}

export interface AppliedCartPromotionDto {
  id: string;
  slug?: string;
  name?: string | null;
  discountType?: number;
  discountValue?: number;
  translations?: PromotionTranslationDto[] | null;
}

export interface ShoppingCartDto {
  id?: string;
  userId?: string;
  couponCode?: string | null;
  items?: ShoppingCartItemDto[] | null;
  removedItems?: ShoppingCartItemDto[] | null;
  cartAdjusted?: boolean;
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
