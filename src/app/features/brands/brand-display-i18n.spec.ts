import { BrandResponseDto } from './brand.types';
import { brandLocalizedName } from './brand-display-i18n';

describe('brand-display-i18n', () => {
  it('brandLocalizedName', () => {
    const brand = {
      id: '1',
      name: 'Base',
      slug: 'base',
      isActive: true,
      translations: [
        { languageCode: 'uk', name: 'Бренд' },
        { languageCode: 'en', name: 'Brand' },
      ],
    } as BrandResponseDto;
    expect(brandLocalizedName(brand, 'en')).toBe('Brand');
  });
});
