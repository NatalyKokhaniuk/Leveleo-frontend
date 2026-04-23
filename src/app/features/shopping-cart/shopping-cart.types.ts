import { ProductResponseDto } from '../products/product.types';
import type { PromotionTranslationDto } from '../promotions/promotion.types';

/**
 * Результат останньої спроби застосувати купон (`ShoppingCartDto.couponApplyResult`).
 * На бекенді додано зокрема `UsageLimitExceeded = 5`.
 */
export enum ApplyCouponResult {
  Success = 0,
  UsageLimitExceeded = 5,
}

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
  maxUsages?: number | null;
  usedCount?: number | null;
  translations?: PromotionTranslationDto[] | null;
}

export interface ShoppingCartDto {
  id?: string;
  userId?: string;
  couponCode?: string | null;
  /** Код останньої спроби застосування купона (enum на бекенді). */
  couponApplyResult?: ApplyCouponResult | number | null;
  /** Текст від бекенда (помилка / пояснення). */
  couponApplyMessage?: string | null;
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
