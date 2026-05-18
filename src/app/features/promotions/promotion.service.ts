import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
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

  
  getAll(): Observable<PromotionResponseDto[]> {
    return this.api.get<PromotionResponseDto[]>(this.base);
  }

  create(dto: CreatePromotionDto): Observable<PromotionResponseDto> {
    return this.api.post<PromotionResponseDto>(this.base, dto);
  }

  update(id: string, dto: UpdatePromotionDto): Observable<PromotionResponseDto> {
    return this.api.put<PromotionResponseDto>(`${this.base}/${id}`, dto);
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

  /**
   * Активні акції за датами.
   * `guestEligibleOnly: true` — лише без купона та не персональні (для вітрини / гостей).
   */
  getActive(opts?: { guestEligibleOnly?: boolean }): Observable<PromotionResponseDto[]> {
    const qs = opts?.guestEligibleOnly === true ? '?guestEligibleOnly=true' : '';
    return this.api.get<PromotionResponseDto[]>(`${this.base}/active${qs}`);
  }

  /**
   * Список активних акцій + повний DTO кожної (як на `/promotions`).
   * `GET /active` часто повертає лише id/slug/дати — без `imageKey` і `level`.
   */
  loadActiveWithDetails(): Observable<PromotionResponseDto[]> {
    return this.getActive().pipe(
      switchMap((list) => {
        const arr = list ?? [];
        if (arr.length === 0) {
          return of([] as PromotionResponseDto[]);
        }
        return forkJoin(
          arr.map((p) => this.getById(p.id).pipe(catchError(() => of(p)))),
        );
      }),
    );
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
