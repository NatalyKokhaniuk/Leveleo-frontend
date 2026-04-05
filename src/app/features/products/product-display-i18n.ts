import { ProductResponseDto } from './product.types';

/** Коди мов з бекенду / ngx-translate (uk, en, uk-UA → uk). */
export function normalizeUiLang(lang: string | undefined): string {
  const l = (lang || 'uk').toLowerCase().split('-')[0];
  return l === 'en' ? 'en' : 'uk';
}

/** Назва товару для поточної мови; переклад з translations, інакше базове name. */
export function productLocalizedName(product: ProductResponseDto, lang: string): string {
  const code = normalizeUiLang(lang);
  const tr = product.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const n = tr?.name?.trim();
  if (n) {
    return n;
  }
  return (product.name ?? '').trim();
}

/** Опис товару для поточної мови; переклад з translations, інакше базовий description. */
export function productLocalizedDescription(
  product: ProductResponseDto,
  lang: string,
): string | null {
  const code = normalizeUiLang(lang);
  const tr = product.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const d = tr?.description?.trim();
  if (d) {
    return d;
  }
  const base = product.description?.trim();
  return base || null;
}
