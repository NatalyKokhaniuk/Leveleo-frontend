import {
  FAVORITES_STORAGE_KEY,
  readFavoriteIds,
  toggleFavoriteId,
  writeFavoriteIds,
} from './favorites-storage';

describe('favorites-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('readFavoriteIds returns empty set when missing', () => {
    expect(readFavoriteIds().size).toBe(0);
  });

  it('writeFavoriteIds and readFavoriteIds', () => {
    writeFavoriteIds(new Set(['a', 'b']));
    expect(readFavoriteIds()).toEqual(new Set(['a', 'b']));
    expect(localStorage.getItem(FAVORITES_STORAGE_KEY)).toContain('a');
  });

  it('toggleFavoriteId adds and removes', () => {
    const s1 = toggleFavoriteId('p1', new Set());
    expect(s1.has('p1')).toBe(true);
    const s2 = toggleFavoriteId('p1', s1);
    expect(s2.has('p1')).toBe(false);
  });
});
