import type { ProductResponseDto } from './product.types';

/**
 * Сервер уже прибирає видалені товари; порядок — за датою додавання (нові вище).
 * Поля опційні — якщо бекенд не шле їх, лишаємо порядок відповіді.
 */
export function sortProductsByFavoriteAddedAtDesc(items: ProductResponseDto[]): ProductResponseDto[] {
  return [...items].sort(sortByFavoriteKey);
}

export function sortProductsByComparisonAddedAtDesc(items: ProductResponseDto[]): ProductResponseDto[] {
  return [...items].sort(sortByComparisonKey);
}

function sortByFavoriteKey(a: ProductResponseDto, b: ProductResponseDto): number {
  const ta = relationTime(a.favoriteAddedAt);
  const tb = relationTime(b.favoriteAddedAt);
  if (ta !== tb) return tb - ta;
  return a.id.localeCompare(b.id);
}

function sortByComparisonKey(a: ProductResponseDto, b: ProductResponseDto): number {
  const ta = relationTime(a.comparisonAddedAt);
  const tb = relationTime(b.comparisonAddedAt);
  if (ta !== tb) return tb - ta;
  return a.id.localeCompare(b.id);
}

function relationTime(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}
