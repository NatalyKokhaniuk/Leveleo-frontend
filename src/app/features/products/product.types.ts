/** Відповідає ProductSortBy на бекенді. */
export enum ProductSortBy {
  PriceAsc = 0,
  PriceDesc = 1,
  AverageRatingDesc = 2,
  TotalSoldDesc = 3,
}

/** Фільтр за значеннями атрибута (JSON у ProductFilterDto). */
export interface AttributeFilterValueDto {
  attributeId: string;
  stringValues?: string[] | null;
  decimalValues?: number[] | null;
  integerValues?: number[] | null;
  booleanValues?: boolean[] | null;
}

export interface ProductFilterDto {
  categoryId?: string | null;
  brandId?: string | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  attributeFilters: AttributeFilterValueDto[];
  includeInactive: boolean;
  sortBy: ProductSortBy;
  promotionId?: string | null;
  page: number;
  pageSize: number;
  /**
   * Текстовий пошук у межах списку з фільтрами (разом з categoryId, brandId тощо).
   * На бекенді: додайте `string? SearchQuery` у ProductFilterDto і фільтрацію в GetAllAsync
   * (ILike по Name, Description, Translations — як у SearchAsync).
   */
  searchQuery?: string | null;
}

export interface PagedResultDto<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  items: T[];
}

export interface ProductTranslationDto {
  languageCode: string;
  name: string;
  description?: string | null;
}

export interface ProductTranslationResponseDto {
  id: string;
  languageCode: string;
  name: string;
  description?: string | null;
}

/** Мінімальні поля акції з бекенду (розширювано за потреби). */
export interface AppliedPromotionDto {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  imageKey?: string | null;
  discountType?: number;
  discountValue?: number;
}

export interface ProductResponseDto {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  mainImageKey?: string | null;
  stockQuantity: number;
  availableQuantity: number;
  isActive: boolean;
  categoryId: string;
  brandId: string;
  averageRating: number;
  ratingCount: number;
  totalSold: number;
  translations: ProductTranslationResponseDto[];
  discountedPrice?: number | null;
  appliedPromotion?: AppliedPromotionDto | null;
}

export interface CreateProductDto {
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  brandId: string;
  mainImageKey?: string | null;
  stockQuantity: number;
  isActive: boolean;
  translations?: ProductTranslationDto[] | null;
}

/** Часткове оновлення — плоскі поля (бекенд мапить у Optional). */
export interface UpdateProductDto {
  name?: string;
  description?: string | null;
  price?: number;
  categoryId?: string;
  brandId?: string;
  mainImageKey?: string | null;
  stockQuantity?: number;
  isActive?: boolean;
  translations?: ProductTranslationDto[] | null;
}

export interface ProductImageDto {
  id: string;
  productId: string;
  imageKey: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVideoDto {
  id: string;
  productId: string;
  videoKey: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
