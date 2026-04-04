/** Відповідає enum AttributeType на бекенді (серіалізація як число). */
export enum AttributeType {
  String = 0,
  Decimal = 1,
  Integer = 2,
  Boolean = 3,
}

const ATTRIBUTE_TYPE_BY_NAME: Record<string, AttributeType> = {
  string: AttributeType.String,
  str: AttributeType.String,
  decimal: AttributeType.Decimal,
  double: AttributeType.Decimal,
  float: AttributeType.Decimal,
  single: AttributeType.Decimal,
  real: AttributeType.Decimal,
  integer: AttributeType.Integer,
  int: AttributeType.Integer,
  int32: AttributeType.Integer,
  int64: AttributeType.Integer,
  int16: AttributeType.Integer,
  int8: AttributeType.Integer,
  uint: AttributeType.Integer,
  uint32: AttributeType.Integer,
  uint64: AttributeType.Integer,
  long: AttributeType.Integer,
  short: AttributeType.Integer,
  byte: AttributeType.Integer,
  boolean: AttributeType.Boolean,
  bool: AttributeType.Boolean,
};

function mapAttributeTypeName(s: string): AttributeType | undefined {
  const key = s.trim().toLowerCase();
  if (!key) {
    return undefined;
  }
  if (ATTRIBUTE_TYPE_BY_NAME[key] !== undefined) {
    return ATTRIBUTE_TYPE_BY_NAME[key];
  }
  /** Повні імена .NET / Swagger: "AttributeType.Integer", "ProductAttributeType.Int32" */
  const tail = key.includes('.') ? key.split('.').pop()!.trim() : key;
  return ATTRIBUTE_TYPE_BY_NAME[tail];
}

/**
 * Бекенд може повертати type як число (0–3) або як рядок імені enum ("Boolean", "String"…).
 * Без нормалізації Record[type] у UI дає «Текст» для всіх рядкових значень.
 */
export function normalizeAttributeType(raw: unknown): AttributeType {
  if (raw !== null && typeof raw === 'object' && 'type' in (raw as object)) {
    return normalizeAttributeType((raw as { type: unknown }).type);
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3) {
    return raw as AttributeType;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s === '') {
      return AttributeType.String;
    }
    const asNum = Number(s);
    if (s !== '' && Number.isInteger(asNum) && asNum >= 0 && asNum <= 3) {
      return asNum as AttributeType;
    }
    const byName = mapAttributeTypeName(s);
    if (byName !== undefined) {
      return byName;
    }
  }
  return AttributeType.String;
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
  /** У відповіді API інколи приходить рядок імені enum; використовуйте normalizeAttributeType / normalizeProductAttributeDto. */
  type: AttributeType;
  unit?: string | null;
  isFilterable: boolean;
  isComparable: boolean;
  /** Якщо бекенд додає в DTO — для відображення групи в таблиці. */
  attributeGroupId?: string | null;
  translations: ProductAttributeTranslationResponseDto[];
}

export function normalizeProductAttributeDto(
  dto: ProductAttributeResponseDto,
): ProductAttributeResponseDto {
  return {
    ...dto,
    type: normalizeAttributeType(dto.type as unknown),
  };
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
