import type { AppliedPromotionDto } from '../products/product.types';
import { appliedPromotionLocalizedName, cartAppliedPromotionDisplayName } from './promotion-display-i18n';
import { DiscountType, PromotionTranslationDto } from './promotion.types';
import { toDiscountType } from './promotion-enum.util';

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
  const type = toDiscountType(discountType ?? DiscountType.Percentage);
  if (type === DiscountType.Percentage) {
    return `${v}%`;
  }
  return `${v.toLocaleString('uk-UA')} ₴`;
}

/** Плашка на картці товару: «Назва : - 10%» або «Назва : - 50 ₴». `lang` — мова UI (ngx-translate). */
export function formatAppliedPromotionBadgeLabel(
  pr: AppliedPromotionDto | null | undefined,
  lang: string,
): string | null {
  if (!pr) {
    return null;
  }
  const n = appliedPromotionLocalizedName(pr, lang).trim();
  if (!n) {
    return null;
  }
  const suffix = formatPromotionDiscountSuffix(pr.discountType, pr.discountValue);
  if (!suffix) {
    return n;
  }
  return `${n} : - ${suffix}`;
}

/** Плашка знижки кошика (aria / текст без окремої плашки в блоці ціни). */
export function formatCartLevelPromotionChip(
  t: {
    promoName: string | null;
    promoSlug?: string | null;
    promoTranslations?: PromotionTranslationDto[] | null;
    promoDiscountType: number | null;
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
