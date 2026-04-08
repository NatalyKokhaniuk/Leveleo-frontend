import { ShoppingCartItemDto } from './shopping-cart.types';

/** Агрегати з рядків кошика (коректніше, ніж лише totalProductDiscount з DTO). */
export interface CartPricingFromItems {
  /** Σ (каталожна ціна × кількість) — «вітринна» сума без товарних знижок. */
  totalCatalogList: number;
  /** Σ ((product.price − priceAfterProductPromotion) × qty). */
  totalProductDiscount: number;
  /** Σ (priceAfterProductPromotion × qty) — підсумок після товарних акцій, до знижки кошика. */
  subtotalAfterProductPromotions: number;
  /** Σ ((priceAfterProductPromotion − priceAfterCartPromotion) × qty); має збігатись з totalCartDiscount з API. */
  totalCartDiscountFromLines: number;
}

/**
 * Підрахунок знижок і проміжних сум з items[] (див. ShoppingCartItemDto).
 */
export function computePricingFromCartItems(
  items: ShoppingCartItemDto[] | null | undefined,
): CartPricingFromItems {
  let totalCatalogList = 0;
  let totalProductDiscount = 0;
  let subtotalAfterProductPromotions = 0;
  let totalCartDiscountFromLines = 0;

  for (const it of items ?? []) {
    const q = Math.max(0, Number(it.quantity) || 0);
    if (q === 0) continue;

    const product = it.product;
    const listUnit = product
      ? Number(product.price ?? 0)
      : Number(it.price ?? 0);

    const afterProductUnit = Number(
      it.priceAfterProductPromotion ??
        it.price ??
        (product?.discountedPrice != null ? product.discountedPrice : listUnit),
    );

    const afterCartUnit = Number(it.priceAfterCartPromotion ?? afterProductUnit);

    totalCatalogList += listUnit * q;
    totalProductDiscount += Math.max(0, listUnit - afterProductUnit) * q;
    subtotalAfterProductPromotions += afterProductUnit * q;
    totalCartDiscountFromLines += Math.max(0, afterProductUnit - afterCartUnit) * q;
  }

  return {
    totalCatalogList,
    totalProductDiscount,
    subtotalAfterProductPromotions,
    totalCartDiscountFromLines,
  };
}
