import {
  coerceApplyCouponResult,
  isApplyCouponSuccess,
  isApplyCouponUsageLimitExceeded,
} from './shopping-cart.types';

describe('shopping-cart coupon helpers', () => {
  it('coerceApplyCouponResult from string and number', () => {
    expect(coerceApplyCouponResult('Applied')).toBe('Applied');
    expect(coerceApplyCouponResult(1)).toBe('Applied');
    expect(coerceApplyCouponResult('unknown')).toBe('None');
    expect(coerceApplyCouponResult(null)).toBe('None');
  });

  it('isApplyCouponSuccess', () => {
    expect(isApplyCouponSuccess('Applied')).toBe(true);
    expect(isApplyCouponSuccess('Invalid')).toBe(false);
  });

  it('isApplyCouponUsageLimitExceeded', () => {
    expect(isApplyCouponUsageLimitExceeded(5)).toBe(true);
    expect(isApplyCouponUsageLimitExceeded('UsageLimitExceeded')).toBe(true);
  });
});
