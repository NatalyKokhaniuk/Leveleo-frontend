export interface AttributeGroupTranslationResponseDto {
  id: string;
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface AttributeGroupResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  translations: AttributeGroupTranslationResponseDto[];
}

export interface CreateAttributeGroupTranslationDto {
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface CreateAttributeGroupDto {
  name: string;
  description?: string | null;
  translations?: CreateAttributeGroupTranslationDto[] | null;
}

/** Плоский JSON для оновлення (як очікує API). */
export interface UpdateAttributeGroupDto {
  name?: string;
  description?: string | null;
}
