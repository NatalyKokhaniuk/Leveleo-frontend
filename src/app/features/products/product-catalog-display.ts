/**
 * Features/Products/DTO/ProductCatalogDisplayState.cs — у JSON camelCase за замовчуванням ASP.NET.
 */
export type ProductCatalogDisplayState =
  | 'activeInCatalog'
  | 'archivedFromSale'
  | 'missingFromDatabase';

const ALL: readonly ProductCatalogDisplayState[] = [
  'activeInCatalog',
  'archivedFromSale',
  'missingFromDatabase',
] as const;

export function parseProductCatalogDisplayState(raw: unknown): ProductCatalogDisplayState | null {
  const s = String(raw ?? '').trim();
  return (ALL as readonly string[]).includes(s) ? (s as ProductCatalogDisplayState) : null;
}

/** Для ProductResponseDto: явне поле або відкат із isActive. */
export function resolveProductCatalogDisplayState(p: {
  catalogDisplayState?: unknown;
  isActive?: boolean;
}): ProductCatalogDisplayState {
  const parsed = parseProductCatalogDisplayState(p.catalogDisplayState);
  if (parsed) return parsed;
  if (p.isActive === false) return 'archivedFromSale';
  return 'activeInCatalog';
}

/** Рядок замовлення: снапшот головний; без снапшоту — з fallback (лише активність у каталозі). */
export function resolveOrderLineCatalogState(
  snapshot: OrderLineCatalogFields | null | undefined,
): ProductCatalogDisplayState {
  const parsed = parseProductCatalogDisplayState(snapshot?.catalogDisplayState);
  if (parsed === 'missingFromDatabase') return 'missingFromDatabase';
  if (parsed === 'archivedFromSale') return 'archivedFromSale';
  if (parsed === 'activeInCatalog') return 'activeInCatalog';

  const exists = snapshot?.existsInCatalog !== false;
  if (!exists) return 'missingFromDatabase';
  if (snapshot?.isActive === false) return 'archivedFromSale';
  return 'activeInCatalog';
}

export interface OrderLineCatalogFields {
  existsInCatalog?: boolean;
  isActive?: boolean | null;
  catalogDisplayState?: unknown;
}

export function isArchivedFromSaleState(s: ProductCatalogDisplayState): boolean {
  return s === 'archivedFromSale';
}

export function isMissingFromDatabaseState(s: ProductCatalogDisplayState): boolean {
  return s === 'missingFromDatabase';
}

/** Нова покупка з вітрини: лише для activeInCatalog. */
export function isCatalogPurchaseBlocked(product: {
  catalogDisplayState?: unknown;
  isActive?: boolean;
}): boolean {
  return resolveProductCatalogDisplayState(product) !== 'activeInCatalog';
}

export function catalogStateBadgeKey(state: ProductCatalogDisplayState): string {
  switch (state) {
    case 'archivedFromSale':
      return 'PRODUCTS.CATALOG_BADGE_ARCHIVED';
    case 'missingFromDatabase':
      return 'PRODUCTS.CATALOG_BADGE_MISSING';
    default:
      return 'PRODUCTS.CATALOG_BADGE_ACTIVE';
  }
}

/** Текст для рядка замовлення під назвою. */
export function orderLineCatalogHintKey(state: ProductCatalogDisplayState): string | null {
  switch (state) {
    case 'archivedFromSale':
      return 'ORDER_VIEW.LINE_PRODUCT_ARCHIVED';
    case 'missingFromDatabase':
      return 'ORDER_VIEW.LINE_PRODUCT_MISSING';
    default:
      return null;
  }
}
