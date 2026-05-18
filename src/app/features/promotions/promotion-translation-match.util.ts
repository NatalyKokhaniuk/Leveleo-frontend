import { normalizeUiLang } from '../products/product-display-i18n';
import type { PromotionTranslationDto } from './promotion.types';

/** Чи відповідає код перекладу мові UI (`uk`, `en`, `uk-UA`, `ua` тощо). */
export function translationMatchesUiLang(uiLang: string, languageCode: string): boolean {
  const ui = normalizeUiLang(uiLang);
  const lc = (languageCode ?? '').toLowerCase().trim();
  if (!lc) {
    return false;
  }
  if (lc.startsWith(ui)) {
    return true;
  }
  if (ui === 'uk' && (lc === 'ua' || lc.startsWith('uk'))) {
    return true;
  }
  if (ui === 'en' && lc.startsWith('en')) {
    return true;
  }
  return false;
}

export function pickPromotionTranslationName(
  translations: PromotionTranslationDto[] | null | undefined,
  lang: string,
): string | null {
  const tr = translations?.find((t) =>
    translationMatchesUiLang(lang, t.languageCode ?? ''),
  );
  const n = tr?.name?.trim();
  return n || null;
}

/** Чи є переклад назви для поточної мови UI. */
export function hasPromotionTranslationForLang(
  translations: PromotionTranslationDto[] | null | undefined,
  lang: string,
): boolean {
  return pickPromotionTranslationName(translations, lang) != null;
}
