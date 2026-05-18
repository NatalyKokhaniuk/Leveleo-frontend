import { guestCartToQtyMap, readGuestCart } from '../../../core/shopping-cart/cart-guest-storage';
import { promotionLocalizedName } from '../../../features/promotions/promotion-display-i18n';
import { toPromotionLevel } from '../../../features/promotions/promotion-enum.util';
import {
  CartLevelConditionDto,
  PromotionLevel,
  PromotionResponseDto,
} from '../../../features/promotions/promotion.types';
import type { ShoppingCartDto } from '../../../features/shopping-cart/shopping-cart.types';
import type { HomeCarouselSlide } from './carousel';

export const MAX_CAROUSEL_PROMOTIONS = 6;

/** Знімок кошика для відбору акцій рівня Cart у каруселі. */
export interface CarouselCartSnapshot {
  totalQuantity: number;
  productIds: ReadonlySet<string>;
  subtotalAfterProductPromotions: number | null;
  productCategoryIds: ReadonlyMap<string, ReadonlySet<string>>;
}

const EMPTY_CART_SNAPSHOT: CarouselCartSnapshot = {
  totalQuantity: 0,
  productIds: new Set(),
  subtotalAfterProductPromotions: null,
  productCategoryIds: new Map(),
};

export function isCarouselEligiblePromotion(p: PromotionResponseDto): boolean {
  if (!p.isActive) return false;
  if (p.isCoupon || p.isPersonal) return false;
  const level = toPromotionLevel(p.level);
  if (level !== PromotionLevel.Product && level !== PromotionLevel.Cart) return false;
  return !!(p.imageKey ?? '').trim();
}

function normId(id: string | null | undefined): string {
  return String(id ?? '').trim().toLowerCase();
}

export function hasMeaningfulCartConditions(
  cond: CartLevelConditionDto | null | undefined,
): boolean {
  if (!cond) return false;
  if (cond.minTotalAmount != null && Number(cond.minTotalAmount) > 0) return true;
  if (cond.minQuantity != null && Number(cond.minQuantity) > 0) return true;
  if ((cond.productIds?.length ?? 0) > 0) return true;
  if ((cond.categoryIds?.length ?? 0) > 0) return true;
  return false;
}

/** Чи відповідає акція кошика поточному вмісту кошика (умови з cartConditions). */
export function isCartPromotionVisibleForSnapshot(
  p: PromotionResponseDto,
  cart: CarouselCartSnapshot,
): boolean {
  if (toPromotionLevel(p.level) !== PromotionLevel.Cart) return true;
  const cond = p.cartConditions;
  if (!hasMeaningfulCartConditions(cond)) return true;

  const minQty = cond!.minQuantity;
  if (minQty != null && Number(minQty) > 0 && cart.totalQuantity < Number(minQty)) {
    return false;
  }

  const minTotal = cond!.minTotalAmount;
  if (minTotal != null && Number(minTotal) > 0) {
    const sub = cart.subtotalAfterProductPromotions;
    if (sub == null || sub < Number(minTotal)) {
      return false;
    }
  }

  const reqProducts = (cond!.productIds ?? []).map((id) => normId(id)).filter(Boolean);
  if (reqProducts.length > 0) {
    const cartIds = new Set([...cart.productIds].map((id) => normId(id)));
    if (!reqProducts.some((id) => cartIds.has(id))) {
      return false;
    }
  }

  const reqCategories = (cond!.categoryIds ?? []).map((id) => normId(id)).filter(Boolean);
  if (reqCategories.length > 0) {
    let matchesCategory = false;
    for (const pid of cart.productIds) {
      const cats = cart.productCategoryIds.get(pid);
      if (!cats?.size) continue;
      for (const cid of reqCategories) {
        if ([...cats].some((c) => normId(c) === cid)) {
          matchesCategory = true;
          break;
        }
      }
      if (matchesCategory) break;
    }
    if (!matchesCategory) {
      return false;
    }
  }

  return true;
}

export function buildCarouselCartSnapshotFromDto(
  cart: ShoppingCartDto | null | undefined,
): CarouselCartSnapshot {
  const productIds = new Set<string>();
  const productCategoryIds = new Map<string, Set<string>>();
  let totalQuantity = 0;

  for (const it of cart?.items ?? []) {
    const q = Math.max(0, Number(it.quantity) || 0);
    if (q <= 0) continue;
    totalQuantity += q;
    const pid = String(it.productId ?? it.product?.id ?? '').trim();
    if (!pid) continue;
    productIds.add(pid);
    const catRaw = it.product?.categoryId;
    const catId = catRaw != null ? String(catRaw).trim() : '';
    if (catId) {
      if (!productCategoryIds.has(pid)) {
        productCategoryIds.set(pid, new Set());
      }
      productCategoryIds.get(pid)!.add(catId);
    }
  }

  const orig = Number(cart?.totalOriginalPrice);
  const prodDisc = Number(cart?.totalProductDiscount);
  let subtotalAfterProductPromotions: number | null = null;
  if (Number.isFinite(orig)) {
    subtotalAfterProductPromotions = Math.max(
      0,
      orig - (Number.isFinite(prodDisc) ? prodDisc : 0),
    );
  }

  return { totalQuantity, productIds, subtotalAfterProductPromotions, productCategoryIds };
}

export function buildCarouselCartSnapshotFromQtyMap(
  qtyByProduct: ReadonlyMap<string, number>,
): CarouselCartSnapshot {
  const productIds = new Set<string>();
  let totalQuantity = 0;
  for (const [id, q] of qtyByProduct) {
    const pid = String(id).trim();
    const quantity = Math.max(0, Number(q) || 0);
    if (!pid || quantity <= 0) continue;
    productIds.add(pid);
    totalQuantity += quantity;
  }
  return {
    totalQuantity,
    productIds,
    subtotalAfterProductPromotions: null,
    productCategoryIds: new Map(),
  };
}

/** Гість: localStorage; авторизований: сигнал кошика (без суми) або DTO з GET /me. */
export function buildCarouselCartSnapshot(opts: {
  cartDto?: ShoppingCartDto | null;
  qtyByProduct?: ReadonlyMap<string, number>;
  useGuestStorage?: boolean;
}): CarouselCartSnapshot {
  if (opts.cartDto) {
    return buildCarouselCartSnapshotFromDto(opts.cartDto);
  }
  if (opts.qtyByProduct && opts.qtyByProduct.size > 0) {
    return buildCarouselCartSnapshotFromQtyMap(opts.qtyByProduct);
  }
  if (opts.useGuestStorage) {
    return buildCarouselCartSnapshotFromQtyMap(guestCartToQtyMap(readGuestCart()));
  }
  return EMPTY_CART_SNAPSHOT;
}

export function pickPromotionsForCarousel(
  promotions: PromotionResponseDto[],
  lang: string,
): PromotionResponseDto[] {
  const eligible = promotions.filter(isCarouselEligiblePromotion);
  eligible.sort((a, b) => {
    const aCart = toPromotionLevel(a.level) === PromotionLevel.Cart ? 0 : 1;
    const bCart = toPromotionLevel(b.level) === PromotionLevel.Cart ? 0 : 1;
    if (aCart !== bCart) return aCart - bCart;
    return promotionLocalizedName(a, lang).localeCompare(promotionLocalizedName(b, lang), undefined, {
      sensitivity: 'base',
    });
  });
  if (eligible.length <= MAX_CAROUSEL_PROMOTIONS) return eligible;
  return eligible.slice(0, MAX_CAROUSEL_PROMOTIONS);
}

export function mergeCategoryAndPromotionCarouselSlides(
  categories: HomeCarouselSlide[],
  promotions: HomeCarouselSlide[],
): HomeCarouselSlide[] {
  return [...promotions, ...categories];
}
