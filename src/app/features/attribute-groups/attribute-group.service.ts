import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttributeGroupResponseDto,
  AttributeGroupTranslationResponseDto,
  CreateAttributeGroupDto,
  CreateAttributeGroupTranslationDto,
  UpdateAttributeGroupDto,
} from './attribute-group.types';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class AttributeGroupService {
  private api = inject(ApiService);
  private base = '/attributegroups';

  create(dto: CreateAttributeGroupDto): Observable<AttributeGroupResponseDto> {
    return this.api.post<AttributeGroupResponseDto>(this.base, dto);
  }

  update(id: string, dto: UpdateAttributeGroupDto): Observable<AttributeGroupResponseDto> {
    return this.api.put<AttributeGroupResponseDto>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`);
  }

  getById(id: string): Observable<AttributeGroupResponseDto> {
    return this.api.get<AttributeGroupResponseDto>(`${this.base}/${id}`);
  }

  getBySlug(slug: string): Observable<AttributeGroupResponseDto> {
    return this.api.get<AttributeGroupResponseDto>(
      `${this.base}/slug/${encodeURIComponent(slug)}`,
    );
  }

  getAll(): Observable<AttributeGroupResponseDto[]> {
    return this.api.get<AttributeGroupResponseDto[]>(this.base);
  }

  search(query: string): Observable<AttributeGroupResponseDto[]> {
    const q = encodeURIComponent(query);
    return this.api.get<AttributeGroupResponseDto[]>(`${this.base}/search?q=${q}`);
  }

  addTranslation(
    groupId: string,
    dto: CreateAttributeGroupTranslationDto,
  ): Observable<void> {
    return this.api.post<void>(`${this.base}/${groupId}/translations`, dto);
  }

  updateTranslation(
    groupId: string,
    dto: CreateAttributeGroupTranslationDto,
  ): Observable<void> {
    return this.api.put<void>(`${this.base}/${groupId}/translations`, dto);
  }

  deleteTranslation(groupId: string, languageCode: string): Observable<void> {
    const lang = encodeURIComponent(languageCode);
    return this.api.delete<void>(`${this.base}/${groupId}/translations/${lang}`);
  }

  getTranslationsByGroupId(
    groupId: string,
  ): Observable<AttributeGroupTranslationResponseDto[]> {
    return this.api.get<AttributeGroupTranslationResponseDto[]>(
      `${this.base}/${groupId}/translations`,
    );
  }

  getTranslationByLanguage(
    groupId: string,
    languageCode: string,
  ): Observable<AttributeGroupTranslationResponseDto> {
    const lang = encodeURIComponent(languageCode);
    return this.api.get<AttributeGroupTranslationResponseDto>(
      `${this.base}/${groupId}/translations/${lang}`,
    );
  }
}
