import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CategoryBreadcrumbsDto,
  CategoryResponseDto,
  CategoryTranslationResponseDto,
  CreateCategoryDto,
  CreateCategoryTranslationDto,
  UpdateCategoryDto,
} from './category.types';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private api = inject(ApiService);
  private base = '/categories';

  create(dto: CreateCategoryDto): Observable<CategoryResponseDto> {
    return this.api.post<CategoryResponseDto>(this.base, dto);
  }

  update(id: string, dto: UpdateCategoryDto): Observable<CategoryResponseDto> {
    return this.api.put<CategoryResponseDto>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }

  getById(id: string): Observable<CategoryResponseDto> {
    return this.api.get<CategoryResponseDto>(`${this.base}/${id}`);
  }

  getBySlug(slug: string): Observable<CategoryResponseDto> {
    return this.api.get<CategoryResponseDto>(
      `${this.base}/slug/${encodeURIComponent(slug)}`,
    );
  }

  getAll(): Observable<CategoryResponseDto[]> {
    return this.api.get<CategoryResponseDto[]>(this.base);
  }

  search(query: string): Observable<CategoryResponseDto[]> {
    const q = encodeURIComponent(query);
    return this.api.get<CategoryResponseDto[]>(`${this.base}/search?query=${q}`);
  }

  getBreadcrumbs(id: string): Observable<CategoryBreadcrumbsDto> {
    return this.api.get<CategoryBreadcrumbsDto>(`${this.base}/${id}/breadcrumbs`);
  }

  addTranslation(
    categoryId: string,
    dto: CreateCategoryTranslationDto,
  ): Observable<void> {
    return this.api.post<void>(`${this.base}/${categoryId}/translations`, dto);
  }

  updateTranslation(
    categoryId: string,
    dto: CreateCategoryTranslationDto,
  ): Observable<void> {
    return this.api.put<void>(`${this.base}/${categoryId}/translations`, dto);
  }

  deleteTranslation(categoryId: string, languageCode: string): Observable<void> {
    const lang = encodeURIComponent(languageCode);
    return this.api.delete<void>(
      `${this.base}/${categoryId}/translations/${lang}`,
    );
  }

  getTranslationsByCategoryId(
    categoryId: string,
  ): Observable<CategoryTranslationResponseDto[]> {
    return this.api.get<CategoryTranslationResponseDto[]>(
      `${this.base}/${categoryId}/translations`,
    );
  }

  getTranslationByLanguage(
    categoryId: string,
    languageCode: string,
  ): Observable<CategoryTranslationResponseDto> {
    const lang = encodeURIComponent(languageCode);
    return this.api.get<CategoryTranslationResponseDto>(
      `${this.base}/${categoryId}/translations/${lang}`,
    );
  }
}
