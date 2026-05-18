import { ProductResponseDto } from './product.types';
import {
  normalizeUiLang,
  productLocalizedDescription,
  productLocalizedName,
} from './product-display-i18n';

describe('product-display-i18n', () => {
  const product: ProductResponseDto = {
    id: '1',
    slug: 'p',
    name: 'Base name',
    description: 'Base desc',
    price: 10,
    stockQuantity: 1,
    availableQuantity: 1,
    isActive: true,
    categoryId: 'c',
    brandId: 'b',
    averageRating: 0,
    ratingCount: 0,
    totalSold: 0,
    translations: [
      { id: 't-uk', languageCode: 'uk', name: 'Назва UA', description: 'Опис UA' },
      { id: 't-en', languageCode: 'en', name: 'Name EN', description: 'Desc EN' },
    ],
  };

  it('normalizeUiLang', () => {
    expect(normalizeUiLang('en-US')).toBe('en');
    expect(normalizeUiLang('uk-UA')).toBe('uk');
    expect(normalizeUiLang(undefined)).toBe('uk');
  });

  it('productLocalizedName picks translation', () => {
    expect(productLocalizedName(product, 'en')).toBe('Name EN');
    expect(productLocalizedName(product, 'uk')).toBe('Назва UA');
  });

  it('productLocalizedDescription picks translation', () => {
    expect(productLocalizedDescription(product, 'en')).toBe('Desc EN');
  });
});
