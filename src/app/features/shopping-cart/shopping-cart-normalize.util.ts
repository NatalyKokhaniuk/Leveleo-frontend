import {
  coerceApplyCouponResult,
  type AppliedCartPromotionDto,
  type ShoppingCartDto,
  type ShoppingCartItemDto,
} from './shopping-cart.types';
import type { ProductResponseDto } from '../products/product.types';

function numOpt(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOpt(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function boolOpt(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  return Boolean(v);
}

function normalizeGuidList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((x) => String(x).trim()).filter((id) => id.length > 0);
}

/**
 * Єдиний вигляд рядка кошика з camel/Pascal casing.
 */
export function normalizeShoppingCartItem(raw: unknown): ShoppingCartItemDto {
  if (!raw || typeof raw !== 'object') {
    return { quantity: 0 };
  }
  const o = raw as Record<string, unknown>;
  const qty = Number(o['quantity'] ?? o['Quantity']) || 0;
  const productRaw = (o['product'] ?? o['Product']) as ProductResponseDto | null | undefined;
  const product = typeof productRaw === 'object' && productRaw ? productRaw : undefined;
  const pidRaw = (o['productId'] ?? o['ProductId']) as string | undefined;

  const qApply = numOpt(o['quantityApplyingToTotals'] ?? o['QuantityApplyingToTotals']);

  const item: ShoppingCartItemDto = {
    productId: pidRaw ?? product?.id,
    product,
    quantity: qty,
    availableQuantity: numOpt(o['availableQuantity'] ?? o['AvailableQuantity']),
    quantityApplyingToTotals: qApply,
    isExcludedFromPurchase: Boolean(o['isExcludedFromPurchase'] ?? o['IsExcludedFromPurchase']),
    totalPrice: numOpt(o['totalPrice'] ?? o['TotalPrice']),
    price: numOpt(o['price'] ?? o['Price']),
    priceAfterProductPromotion: numOpt(o['priceAfterProductPromotion'] ?? o['PriceAfterProductPromotion']),
    priceAfterCartPromotion: numOpt(o['priceAfterCartPromotion'] ?? o['PriceAfterCartPromotion']),
  };
  return item;
}

/**
 * Узгоджує camelCase / PascalCase у відповідях ASP.NET, щоб купон і акція кошика коректно читались у UI.
 */
export function normalizeShoppingCartDto(raw: unknown): ShoppingCartDto {
  if (!raw || typeof raw !== 'object') {
    return { items: [] };
  }
  const o = raw as Record<string, unknown>;
  const rawItems = o['items'] ?? o['Items'];
  const items = Array.isArray(rawItems)
    ? (rawItems as unknown[]).map(normalizeShoppingCartItem)
    : (rawItems as ShoppingCartItemDto[] | null | undefined);
  const cc = o['couponCode'] ?? o['CouponCode'];
  const couponApplyResult = coerceApplyCouponResult(
    o['couponApplyResult'] ?? o['CouponApplyResult'] ?? null,
  );
  const cam = o['couponApplyMessage'] ?? o['CouponApplyMessage'];
  const couponApplyMessage =
    cam == null || cam === '' ? null : String(cam).trim() || null;
  const acpRaw = o['appliedCartPromotion'] ?? o['AppliedCartPromotion'];

  let appliedCartPromotion: AppliedCartPromotionDto | null | undefined;
  if (acpRaw && typeof acpRaw === 'object') {
    const a = acpRaw as Record<string, unknown>;
    const dtRaw = a['discountType'] ?? a['DiscountType'];
    let discountType: string | number | null | undefined;
    if (dtRaw === undefined) discountType = undefined;
    else if (dtRaw === null || dtRaw === '') discountType = null;
    else if (typeof dtRaw === 'string') {
      const t = dtRaw.trim();
      discountType = t.length ? t : null;
    } else if (typeof dtRaw === 'number') discountType = dtRaw;
    else discountType = numOpt(dtRaw) ?? null;

    appliedCartPromotion = {
      id: String(a['id'] ?? a['Id'] ?? ''),
      slug: strOpt(a['slug'] ?? a['Slug']),
      name: strOpt(a['name'] ?? a['Name']),
      description: strOpt(a['description'] ?? a['Description']),
      imageKey: strOpt(a['imageKey'] ?? a['ImageKey']),
      level: (a['level'] ?? a['Level']) as string | number | null | undefined,
      discountType,
      discountValue: numOpt(a['discountValue'] ?? a['DiscountValue']),
      startDate: strOpt(a['startDate'] ?? a['StartDate']),
      endDate: strOpt(a['endDate'] ?? a['EndDate']),
      isCoupon: boolOpt(a['isCoupon'] ?? a['IsCoupon']),
      isPersonal: boolOpt(a['isPersonal'] ?? a['IsPersonal']),
      couponCode: strOpt(a['couponCode'] ?? a['CouponCode']),
      maxUsages: numOrNull(a['maxUsages'] ?? a['MaxUsages']),
      usedCount: numOrNull(a['usedCount'] ?? a['UsedCount']),
      translations: (a['translations'] ?? a['Translations']) as AppliedCartPromotionDto['translations'],
    };
  } else {
    appliedCartPromotion = (acpRaw as AppliedCartPromotionDto | null | undefined) ?? null;
  }

  return {
    id: (o['id'] ?? o['Id']) as string | undefined,
    userId: (o['userId'] ?? o['UserId']) as string | undefined,
    couponCode: cc == null || cc === '' ? null : String(cc).trim(),
    couponApplyResult,
    couponApplyMessage,
    items,
    removedItems: (() => {
      const ri = o['removedItems'] ?? o['RemovedItems'];
      if (!Array.isArray(ri)) return ri as ShoppingCartItemDto[] | null | undefined;
      return (ri as unknown[]).map(normalizeShoppingCartItem);
    })(),
    removedMissingProductIds: normalizeGuidList(
      o['removedMissingProductIds'] ?? o['RemovedMissingProductIds'],
    ),
    cartAdjusted: Boolean(o['cartAdjusted'] ?? o['CartAdjusted']),
    totalOriginalPrice: numOpt(o['totalOriginalPrice'] ?? o['TotalOriginalPrice']),
    totalProductDiscount: numOpt(o['totalProductDiscount'] ?? o['TotalProductDiscount']),
    totalCartDiscount: numOpt(o['totalCartDiscount'] ?? o['TotalCartDiscount']),
    totalPayable: numOpt(o['totalPayable'] ?? o['TotalPayable']),
    appliedCartPromotion,
  };
}
