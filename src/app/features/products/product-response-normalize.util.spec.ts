import {
  normalizeAppliedPromotionDto,
  normalizePagedProductResult,
  normalizeProductResponseDto,
} from './product-response-normalize.util';

describe('product-response-normalize.util', () => {
  it('normalizeAppliedPromotionDto reads PascalCase and translations', () => {
    const dto = normalizeAppliedPromotionDto({
      Id: 'promo-1',
      Slug: 'sale',
      Name: 'Sale',
      Level: 0,
      DiscountType: 0,
      DiscountValue: 15,
      Translations: [{ LanguageCode: 'en', Name: 'Sale EN' }],
    });
    expect(dto?.id).toBe('promo-1');
    expect(dto?.slug).toBe('sale');
    expect(dto?.translations?.[0]?.name).toBe('Sale EN');
    expect(dto?.discountValue).toBe(15);
  });

  it('normalizeProductResponseDto maps AppliedPromotion and DiscountedPrice', () => {
    const p = normalizeProductResponseDto({
      Id: 'p1',
      Slug: 'prod',
      Name: 'Prod',
      Price: 100,
      DiscountedPrice: 90,
      AppliedPromotion: {
        Id: 'a1',
        Slug: 'promo',
        Name: 'Promo',
        Translations: [{ languageCode: 'uk', name: 'Акція' }],
      },
      StockQuantity: 1,
      AvailableQuantity: 1,
      IsActive: true,
      CategoryId: 'c',
      BrandId: 'b',
      AverageRating: 0,
      RatingCount: 0,
      TotalSold: 0,
      Translations: [],
    });
    expect(p.discountedPrice).toBe(90);
    expect(p.appliedPromotion?.slug).toBe('promo');
    expect(p.appliedPromotion?.translations?.[0]?.name).toBe('Акція');
  });

  it('normalizePagedProductResult maps Items array', () => {
    const page = normalizePagedProductResult({
      Page: 2,
      PageSize: 10,
      TotalCount: 1,
      Items: [{ Id: 'x', Slug: 'x', Name: 'X', Price: 1, StockQuantity: 0, AvailableQuantity: 0, IsActive: true, CategoryId: 'c', BrandId: 'b', AverageRating: 0, RatingCount: 0, TotalSold: 0, Translations: [] }],
    });
    expect(page.page).toBe(2);
    expect(page.items.length).toBe(1);
    expect(page.totalCount).toBe(1);
  });
});
