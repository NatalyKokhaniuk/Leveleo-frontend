/** Відповідає enum AttributeType на бекенді (серіалізація як число). */
export enum AttributeType {
  String = 0,
  Decimal = 1,
  Integer = 2,
  Boolean = 3,
}

export interface ProductAttributeTranslationResponseDto {
  id: string;
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface ProductAttributeResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: AttributeType;
  unit?: string | null;
  isFilterable: boolean;
  isComparable: boolean;
  /** Якщо бекенд додає в DTO — для відображення групи в таблиці. */
  attributeGroupId?: string | null;
  translations: ProductAttributeTranslationResponseDto[];
}

export interface CreateProductAttributeTranslationDto {
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface CreateProductAttributeDto {
  attributeGroupId: string;
  name: string;
  description?: string | null;
  type: AttributeType;
  unit?: string | null;
  isFilterable: boolean;
  isComparable: boolean;
  translations?: CreateProductAttributeTranslationDto[] | null;
}

/** Плоский JSON для PUT. */
export interface UpdateProductAttributeDto {
  attributeGroupId?: string;
  name?: string;
  description?: string | null;
  type?: AttributeType;
  unit?: string | null;
  isFilterable?: boolean;
  isComparable?: boolean;
}
