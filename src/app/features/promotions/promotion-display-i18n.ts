import type { AppliedPromotionDto } from '../products/product.types';
import { PromotionResponseDto, PromotionTranslationDto } from './promotion.types';
import { normalizeUiLang } from '../products/product-display-i18n';

/** Назва товарної акції на плашці / у кошику — за мовою UI. */
export function appliedPromotionLocalizedName(pr: AppliedPromotionDto, lang: string): string {
  const code = normalizeUiLang(lang);
  const tr = pr.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const n = tr?.name?.trim();
  if (n) {
    return n;
  }
  const anyName = pr.translations?.map((t) => t.name?.trim()).find(Boolean);
  if (anyName) {
    return anyName;
  }
  return (pr.name ?? '').trim() || pr.slug;
}

/** Назва акції кошика (застосована знижка) — за мовою UI. */
export function cartAppliedPromotionDisplayName(
  t: {
    name?: string | null;
    slug?: string | null;
    translations?: PromotionTranslationDto[] | null;
  },
  lang: string,
): string {
  const code = normalizeUiLang(lang);
  const tr = t.translations?.find((x) =>
    x.languageCode?.toLowerCase().startsWith(code),
  );
  if (tr?.name?.trim()) {
    return tr.name.trim();
  }
  const anyName = t.translations?.map((x) => x.name?.trim()).find(Boolean);
  if (anyName) {
    return anyName;
  }
  if (t.name?.trim()) {
    return t.name.trim();
  }
  return (t.slug ?? '').trim();
}

/** Назва акції для поточної мови: переклад, базове name, slug. */
export function promotionLocalizedName(p: PromotionResponseDto, lang: string): string {
  const code = normalizeUiLang(lang);
  const tr = p.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const n = tr?.name?.trim();
  if (n) {
    return n;
  }
  const anyName = p.translations?.map((t) => t.name?.trim()).find(Boolean);
  if (anyName) {
    return anyName;
  }
  return (p.name ?? '').trim() || p.slug;
}

/** Опис акції для поточної мови. */
export function promotionLocalizedDescription(
  p: PromotionResponseDto,
  lang: string,
): string | null {
  const code = normalizeUiLang(lang);
  const tr = p.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const d = tr?.description?.trim();
  if (d) {
    return d;
  }
  const anyDesc = p.translations?.map((t) => t.description?.trim()).find(Boolean);
  if (anyDesc) {
    return anyDesc;
  }
  const base = p.description?.trim();
  return base || null;
}
