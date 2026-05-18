import type { AppliedPromotionDto } from '../products/product.types';
import { PromotionLevel, PromotionResponseDto } from './promotion.types';
import {
  appliedPromotionLocalizedName,
  cartAppliedPromotionDisplayName,
  promotionLocalizedDescription,
  promotionLocalizedName,
} from './promotion-display-i18n';

describe('promotion-display-i18n', () => {
  const translations = [
    { languageCode: 'uk', name: 'Весна', description: 'Опис UA' },
    { languageCode: 'en', name: 'Spring', description: 'Desc EN' },
  ];

  it('appliedPromotionLocalizedName uses current language', () => {
    const pr: AppliedPromotionDto = {
      id: '1',
      slug: 'spring',
      name: 'Fallback',
      level: PromotionLevel.Product,
      translations,
    };
    expect(appliedPromotionLocalizedName(pr, 'en')).toBe('Spring');
    expect(appliedPromotionLocalizedName(pr, 'uk-UA')).toBe('Весна');
  });

  it('does not fall back to other language translation', () => {
    const pr: AppliedPromotionDto = {
      id: '1',
      slug: 'x',
      name: 'Only UA base',
      level: PromotionLevel.Product,
      translations: [{ languageCode: 'uk', name: 'Весна' }],
    };
    expect(appliedPromotionLocalizedName(pr, 'en')).toBe('Only UA base');
  });

  it('promotionLocalizedName and description', () => {
    const p = {
      id: '1',
      name: null,
      slug: 'spring',
      level: PromotionLevel.Product,
      startDate: '',
      endDate: '',
      isActive: true,
      isCoupon: false,
      isPersonal: false,
      translations,
    } as PromotionResponseDto;
    expect(promotionLocalizedName(p, 'en')).toBe('Spring');
    expect(promotionLocalizedDescription(p, 'en')).toBe('Desc EN');
  });

  it('cartAppliedPromotionDisplayName', () => {
    expect(
      cartAppliedPromotionDisplayName(
        { name: 'X', slug: 'x', translations },
        'en',
      ),
    ).toBe('Spring');
  });
});
