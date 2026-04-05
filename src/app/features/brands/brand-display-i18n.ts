import { BrandResponseDto } from './brand.types';
import { normalizeUiLang } from '../products/product-display-i18n';

export function brandLocalizedName(brand: BrandResponseDto, lang: string): string {
  const code = normalizeUiLang(lang);
  const tr = brand.translations?.find((t) =>
    t.languageCode?.toLowerCase().startsWith(code),
  );
  const n = tr?.name?.trim();
  if (n) {
    return n;
  }
  return (brand.name ?? '').trim();
}
