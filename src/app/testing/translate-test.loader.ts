import { TranslationObject } from '@ngx-translate/core';
import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

/** Ключі, для яких у шаблоні використовується *ngFor по результату translate. */
const TRANSLATE_ARRAY_KEYS = new Set([
  'RETURNS.GOOD_QUALITY_LIST',
  'RETURNS.NOT_RETURNABLE_LIST',
  'RETURNS.BAD_QUALITY_LIST',
  'RETURNS.HOW_TO_RETURN_STEPS',
  'RETURNS.IMPORTANT_LIST',
  'ABOUT.ADVANTAGES',
]);

function buildTestTranslations(): TranslationObject {
  const out: TranslationObject = {};
  for (const key of TRANSLATE_ARRAY_KEYS) {
    out[key] = ['Test line 1', 'Test line 2'];
  }
  return out;
}

const TEST_TRANSLATIONS = buildTestTranslations();

/** Мінімальні переклади для unit-тестів компонентів. */
export class TranslateTestLoader implements TranslateLoader {
  getTranslation(_lang: string): Observable<TranslationObject> {
    return of(TEST_TRANSLATIONS);
  }
}
