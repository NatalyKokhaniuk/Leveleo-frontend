import {
  hasPromotionTranslationForLang,
  pickPromotionTranslationName,
  translationMatchesUiLang,
} from './promotion-translation-match.util';

describe('promotion-translation-match', () => {
  it('matches uk-UA and ua for uk UI', () => {
    expect(translationMatchesUiLang('uk', 'uk-UA')).toBe(true);
    expect(translationMatchesUiLang('uk', 'ua')).toBe(true);
  });

  it('picks name for requested language only', () => {
    const translations = [
      { languageCode: 'uk', name: 'Літо' },
      { languageCode: 'en', name: 'Summer' },
    ];
    expect(pickPromotionTranslationName(translations, 'en')).toBe('Summer');
    expect(pickPromotionTranslationName(translations, 'uk')).toBe('Літо');
    expect(hasPromotionTranslationForLang(translations, 'en')).toBe(true);
  });
});
