import { DiscountType, PromotionLevel } from './promotion.types';
import type { AppliedPromotionDto } from '../products/product.types';
import {
  formatAppliedPromotionBadgeLabel,
  formatCartLevelPromotionChip,
  formatPromotionDiscountSuffix,
  isAppliedPromotionCartLevel,
  productPromotionLinkSlug,
  productPromotionNameBadgeText,
} from './promotion-badge-label.util';

function promo(partial: Partial<AppliedPromotionDto> = {}): AppliedPromotionDto {
  return {
    id: 'p1',
    slug: 'summer',
    name: 'Літо',
    level: PromotionLevel.Product,
    discountType: DiscountType.Percentage,
    discountValue: 10,
    translations: [
      { languageCode: 'uk', name: 'Літо' },
      { languageCode: 'en', name: 'Summer' },
    ],
    ...partial,
  };
}

describe('promotion-badge-label.util', () => {
  describe('isAppliedPromotionCartLevel', () => {
    it('detects cart level from number and string', () => {
      expect(isAppliedPromotionCartLevel(PromotionLevel.Cart)).toBe(true);
      expect(isAppliedPromotionCartLevel('Cart')).toBe(true);
      expect(isAppliedPromotionCartLevel(PromotionLevel.Product)).toBe(false);
    });
  });

  describe('formatAppliedPromotionBadgeLabel', () => {
    it('formats localized name with percent', () => {
      const text = formatAppliedPromotionBadgeLabel(promo(), 'en');
      expect(text).toBe('Summer : - 10%');
    });

    it('formats fixed amount with hryvnia', () => {
      const text = formatAppliedPromotionBadgeLabel(
        promo({ discountType: DiscountType.FixedAmount, discountValue: 50 }),
        'uk',
      );
      expect(text).toContain('Літо : -');
      expect(text).toContain('₴');
    });

    it('hides cart-level on product badge when requested', () => {
      const text = formatAppliedPromotionBadgeLabel(
        promo({ level: PromotionLevel.Cart }),
        'uk',
        { hideCartLevel: true },
      );
      expect(text).toBeNull();
    });
  });

  describe('productPromotionNameBadgeText', () => {
    it('returns null for cart-level promotion on card', () => {
      const text = productPromotionNameBadgeText(
        {
          price: 100,
          discountedPrice: 90,
          appliedPromotion: promo({ level: PromotionLevel.Cart }),
        },
        'uk',
        'Акція',
      );
      expect(text).toBeNull();
    });

    it('shows badge when discounted price without promotion meta', () => {
      const text = productPromotionNameBadgeText(
        { price: 100, discountedPrice: 80 },
        'uk',
        'Знижка',
      );
      expect(text).toBe('Знижка');
    });
  });

  describe('productPromotionLinkSlug', () => {
    it('returns slug for product promotion', () => {
      expect(productPromotionLinkSlug({ appliedPromotion: promo() })).toBe('summer');
    });

    it('returns null for cart promotion when hidden', () => {
      expect(
        productPromotionLinkSlug(
          { appliedPromotion: promo({ level: PromotionLevel.Cart }) },
          { hideCartLevel: true },
        ),
      ).toBeNull();
    });
  });

  describe('formatCartLevelPromotionChip', () => {
    it('builds chip from cart promotion fields', () => {
      const chip = formatCartLevelPromotionChip(
        {
          promoName: 'Кошик',
          promoSlug: 'cart-promo',
          promoTranslations: [{ languageCode: 'en', name: 'Cart deal' }],
          promoDiscountType: DiscountType.Percentage,
          promoDiscountValue: 5,
        },
        'en',
      );
      expect(chip).toBe('Cart deal : - 5%');
    });
  });

  describe('formatPromotionDiscountSuffix', () => {
    it('infers fixed amount for large values without type', () => {
      expect(formatPromotionDiscountSuffix(null, 150)).toContain('₴');
    });
  });
});
