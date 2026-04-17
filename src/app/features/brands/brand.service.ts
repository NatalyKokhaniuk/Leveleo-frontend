import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import {
  BrandResponseDto,
  BrandTranslationResponseDto,
  CreateBrandDto,
  CreateBrandTranslationDto,
  UpdateBrandDto,
} from './brand.types';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class BrandService {
  private api = inject(ApiService);
  private base = '/brands';
  /** Уникаємо дубльованих GET при багатьох картках з одним брендом. */
  private readonly getById$ = new Map<string, Observable<BrandResponseDto>>();

  create(dto: CreateBrandDto): Observable<BrandResponseDto> {
    return this.api.post<BrandResponseDto>(this.base, dto);
  }

  update(id: string, dto: UpdateBrandDto): Observable<BrandResponseDto> {
    return this.api.put<BrandResponseDto>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }

  getById(id: string): Observable<BrandResponseDto> {
    const key = id.trim();
    let cached = this.getById$.get(key);
    if (!cached) {
      cached = this.api.get<BrandResponseDto>(`${this.base}/${encodeURIComponent(key)}`).pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.getById$.set(key, cached);
    }
    return cached;
  }

  getBySlug(slug: string): Observable<BrandResponseDto> {
    return this.api.get<BrandResponseDto>(`${this.base}/slug/${encodeURIComponent(slug)}`);
  }

  getAll(): Observable<BrandResponseDto[]> {
    return this.api.get<BrandResponseDto[]>(this.base);
  }

  search(query: string): Observable<BrandResponseDto[]> {
    const q = encodeURIComponent(query);
    return this.api.get<BrandResponseDto[]>(`${this.base}/search?query=${q}`);
  }

  addTranslation(brandId: string, dto: CreateBrandTranslationDto): Observable<void> {
    return this.api.post<void>(`${this.base}/${brandId}/translations`, dto);
  }

  updateTranslation(brandId: string, dto: CreateBrandTranslationDto): Observable<void> {
    return this.api.put<void>(`${this.base}/${brandId}/translations`, dto);
  }

  deleteTranslation(brandId: string, languageCode: string): Observable<void> {
    const lang = encodeURIComponent(languageCode);
    return this.api.delete<void>(`${this.base}/${brandId}/translations/${lang}`);
  }

  getTranslationsByBrandId(brandId: string): Observable<BrandTranslationResponseDto[]> {
    return this.api.get<BrandTranslationResponseDto[]>(`${this.base}/${brandId}/translations`);
  }

  getTranslationByLanguage(
    brandId: string,
    languageCode: string,
  ): Observable<BrandTranslationResponseDto> {
    const lang = encodeURIComponent(languageCode);
    return this.api.get<BrandTranslationResponseDto>(
      `${this.base}/${brandId}/translations/${lang}`,
    );
  }
}
