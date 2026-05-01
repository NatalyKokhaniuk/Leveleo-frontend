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
  /** Кількість «в рядку кошика» (запитані одиниці). */
  quantity: number;
  /**
   * Реально доступні одиниці (склад).
   * Можуть від бекенду; інакше дивимось product.availableQuantity.
   */
  availableQuantity?: number;
  /** Скільки одиниць входить у підсумок сплати (після резервів/лімітів). */
  quantityApplyingToTotals?: number;
  /** Неможливо викупити цей рядок (окр. сума йде з quantityApplyingToTotals / TotalPrice). */
  isExcludedFromPurchase?: boolean;
  /** Сума до сплати по рядку; узгоджена з quantityApplyingToTotals. */
  totalPrice?: number;
  /** Оригінальна ціна за одиницю в контексті кошика (GET /me). */
  price?: number;
  priceAfterProductPromotion?: number;
  priceAfterCartPromotion?: number;
}

/** Рядок кошика на UI: товар + пер-юніт ціни з ShoppingCartItemDto (джерело істини — GET /me). */
export interface CartLineView {
  product: ProductResponseDto;
  /** Кількість у кошику («заплановані» одиниці). */
  quantityInCart: number;
  /** Одиниці, що входять у підсумок сплати. */
  quantityApplyingToTotals: number;
  /** Доступність для відображення (рядок кошика або товар каталогу). */
  availableQuantityEffective: number;
  /** Рядок у кошику, але не платний через сток тощо. */
  isExcludedFromPurchase: boolean;
  /** Сума рядка з API; коли немає — множимо unit × quantityApplyingToTotals. */
  lineTotalPrice: number | null;
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
  /** Застарілий список; при перерахунку може бути порожнім. */
  removedItems?: ShoppingCartItemDto[] | null;
  /** Товари, що зникли з каталогу — рядки прибрано з кошика. */
  removedMissingProductIds?: string[] | null;
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
