import { CategoryResponseDto } from './category.types';
import { normalizeUiLang } from '../products/product-display-i18n';

/** Назва категорії з перекладу для мови UI, інакше базове name. */
export function categoryLocalizedName(category: CategoryResponseDto, lang: string): string {
  const code = normalizeUiLang(lang);
  const tr = category.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const n = tr?.name?.trim();
  if (n) {
    return n;
  }
  return (category.name ?? '').trim();
}

/** Опис категорії для мови UI. */
export function categoryLocalizedDescription(
  category: CategoryResponseDto,
  lang: string,
): string | null {
  const code = normalizeUiLang(lang);
  const tr = category.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const d = tr?.description?.trim();
  if (d) {
    return d;
  }
  return category.description?.trim() || null;
}
