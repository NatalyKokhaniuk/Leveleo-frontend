import { DiscountType, PromotionLevel } from './promotion.types';
import { inferDiscountTypeWhenTypeMissing, toDiscountType, toPromotionLevel } from './promotion-enum.util';

describe('promotion-enum.util', () => {
  describe('toPromotionLevel', () => {
    it('parses numeric and string enums', () => {
      expect(toPromotionLevel(0)).toBe(PromotionLevel.Product);
      expect(toPromotionLevel(1)).toBe(PromotionLevel.Cart);
      expect(toPromotionLevel('Cart')).toBe(PromotionLevel.Cart);
      expect(toPromotionLevel('Product')).toBe(PromotionLevel.Product);
    });
  });

  describe('toDiscountType', () => {
    it('parses percentage and fixed amount', () => {
      expect(toDiscountType(0)).toBe(DiscountType.Percentage);
      expect(toDiscountType(1)).toBe(DiscountType.FixedAmount);
      expect(toDiscountType('FixedAmount')).toBe(DiscountType.FixedAmount);
    });
  });

  describe('inferDiscountTypeWhenTypeMissing', () => {
    it('treats values over 100 as fixed amount', () => {
      expect(inferDiscountTypeWhenTypeMissing(150)).toBe(DiscountType.FixedAmount);
      expect(inferDiscountTypeWhenTypeMissing(10)).toBe(DiscountType.Percentage);
    });
  });
});
