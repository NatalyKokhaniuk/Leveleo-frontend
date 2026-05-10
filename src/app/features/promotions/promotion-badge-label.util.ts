import type { AppliedPromotionDto } from '../products/product.types';
import { appliedPromotionLocalizedName, cartAppliedPromotionDisplayName } from './promotion-display-i18n';
import { DiscountType, PromotionLevel, PromotionTranslationDto } from './promotion.types';
import { inferDiscountTypeWhenTypeMissing, toDiscountType } from './promotion-enum.util';

/** Акція рівня кошика не має дублюватися як бейдж на картці товару (див. домовленість із API). */
export function isAppliedPromotionCartLevel(level: unknown): boolean {
  if (level === undefined || level === null || level === '') {
    return false;
  }
  if (level === PromotionLevel.Cart || level === 1) {
    return true;
  }
  if (typeof level === 'string') {
    const s = level.trim().toLowerCase();
    return s === 'cart' || s === '1';
  }
  return false;
}

/** Slug посилання «всі акції» з фильтром, якщо є товарна акція й не помилково cart-level у payload. */
export function productPromotionLinkSlug(
  product: { appliedPromotion?: AppliedPromotionDto | null },
  options?: { hideCartLevel?: boolean },
): string | null {
  const pr = product.appliedPromotion;
  if (!pr) return null;
  const hideCart = options?.hideCartLevel !== false;
  if (hideCart && isAppliedPromotionCartLevel(pr.level)) return null;
  const s = pr.slug?.trim();
  return s || null;
}

/**
 * Лише текст червоної плашки на картці/деталях: локалізована назва акції (translations → name → slug не підставляємо як основний текст без name).
 */
export function productPromotionNameBadgeText(
  product: {
    price: unknown;
    discountedPrice?: number | string | null;
    appliedPromotion?: AppliedPromotionDto | null;
  },
  lang: string,
  nameFallback: string,
  options?: { hideCartLevel?: boolean },
): string | null {
  const list = Number(product.price);
  const disc = product.discountedPrice;
  const hasDisc =
    disc != null && !Number.isNaN(Number(disc)) && Number(disc) < list - 0.01;

  const pr = product.appliedPromotion;
  const hideCart = options?.hideCartLevel !== false;
  const isCartPayload = !!(pr && hideCart && isAppliedPromotionCartLevel(pr.level));
  if (isCartPayload) {
    return null;
  }

  const hasProductPromoMeta = !!(pr && !isAppliedPromotionCartLevel(pr.level));
  if (!hasDisc && !hasProductPromoMeta) {
    return null;
  }

  if (pr) {
    const name = appliedPromotionLocalizedName(pr, lang).trim();
    return name || nameFallback.trim() || null;
  }

  return nameFallback.trim() || null;
}

/**
 * Суфікс знижки для плашки: відсоток або фіксована сума з ₴.
 */
export function formatPromotionDiscountSuffix(
  discountType: unknown,
  discountValue: number | null | undefined,
): string | null {
  if (discountValue == null || Number.isNaN(Number(discountValue))) {
    return null;
  }
  const v = Number(discountValue);
  const type =
    discountType === null || discountType === undefined
      ? inferDiscountTypeWhenTypeMissing(v)
      : toDiscountType(discountType);
  if (type === DiscountType.Percentage) {
    return `${v}%`;
  }
  return `${v.toLocaleString('uk-UA')} ₴`;
}

/** Плашка на картці товару / у кошику: «Назва : - 10%» або при відсутній назві за API — fallback + знижка. */
export function formatAppliedPromotionBadgeLabel(
  pr: AppliedPromotionDto | null | undefined,
  lang: string,
  options?: { hideCartLevel?: boolean; nameFallback?: string },
): string | null {
  if (!pr) {
    return null;
  }
  if (options?.hideCartLevel && isAppliedPromotionCartLevel(pr.level)) {
    return null;
  }
  const suffix = formatPromotionDiscountSuffix(pr.discountType, pr.discountValue);
  const nameFromApi = appliedPromotionLocalizedName(pr, lang).trim();
  const fallback = (options?.nameFallback ?? '').trim();
  const label = nameFromApi || fallback;

  if (label && suffix) {
    return `${label} : - ${suffix}`;
  }
  if (label) {
    return label;
  }
  if (suffix) {
    return fallback ? `${fallback} : - ${suffix}` : `− ${suffix}`;
  }
  return null;
}

/** Плашка знижки кошика (aria / текст без окремої плашки в блоці ціни). */
export function formatCartLevelPromotionChip(
  t: {
    promoName: string | null;
    promoSlug?: string | null;
    promoTranslations?: PromotionTranslationDto[] | null;
    promoDiscountType: unknown;
    promoDiscountValue: number | null;
  },
  lang: string,
): string {
  const name = cartAppliedPromotionDisplayName(
    {
      name: t.promoName,
      slug: t.promoSlug ?? '',
      translations: t.promoTranslations,
    },
    lang,
  );
  const suffix = formatPromotionDiscountSuffix(t.promoDiscountType, t.promoDiscountValue);
  if (name && suffix) {
    return `${name} : - ${suffix}`;
  }
  if (name) {
    return name;
  }
  if (suffix) {
    return `- ${suffix}`;
  }
  return '';
}
