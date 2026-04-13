import { CategoryResponseDto } from '../../../features/categories/category.types';
import { ProductResponseDto } from '../../../features/products/product.types';

/** Коренева категорія в дереві (без parentId або parent поза списком). */
export function findRootCategoryId(
  categoryId: string,
  categories: CategoryResponseDto[],
): string | null {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let cur = byId.get(categoryId);
  if (!cur) return null;
  while (cur.parentId) {
    const p = byId.get(cur.parentId);
    if (!p) break;
    cur = p;
  }
  return cur.id;
}

export function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Випадкова вибірка до `n` елементів (копія масиву не змінює вхідний). */
export function randomSample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  shuffleInPlace(copy);
  return copy.slice(0, Math.min(n, copy.length));
}

export function dedupeProductsById(products: ProductResponseDto[]): ProductResponseDto[] {
  const seen = new Set<string>();
  const out: ProductResponseDto[] = [];
  for (const p of products) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
