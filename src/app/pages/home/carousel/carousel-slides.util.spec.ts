import { PromotionLevel, PromotionResponseDto } from '../../../features/promotions/promotion.types';
import type { HomeCarouselSlide } from './carousel';
import {
  buildCarouselCartSnapshotFromQtyMap,
  isCarouselEligiblePromotion,
  isCartPromotionVisibleForSnapshot,
  mergeCategoryAndPromotionCarouselSlides,
  pickPromotionsForCarousel,
} from './carousel-slides.util';

type PromoSlide = Extract<HomeCarouselSlide, { kind: 'promotion' }>;

function promo(id: string, imageKey = 'img'): PromotionResponseDto {
  return {
    id,
    name: `Promo ${id}`,
    slug: id,
    level: PromotionLevel.Product,
    startDate: '',
    endDate: '',
    isActive: true,
    isCoupon: false,
    isPersonal: false,
    imageKey,
    translations: [
      { languageCode: 'uk', name: `Акція ${id}` },
      { languageCode: 'en', name: `Sale ${id}` },
    ],
  };
}

describe('carousel slide selection', () => {
  it('includes all promotions with image when count is at most 6', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => promo(id));
    const picked = pickPromotionsForCarousel(list, 'uk');
    expect(picked.length).toBe(4);
    expect(picked.map((p: PromotionResponseDto) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('limits to 6 promotions when more are eligible', () => {
    const list = Array.from({ length: 8 }, (_, i) => promo(String(i)));
    const picked = pickPromotionsForCarousel(list, 'uk');
    expect(picked.length).toBe(6);
  });

  it('skips coupon and personal promotions', () => {
    const list = [
      promo('ok'),
      { ...promo('coupon'), isCoupon: true },
      { ...promo('personal'), isPersonal: true },
    ];
    const picked = pickPromotionsForCarousel(list, 'uk');
    expect(picked.map((p: PromotionResponseDto) => p.id)).toEqual(['ok']);
  });

  it('places all promotion slides before categories', () => {
    const cat = { kind: 'category' as const, category: {} as never, imageUrl: 'c' };
    const pr: PromoSlide = { kind: 'promotion', promotion: promo('p'), imageUrl: 'p' };
    const merged = mergeCategoryAndPromotionCarouselSlides([cat], [pr]);
    expect(merged[0].kind).toBe('promotion');
    expect(merged[1].kind).toBe('category');
  });
});

describe('isCarouselEligiblePromotion', () => {
  it('accepts cart-level public promotions', () => {
    expect(
      isCarouselEligiblePromotion({ ...promo('c'), level: PromotionLevel.Cart }),
    ).toBe(true);
  });
});

describe('cart-level carousel visibility', () => {
  it('shows unconditional cart promotion even when cart is empty', () => {
    const p = { ...promo('cart-open'), level: PromotionLevel.Cart };
    const empty = buildCarouselCartSnapshotFromQtyMap(new Map());
    expect(isCartPromotionVisibleForSnapshot(p, empty)).toBe(true);
    expect(pickPromotionsForCarousel([p], 'uk').map((x) => x.id)).toEqual(['cart-open']);
  });

  it('hides cart promotion when min quantity is not met (snapshot helper)', () => {
    const p = {
      ...promo('cart-qty'),
      level: PromotionLevel.Cart,
      cartConditions: { minQuantity: 3 },
    };
    const cart = buildCarouselCartSnapshotFromQtyMap(new Map([['p1', 2]]));
    expect(isCartPromotionVisibleForSnapshot(p, cart)).toBe(false);
  });

  it('prioritizes cart-level promotions when limiting to 6', () => {
    const list = [
      ...Array.from({ length: 6 }, (_, i) => promo(`p${i}`)),
      { ...promo('cart1'), level: PromotionLevel.Cart },
    ];
    const picked = pickPromotionsForCarousel(list, 'uk');
    expect(picked[0].id).toBe('cart1');
    expect(picked.length).toBe(6);
  });
});
