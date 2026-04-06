import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreatePromotionDto,
  PromotionResponseDto,
  PromotionTranslationDto,
  UpdatePromotionDto,
} from './promotion.types';
import { ApiService } from '../../core/services/api.service';

/**
 * `PromotionsController` → `/api/promotions` (типовий ASP.NET ігнорує регістр).
 * Для списку в адмінці потрібен `GET /api/promotions` без id — додайте на бекенді, якщо ще немає.
 */
@Injectable({ providedIn: 'root' })
export class PromotionService {
  private api = inject(ApiService);
  private base = '/promotions';

  /** Повний список акцій (адмінка). */
  getAll(): Observable<PromotionResponseDto[]> {
    return this.api.get<PromotionResponseDto[]>(this.base);
  }

  /**
   * POST очікує кореневі `name`/`slug` і вкладене поле `dto` (типовий ASP.NET-запит:
   * `[Required] Name`, `[Required] Slug` на обгортці + `Dto` з деталями).
   * Дати дублюємо на корені й у `dto` як `startDate`/`endDate` і як `StartDate`/`EndDate`,
   * щоб уникнути `EndDate == default` при суворій прив’язці JSON (INVALID_DATES на бекенді).
   */
  create(dto: CreatePromotionDto): Observable<PromotionResponseDto> {
    const { startDate, endDate, ...rest } = dto;
    return this.api.post<PromotionResponseDto>(this.base, {
      name: dto.name,
      slug: dto.slug,
      startDate,
      endDate,
      dto: {
        ...rest,
        startDate,
        endDate,
        StartDate: startDate,
        EndDate: endDate,
        Level: dto.level,
        DiscountType: dto.discountType,
        DiscountValue: dto.discountValue,
      },
    });
  }

  /**
   * Див. {@link create} — та сама обгортка; дати з тим самим подвійним іменуванням у `dto`.
   */
  update(id: string, dto: UpdatePromotionDto): Observable<PromotionResponseDto> {
    const { startDate, endDate, ...rest } = dto;
    const inner: Record<string, unknown> = { ...rest };
    if (startDate !== undefined) {
      inner['startDate'] = startDate;
      inner['StartDate'] = startDate;
    }
    if (endDate !== undefined) {
      inner['endDate'] = endDate;
      inner['EndDate'] = endDate;
    }
    if (dto.discountType !== undefined) {
      inner['DiscountType'] = dto.discountType;
    }
    if (dto.discountValue !== undefined) {
      inner['DiscountValue'] = dto.discountValue;
    }
    if (dto.level !== undefined) {
      inner['Level'] = dto.level;
    }
    return this.api.put<PromotionResponseDto>(`${this.base}/${id}`, { dto: inner });
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }

  getById(id: string): Observable<PromotionResponseDto> {
    return this.api.get<PromotionResponseDto>(`${this.base}/${id}`);
  }

  getBySlug(slug: string): Observable<PromotionResponseDto> {
    return this.api.get<PromotionResponseDto>(`${this.base}/slug/${encodeURIComponent(slug)}`);
  }

  getActive(): Observable<PromotionResponseDto[]> {
    return this.api.get<PromotionResponseDto[]>(`${this.base}/active`);
  }

  addTranslation(
    promotionId: string,
    dto: PromotionTranslationDto,
  ): Observable<PromotionTranslationDto> {
    return this.api.post<PromotionTranslationDto>(
      `${this.base}/${promotionId}/translations`,
      dto,
    );
  }

  updateTranslation(
    promotionId: string,
    dto: PromotionTranslationDto,
  ): Observable<PromotionTranslationDto> {
    return this.api.put<PromotionTranslationDto>(
      `${this.base}/${promotionId}/translations`,
      dto,
    );
  }

  deleteTranslation(promotionId: string, languageCode: string): Observable<void> {
    const lang = encodeURIComponent(languageCode);
    return this.api.delete<void>(`${this.base}/${promotionId}/translations/${lang}`);
  }
}
