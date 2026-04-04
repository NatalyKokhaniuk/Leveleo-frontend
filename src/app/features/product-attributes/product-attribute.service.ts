import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateProductAttributeDto,
  CreateProductAttributeTranslationDto,
  normalizeProductAttributeDto,
  ProductAttributeResponseDto,
  ProductAttributeTranslationResponseDto,
  UpdateProductAttributeDto,
} from './product-attribute.types';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class ProductAttributeService {
  private api = inject(ApiService);
  private base = '/productattributes';

  create(dto: CreateProductAttributeDto): Observable<ProductAttributeResponseDto> {
    return this.api
      .post<ProductAttributeResponseDto>(this.base, dto)
      .pipe(map(normalizeProductAttributeDto));
  }

  update(id: string, dto: UpdateProductAttributeDto): Observable<ProductAttributeResponseDto> {
    return this.api
      .put<ProductAttributeResponseDto>(`${this.base}/${id}`, dto)
      .pipe(map(normalizeProductAttributeDto));
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }

  getById(id: string): Observable<ProductAttributeResponseDto> {
    return this.api
      .get<ProductAttributeResponseDto>(`${this.base}/${id}`)
      .pipe(map(normalizeProductAttributeDto));
  }

  getBySlug(slug: string): Observable<ProductAttributeResponseDto> {
    return this.api
      .get<ProductAttributeResponseDto>(`${this.base}/slug/${encodeURIComponent(slug)}`)
      .pipe(map(normalizeProductAttributeDto));
  }

  getAll(): Observable<ProductAttributeResponseDto[]> {
    return this.api
      .get<ProductAttributeResponseDto[]>(this.base)
      .pipe(map((list) => list.map(normalizeProductAttributeDto)));
  }

  search(query: string): Observable<ProductAttributeResponseDto[]> {
    const q = encodeURIComponent(query);
    return this.api
      .get<ProductAttributeResponseDto[]>(`${this.base}/search?query=${q}`)
      .pipe(map((list) => list.map(normalizeProductAttributeDto)));
  }

  getByGroupId(groupId: string): Observable<ProductAttributeResponseDto[]> {
    return this.api
      .get<ProductAttributeResponseDto[]>(`${this.base}/group/${groupId}`)
      .pipe(map((list) => list.map(normalizeProductAttributeDto)));
  }

  getByGroupSlug(groupSlug: string): Observable<ProductAttributeResponseDto[]> {
    return this.api
      .get<ProductAttributeResponseDto[]>(
        `${this.base}/group/slug/${encodeURIComponent(groupSlug)}`,
      )
      .pipe(map((list) => list.map(normalizeProductAttributeDto)));
  }

  addTranslation(
    attributeId: string,
    dto: CreateProductAttributeTranslationDto,
  ): Observable<void> {
    return this.api.post<void>(`${this.base}/${attributeId}/translations`, dto);
  }

  updateTranslation(
    attributeId: string,
    dto: CreateProductAttributeTranslationDto,
  ): Observable<void> {
    return this.api.put<void>(`${this.base}/${attributeId}/translations`, dto);
  }

  deleteTranslation(attributeId: string, languageCode: string): Observable<void> {
    const lang = encodeURIComponent(languageCode);
    return this.api.delete<void>(`${this.base}/${attributeId}/translations/${lang}`);
  }

  getTranslations(attributeId: string): Observable<ProductAttributeTranslationResponseDto[]> {
    return this.api.get<ProductAttributeTranslationResponseDto[]>(
      `${this.base}/${attributeId}/translations`,
    );
  }

  getTranslationByLanguage(
    attributeId: string,
    languageCode: string,
  ): Observable<ProductAttributeTranslationResponseDto> {
    const lang = encodeURIComponent(languageCode);
    return this.api.get<ProductAttributeTranslationResponseDto>(
      `${this.base}/${attributeId}/translations/${lang}`,
    );
  }
}
