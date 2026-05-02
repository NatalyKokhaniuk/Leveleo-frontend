import { ProductResponseDto } from '../products/product.types';
import type { PromotionTranslationDto } from '../promotions/promotion.types';

/**
 * `ApplyCouponResult` на бекенді: JsonStringEnumConverter (рядки як у C#, PascalCase)
 * і `allowIntegerValues: true` для десеріалізації запитів.
 */
export const APPLY_COUPON_RESULT_STRINGS = [
  'None',
  'Applied',
  'Invalid',
  'NotEligible',
  'BetterPromotionExists',
  'UsageLimitExceeded',
] as const;

export type ApplyCouponResultString = (typeof APPLY_COUPON_RESULT_STRINGS)[number];

const APPLY_COUPON_BY_ORDINAL: Record<number, ApplyCouponResultString> = {
  0: 'None',
  1: 'Applied',
  2: 'Invalid',
  3: 'NotEligible',
  4: 'BetterPromotionExists',
  5: 'UsageLimitExceeded',
};

/** Нормалізує відповідь GET кошика до канонічного рядка. */
export function coerceApplyCouponResult(raw: unknown): ApplyCouponResultString {
  if (raw == null || raw === '') return 'None';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return APPLY_COUPON_BY_ORDINAL[Math.trunc(raw)] ?? 'None';
  }
  const s = String(raw).trim();
  if ((APPLY_COUPON_RESULT_STRINGS as readonly string[]).includes(s)) {
    return s as ApplyCouponResultString;
  }
  return 'None';
}

export function isApplyCouponSuccess(raw: unknown): boolean {
  return coerceApplyCouponResult(raw) === 'Applied';
}

export function isApplyCouponUsageLimitExceeded(raw: unknown): boolean {
  return coerceApplyCouponResult(raw) === 'UsageLimitExceeded';
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

/** Вкладена акція кошика — підмножина `AppliedPromotionDto` на бекенді. */
export interface AppliedCartPromotionDto {
  id: string;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  imageKey?: string | null;
  /** JSON: `"Product"` | `"Cart"` або число (enum порядку C#). */
  level?: string | number | null;
  /** JSON: `"Percentage"` | `"FixedAmount"` або число. */
  discountType?: string | number | null;
  discountValue?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isCoupon?: boolean;
  isPersonal?: boolean;
  couponCode?: string | null;
  maxUsages?: number | null;
  usedCount?: number | null;
  translations?: PromotionTranslationDto[] | null;
}

export interface ShoppingCartDto {
  id?: string;
  userId?: string;
  couponCode?: string | null;
  /** Після `normalizeShoppingCartDto` — рядок з контракту; сирій відповіді може ще бути числом. */
  couponApplyResult?: ApplyCouponResultString | number | string | null;
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

/** DELETE /api/ShoppingCart/clear */
export interface CartClearResultDto {
  success: boolean;
  message?: string | null;
}
