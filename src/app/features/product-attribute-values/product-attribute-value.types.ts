export interface ProductAttributeValueTranslationResponseDto {
  id: string;
  languageCode: string;
  value: string;
}

export interface ProductAttributeValueResponseDto {
  id: string;
  productAttributeId: string;
  stringValue?: string | null;
  decimalValue?: number | null;
  intValue?: number | null;
  boolValue?: boolean | null;
  translations: ProductAttributeValueTranslationResponseDto[];
}

export interface CreateProductAttributeValueTranslationDto {
  languageCode: string;
  value: string;
}

export interface CreateProductAttributeValueDto {
  productId: string;
  productAttributeId: string;
  stringValue?: string | null;
  decimalValue?: number | null;
  intValue?: number | null;
  boolValue?: boolean | null;
  translations?: CreateProductAttributeValueTranslationDto[] | null;
}

export interface UpdateProductAttributeValueDto {
  productAttributeId?: string;
  stringValue?: string | null;
  decimalValue?: number | null;
  intValue?: number | null;
  boolValue?: boolean | null;
  translations?: CreateProductAttributeValueTranslationDto[] | null;
}
