import type { PromotionTranslationDto } from '../promotions/promotion.types';
import type { AppliedPromotionDto, PagedResultDto, ProductResponseDto } from './product.types';

function numOpt(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOpt(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizePromotionTranslations(raw: unknown): PromotionTranslationDto[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: PromotionTranslationDto[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const t = row as Record<string, unknown>;
    const languageCode = String(t['languageCode'] ?? t['LanguageCode'] ?? '').trim();
    const name = String(t['name'] ?? t['Name'] ?? '').trim();
    const descRaw = t['description'] ?? t['Description'];
    if (!languageCode && !name) continue;
    out.push({
      languageCode: languageCode || 'uk',
      name: name || '—',
      description: descRaw == null || descRaw === '' ? undefined : String(descRaw),
    });
  }
  return out.length ? out : undefined;
}

/**
 * Відповіді ASP.NET часом містять вкладений об’єкт як `AppliedPromotion` (PascalCase) або поля `Translations`/`DiscountType` тощо.
 * Без нормалізації `appliedPromotion` не підхоплюється і плашка акції на товарі не показується.
 */
export function normalizeAppliedPromotionDto(raw: unknown): AppliedPromotionDto | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const a = raw as Record<string, unknown>;

  const id = String(a['id'] ?? a['Id'] ?? '').trim();
  const slug = String(a['slug'] ?? a['Slug'] ?? '').trim();
  const name = String(a['name'] ?? a['Name'] ?? '').trim();

  const translationsRaw = a['translations'] ?? a['Translations'];
  const translations = normalizePromotionTranslations(translationsRaw);

  const dvPresent =
    (a['discountValue'] ?? a['DiscountValue']) != null &&
    String(a['discountValue'] ?? a['DiscountValue']).trim() !== '';

  const hasMeaningfulPayload =
    !!id ||
    !!slug ||
    !!name ||
    (translations?.length ?? 0) > 0 ||
    dvPresent;

  if (!hasMeaningfulPayload) {
    return null;
  }

  const stableId = id || slug || name || 'promotion';

  const rawDiscountType = a['discountType'] ?? a['DiscountType'];
  const discountType: unknown =
    rawDiscountType === undefined || rawDiscountType === null
      ? undefined
      : typeof rawDiscountType === 'number' ||
          typeof rawDiscountType === 'string' ||
          typeof rawDiscountType === 'boolean'
        ? rawDiscountType
        : undefined;

  const dto: AppliedPromotionDto = {
    id: stableId,
    slug: slug || id || stableId,
    name,
    description: strOpt(a['description'] ?? a['Description']) ?? undefined,
    imageKey: strOpt(a['imageKey'] ?? a['ImageKey']),
    level: a['level'] ?? a['Level'],
    discountType,
    discountValue: numOpt(a['discountValue'] ?? a['DiscountValue']),
    maxUsages: numOrNull(a['maxUsages'] ?? a['MaxUsages']),
    usedCount: numOrNull(a['usedCount'] ?? a['UsedCount']),
    translations,
  };
  return dto;
}

/** Гарантує camelCase та читання PascalCase вкладень для вітрини. */
export function normalizeProductResponseDto(raw: unknown): ProductResponseDto {
  if (!raw || typeof raw !== 'object') {
    return raw as ProductResponseDto;
  }
  const o = raw as ProductResponseDto & Record<string, unknown>;

  const rawAp =
    ((o['appliedPromotion'] ?? o['AppliedPromotion']) as unknown) ?? undefined;

  let appliedPromotion: AppliedPromotionDto | null | undefined = o.appliedPromotion;
  if (rawAp !== undefined && rawAp !== null) {
    appliedPromotion = normalizeAppliedPromotionDto(rawAp);
  } else if (rawAp === null) {
    appliedPromotion = null;
  }

  const discRaw = o['discountedPrice'] ?? o['DiscountedPrice'];
  let discountedPrice = o.discountedPrice;
  if (discRaw != null && discRaw !== '') {
    const n = Number(discRaw);
    if (Number.isFinite(n)) {
      discountedPrice = n;
    }
  }

  return {
    ...o,
    appliedPromotion,
    discountedPrice,
  };
}

export function normalizePagedProductResult(raw: unknown): PagedResultDto<ProductResponseDto> {
  if (!raw || typeof raw !== 'object') {
    return { items: [], page: 1, pageSize: 20, totalCount: 0 };
  }
  const bucket = raw as Record<string, unknown>;
  const itemsSrc = bucket['items'] ?? bucket['Items'];
  const items = Array.isArray(itemsSrc)
    ? (itemsSrc as unknown[]).map(normalizeProductResponseDto)
    : [];

  const page = Math.max(1, Number(bucket['page'] ?? bucket['Page'] ?? 1));
  const sizeFallback = items.length > 0 ? items.length : 12;
  const pageSize = Math.max(1, Number(bucket['pageSize'] ?? bucket['PageSize']) || sizeFallback);
  const totalCount = Math.max(0, Number(bucket['totalCount'] ?? bucket['TotalCount'] ?? items.length));

  return { items, page, pageSize, totalCount };
}
