import { ProductSortBy } from './product.types';
import { defaultProductFilter, encodeProductFilters } from './product-filter.encode';

describe('product-filter.encode', () => {
  it('defaultProductFilter merges partial', () => {
    const f = defaultProductFilter({ page: 3, pageSize: 50 });
    expect(f.page).toBe(3);
    expect(f.pageSize).toBe(50);
    expect(f.sortBy).toBe(ProductSortBy.PriceAsc);
  });

  it('encodeProductFilters produces base64 json with SearchQuery mirror', () => {
    const b64 = encodeProductFilters(
      defaultProductFilter({ searchQuery: '  drill  ', onlyWithActiveProductPromotion: true }),
    );
    const json = JSON.parse(decodeURIComponent(escape(atob(b64))));
    expect(json.searchQuery).toBe('drill');
    expect(json.SearchQuery).toBe('drill');
    expect(json.onlyWithActiveProductPromotion).toBe(true);
    expect(json.OnlyWithActiveProductPromotion).toBe(true);
  });
});
