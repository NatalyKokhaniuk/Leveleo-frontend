import { promotionLocalizedName } from '../../../features/promotions/promotion-display-i18n';
import { toPromotionLevel } from '../../../features/promotions/promotion-enum.util';
import { PromotionLevel, PromotionResponseDto } from '../../../features/promotions/promotion.types';
import type { HomeCarouselSlide } from './carousel';

export function isCarouselEligiblePromotion(p: PromotionResponseDto): boolean {
  if (!p.isActive) return false;
  if (p.isCoupon || p.isPersonal) return false;
  const level = toPromotionLevel(p.level);
  if (level !== PromotionLevel.Product && level !== PromotionLevel.Cart) return false;
  return !!(p.imageKey ?? '').trim();
}

export function pickPromotionsForCarousel(
  promotions: PromotionResponseDto[],
  lang: string,
): PromotionResponseDto[] {
  const eligible = promotions.filter(isCarouselEligiblePromotion);
  eligible.sort((a, b) =>
    promotionLocalizedName(a, lang).localeCompare(promotionLocalizedName(b, lang), undefined, {
      sensitivity: 'base',
    }),
  );
  if (eligible.length <= 6) return eligible;
  return eligible.slice(0, 6);
}

export function mergeCategoryAndPromotionCarouselSlides(
  categories: HomeCarouselSlide[],
  promotions: HomeCarouselSlide[],
): HomeCarouselSlide[] {
  return [...promotions, ...categories];
}
