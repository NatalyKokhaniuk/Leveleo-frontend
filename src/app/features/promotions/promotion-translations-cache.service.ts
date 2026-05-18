import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import type { AppliedPromotionDto } from '../products/product.types';
import { PromotionService } from './promotion.service';
import { PromotionTranslationDto } from './promotion.types';
import { hasPromotionTranslationForLang } from './promotion-translation-match.util';

@Injectable({ providedIn: 'root' })
export class PromotionTranslationsCacheService {
  private promotionsApi = inject(PromotionService);
  private cache = new Map<string, PromotionTranslationDto[]>();
  private inflight = new Map<string, Observable<PromotionTranslationDto[]>>();

  /** Довантажити переклади з GET /promotions/{id} (або з кешу, якщо вже є потрібна мова). */
  ensure(
    promotionId: string,
    seed: PromotionTranslationDto[] | null | undefined,
    lang: string,
  ): Observable<PromotionTranslationDto[]> {
    const id = promotionId.trim();
    if (!id) {
      return of(seed ?? []);
    }
    const cached = this.cache.get(id);
    const mergedCached = this.mergeTranslations(seed, cached);
    if (cached?.length && hasPromotionTranslationForLang(mergedCached, lang)) {
      return of(mergedCached);
    }
    let req = this.inflight.get(id);
    if (!req) {
      req = this.promotionsApi.getById(id).pipe(
        map((p) => p.translations ?? []),
        catchError(() => of(seed ?? [])),
        tap((rows) => {
          this.cache.set(id, rows);
          this.inflight.delete(id);
        }),
        shareReplay(1),
      );
      this.inflight.set(id, req);
    }
    return req.pipe(map((rows) => this.mergeTranslations(seed, rows)));
  }

  /**
   * Якщо для мови UI немає перекладу в `appliedPromotion` — підвантажити повний список.
   */
  ensureForAppliedPromotion(
    pr: AppliedPromotionDto,
    lang: string,
  ): Observable<PromotionTranslationDto[]> {
    const id = pr.id?.trim();
    const seed = pr.translations ?? [];
    if (!id) {
      return of(seed);
    }
    if (hasPromotionTranslationForLang(seed, lang)) {
      return of(seed);
    }
    return this.ensure(id, seed, lang);
  }

  mergeIntoAppliedPromotion(
    pr: AppliedPromotionDto,
    translations: PromotionTranslationDto[],
  ): AppliedPromotionDto {
    const merged = this.mergeTranslations(pr.translations, translations);
    return merged.length ? { ...pr, translations: merged } : pr;
  }

  private mergeTranslations(
    seed: PromotionTranslationDto[] | null | undefined,
    fetched: PromotionTranslationDto[] | null | undefined,
  ): PromotionTranslationDto[] {
    const out: PromotionTranslationDto[] = [...(seed ?? [])];
    for (const row of fetched ?? []) {
      const code = (row.languageCode ?? '').trim().toLowerCase();
      if (!code) {
        continue;
      }
      const idx = out.findIndex((t) =>
        (t.languageCode ?? '').trim().toLowerCase() === code,
      );
      if (idx >= 0) {
        out[idx] = row;
      } else {
        out.push(row);
      }
    }
    return out;
  }
}
