import {
  buildCartLineViewDto,
  cartItemQuantityInCart,
  computePricingFromCartItems,
  quantityApplyingToTotalsForItem,
  resolveCartLineUnitPrices,
} from './cart-pricing.util';
import type { ShoppingCartItemDto } from './shopping-cart.types';
import type { ProductResponseDto } from '../products/product.types';

function product(partial: Partial<ProductResponseDto> = {}): ProductResponseDto {
  return {
    id: 'prod-1',
    slug: 'p',
    name: 'Product',
    price: 100,
    discountedPrice: 80,
    stockQuantity: 10,
    availableQuantity: 10,
    isActive: true,
    categoryId: 'c',
    brandId: 'b',
    averageRating: 0,
    ratingCount: 0,
    totalSold: 0,
    translations: [],
    ...partial,
  };
}

describe('cart-pricing.util', () => {
  it('cartItemQuantityInCart and quantityApplyingToTotals', () => {
    const it: ShoppingCartItemDto = { quantity: 3, quantityApplyingToTotals: 2 };
    expect(cartItemQuantityInCart(it)).toBe(3);
    expect(quantityApplyingToTotalsForItem(it)).toBe(2);
  });

  it('resolveCartLineUnitPrices uses catalog price as list when line price is discounted', () => {
    const it: ShoppingCartItemDto = { price: 80, quantity: 1 };
    const p = product({ price: 100, discountedPrice: 80 });
    const u = resolveCartLineUnitPrices(it, p);
    expect(u.unitListPrice).toBe(100);
    expect(u.unitAfterProductPromotion).toBe(80);
  });

  it('computePricingFromCartItems aggregates discounts', () => {
    const items: ShoppingCartItemDto[] = [
      {
        quantity: 2,
        quantityApplyingToTotals: 2,
        price: 80,
        product: product(),
      },
    ];
    const totals = computePricingFromCartItems(items);
    expect(totals.totalCatalogList).toBe(200);
    expect(totals.totalProductDiscount).toBe(40);
    expect(totals.subtotalAfterProductPromotions).toBe(160);
  });

  it('buildCartLineView exposes unit prices', () => {
    const row = buildCartLineViewDto(
      { quantity: 1, price: 100, product: product() },
      product(),
    );
    expect(row.quantityInCart).toBe(1);
    expect(row.unitListPrice).toBe(100);
    expect(row.unitAfterProductPromotion).toBe(80);
  });
});
