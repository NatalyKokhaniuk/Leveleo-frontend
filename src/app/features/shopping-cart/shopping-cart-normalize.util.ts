import type { AppliedCartPromotionDto, ShoppingCartDto, ShoppingCartItemDto } from './shopping-cart.types';

function numOpt(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Узгоджує camelCase / PascalCase у відповідях ASP.NET, щоб купон і акція кошика коректно читались у UI.
 */
export function normalizeShoppingCartDto(raw: unknown): ShoppingCartDto {
  if (!raw || typeof raw !== 'object') {
    return { items: [] };
  }
  const o = raw as Record<string, unknown>;
  const items = (o['items'] ?? o['Items']) as ShoppingCartItemDto[] | null | undefined;
  const cc = o['couponCode'] ?? o['CouponCode'];
  const acpRaw = o['appliedCartPromotion'] ?? o['AppliedCartPromotion'];

  let appliedCartPromotion: AppliedCartPromotionDto | null | undefined;
  if (acpRaw && typeof acpRaw === 'object') {
    const a = acpRaw as Record<string, unknown>;
    appliedCartPromotion = {
      id: String(a['id'] ?? a['Id'] ?? ''),
      slug: (a['slug'] ?? a['Slug']) as string | undefined,
      name: (a['name'] ?? a['Name']) as string | null | undefined,
      discountType: numOpt(a['discountType'] ?? a['DiscountType']),
      discountValue: numOpt(a['discountValue'] ?? a['DiscountValue']),
      translations: (a['translations'] ?? a['Translations']) as AppliedCartPromotionDto['translations'],
    };
  } else {
    appliedCartPromotion = (acpRaw as AppliedCartPromotionDto | null | undefined) ?? null;
  }

  return {
    couponCode: cc == null || cc === '' ? null : String(cc).trim(),
    items,
    totalOriginalPrice: numOpt(o['totalOriginalPrice'] ?? o['TotalOriginalPrice']),
    totalProductDiscount: numOpt(o['totalProductDiscount'] ?? o['TotalProductDiscount']),
    totalCartDiscount: numOpt(o['totalCartDiscount'] ?? o['TotalCartDiscount']),
    totalPayable: numOpt(o['totalPayable'] ?? o['TotalPayable']),
    appliedCartPromotion,
  };
}
