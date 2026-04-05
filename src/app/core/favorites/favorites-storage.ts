/** localStorage: список id товарів у «Вподобане». */
export const FAVORITES_STORAGE_KEY = 'leveleo_favorite_product_ids';

export function readFavoriteIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') {
      return new Set();
    }
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      return new Set();
    }
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function writeFavoriteIds(ids: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function toggleFavoriteId(id: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  writeFavoriteIds(next);
  return next;
}
