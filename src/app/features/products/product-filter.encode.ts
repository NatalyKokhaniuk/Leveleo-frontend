import { ProductSortBy, type ProductFilterDto } from './product.types';

/**
 * Base64(JSON) у форматі UTF-8, як очікує GET /api/products?filters=
 *
 * Дублюємо текст пошуку як `SearchQuery` (PascalCase): частина бекендів (C# за замовчуванням)
 * десеріалізує лише PascalCase; тоді `searchQuery` у JSON ігнорується, особливо разом із іншими полями.
 */
export function encodeProductFilters(filter: ProductFilterDto): string {
  const q = filter.searchQuery?.trim() ?? null;
  const payload: ProductFilterDto & { SearchQuery?: string | null } = {
    ...filter,
    searchQuery: q,
    SearchQuery: q,
  };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

export function defaultProductFilter(partial?: Partial<ProductFilterDto>): ProductFilterDto {
  return {
    categoryId: null,
    brandId: null,
    priceFrom: null,
    priceTo: null,
    attributeFilters: [],
    includeInactive: true,
    sortBy: ProductSortBy.PriceAsc,
    promotionId: null,
    searchQuery: null,
    page: 1,
    pageSize: 20,
    ...partial,
  };
}
