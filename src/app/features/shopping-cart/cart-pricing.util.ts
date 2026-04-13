import { CartLineView, ShoppingCartItemDto } from './shopping-cart.types';
import type { ProductResponseDto } from '../products/product.types';

/** Порівняння цін (копійки / float з API). */
const PRICE_EPS = 0.01;

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
 * Однакова логіка для рядка GET /me: оригінал (для Σ і закреслення), після товарної та кошикової знижки.
 * Якщо в товару є discountedPrice &lt; price, а в рядку it.price збігається зі знижкою без окремого priceAfterProductPromotion,
 * «оригінал» піднімаємо до product.price — щоб знижка на товар враховувалась у підсумках і UI.
 */
export function resolveCartLineUnitPrices(
  it: ShoppingCartItemDto,
  product: ProductResponseDto | undefined,
): { unitListPrice: number; unitAfterProductPromotion: number; unitAfterCartPromotion: number } {
  const catalog = product ? Number(product.price ?? 0) : 0;

  let unitListPrice = Number(
    it.price != null && it.price !== undefined && !Number.isNaN(Number(it.price)) ? it.price : catalog,
  );

  const disc = product?.discountedPrice;
  const hasProductDiscount =
    disc != null && !Number.isNaN(Number(disc)) && Number(disc) < catalog - PRICE_EPS;

  if (hasProductDiscount) {
    unitListPrice = Math.max(unitListPrice, catalog);
  }

  let unitAfterProductPromotion = unitListPrice;
  if (it.priceAfterProductPromotion != null && !Number.isNaN(Number(it.priceAfterProductPromotion))) {
    unitAfterProductPromotion = Number(it.priceAfterProductPromotion);
  } else if (disc != null && !Number.isNaN(Number(disc))) {
    unitAfterProductPromotion = Number(disc);
  }

  let unitAfterCartPromotion = unitAfterProductPromotion;
  if (it.priceAfterCartPromotion != null && !Number.isNaN(Number(it.priceAfterCartPromotion))) {
    unitAfterCartPromotion = Number(it.priceAfterCartPromotion);
  }

  return { unitListPrice, unitAfterProductPromotion, unitAfterCartPromotion };
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
    let listUnit: number;
    let afterProductUnit: number;
    let afterCartUnit: number;

    if (product) {
      const u = resolveCartLineUnitPrices(it, product);
      listUnit = u.unitListPrice;
      afterProductUnit = u.unitAfterProductPromotion;
      afterCartUnit = u.unitAfterCartPromotion;
    } else {
      listUnit = Number(it.price ?? 0);
      afterProductUnit = Number(
        it.priceAfterProductPromotion != null && !Number.isNaN(Number(it.priceAfterProductPromotion))
          ? it.priceAfterProductPromotion
          : listUnit,
      );
      afterCartUnit = Number(
        it.priceAfterCartPromotion != null && !Number.isNaN(Number(it.priceAfterCartPromotion))
          ? it.priceAfterCartPromotion
          : afterProductUnit,
      );
    }

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

/** Ціни за одиницю для відображення рядка; узгоджено з computePricingFromCartItems. */
export function buildCartLineView(
  it: ShoppingCartItemDto,
  product: ProductResponseDto,
): CartLineView {
  const quantity = Math.max(0, Number(it.quantity) || 0);
  const { unitListPrice, unitAfterProductPromotion, unitAfterCartPromotion } = resolveCartLineUnitPrices(
    it,
    product,
  );
  return {
    product,
    quantity,
    unitListPrice,
    unitAfterProductPromotion,
    unitAfterCartPromotion,
  };
}
