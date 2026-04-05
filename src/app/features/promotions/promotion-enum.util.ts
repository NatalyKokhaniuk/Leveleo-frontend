import { DiscountType, PromotionLevel } from './promotion.types';

/**
 * Mat-select і відповіді API можуть дати рядок або число.
 * Бекенд .NET очікує числові enum у JSON (0, 1), а не "Cart"/"Percentage".
 */
export function toPromotionLevel(v: unknown): PromotionLevel {
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v as PromotionLevel;
  }
  if (typeof v === 'string') {
    const n = Number(v);
    if (!Number.isNaN(n)) {
      return n as PromotionLevel;
    }
    const s = v.trim();
    if (s === 'Product' || s === '0') {
      return PromotionLevel.Product;
    }
    if (s === 'Cart' || s === '1') {
      return PromotionLevel.Cart;
    }
  }
  return PromotionLevel.Product;
}

export function toDiscountType(v: unknown): DiscountType {
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v as DiscountType;
  }
  if (typeof v === 'string') {
    const n = Number(v);
    if (!Number.isNaN(n)) {
      return n as DiscountType;
    }
    const s = v.trim();
    if (s === 'Percentage' || s === '0') {
      return DiscountType.Percentage;
    }
    if (s === 'FixedAmount' || s === '1') {
      return DiscountType.FixedAmount;
    }
  }
  return DiscountType.Percentage;
}
