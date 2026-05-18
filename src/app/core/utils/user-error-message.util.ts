import { TranslateService } from '@ngx-translate/core';

/** Показує переклад errorCode; якщо ключа немає — зрозумілий fallback для користувача. */
export function translateUserErrorCode(
  translate: TranslateService,
  errorCode: string | null | undefined,
  fallbackKey = 'UNKNOWN_ERROR',
): string {
  const key = String(errorCode ?? '').trim();
  if (!key) {
    return translate.instant(fallbackKey);
  }
  const translated = translate.instant(key);
  if (translated === key) {
    return translate.instant(fallbackKey);
  }
  return translated;
}
