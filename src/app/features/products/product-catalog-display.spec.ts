import {
  catalogStateBadgeKey,
  isCatalogPurchaseBlocked,
  parseProductCatalogDisplayState,
  resolveOrderLineCatalogState,
  resolveProductCatalogDisplayState,
} from './product-catalog-display';

describe('product-catalog-display', () => {
  it('parseProductCatalogDisplayState', () => {
    expect(parseProductCatalogDisplayState('archivedFromSale')).toBe('archivedFromSale');
    expect(parseProductCatalogDisplayState('invalid')).toBeNull();
  });

  it('resolveProductCatalogDisplayState from isActive', () => {
    expect(resolveProductCatalogDisplayState({ isActive: false })).toBe('archivedFromSale');
    expect(resolveProductCatalogDisplayState({ isActive: true })).toBe('activeInCatalog');
  });

  it('isCatalogPurchaseBlocked', () => {
    expect(isCatalogPurchaseBlocked({ isActive: true })).toBe(false);
    expect(isCatalogPurchaseBlocked({ catalogDisplayState: 'archivedFromSale' })).toBe(true);
  });

  it('resolveOrderLineCatalogState', () => {
    expect(
      resolveOrderLineCatalogState({ existsInCatalog: false, isActive: true }),
    ).toBe('missingFromDatabase');
    expect(
      resolveOrderLineCatalogState({ existsInCatalog: true, isActive: false }),
    ).toBe('archivedFromSale');
  });

  it('catalogStateBadgeKey', () => {
    expect(catalogStateBadgeKey('archivedFromSale')).toBe('PRODUCTS.CATALOG_BADGE_ARCHIVED');
  });
});
