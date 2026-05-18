import { CategoryResponseDto } from './category.types';
import { categoryLocalizedDescription, categoryLocalizedName } from './category-display-i18n';

describe('category-display-i18n', () => {
  const category = {
    id: '1',
    name: 'Base',
    slug: 'base',
    isActive: true,
    translations: [
      { languageCode: 'uk', name: 'Категорія', description: 'Опис' },
      { languageCode: 'en', name: 'Category', description: 'Desc' },
    ],
  } as CategoryResponseDto;

  it('categoryLocalizedName', () => {
    expect(categoryLocalizedName(category, 'en')).toBe('Category');
    expect(categoryLocalizedName(category, 'uk')).toBe('Категорія');
  });

  it('categoryLocalizedDescription', () => {
    expect(categoryLocalizedDescription(category, 'en')).toBe('Desc');
  });
});
