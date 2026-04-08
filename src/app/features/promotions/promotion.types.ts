/** Відповідає PromotionLevel на бекенді. */
export enum PromotionLevel {
  Product = 0,
  Cart = 1,
}

/** Відповідає DiscountType на бекенді. */
export enum DiscountType {
  Percentage = 0,
  FixedAmount = 1,
}

/** JSON-подання Optional&lt;T&gt; для умов рівня продукт/кошик. */
export interface OptionalJson<T> {
  hasValue: boolean;
  value?: T | null;
}

export interface ProductLevelConditionDto {
  productIds?: OptionalJson<string[]>;
  categoryIds?: OptionalJson<string[]>;
}

export interface CartLevelConditionDto {
  minTotalAmount?: number | null;
  minQuantity?: number | null;
  productIds?: OptionalJson<string[]>;
  categoryIds?: OptionalJson<string[]>;
}

export interface PromotionTranslationDto {
  languageCode: string;
  name: string;
  description?: string | null;
}

/** Відповідь API — додайте productConditions/cartConditions/coupon у MapToDto на бекенді для повного редагування. */
export interface PromotionResponseDto {
  id: string;
  /** У списку може бути null, якщо назва лише в translations або лише slug. */
  name: string | null;
  slug: string;
  description?: string | null;
  imageKey?: string | null;
  level: PromotionLevel;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCoupon: boolean;
  isPersonal: boolean;
  couponCode?: string | null;
  maxUsages?: number | null;
  productConditions?: ProductLevelConditionDto | null;
  cartConditions?: CartLevelConditionDto | null;
  translations: PromotionTranslationDto[];
}

export interface CreatePromotionDto {
  name: string;
  slug: string;
  description?: string | null;
  imageKey?: string | null;
  level: PromotionLevel;
  productConditions?: ProductLevelConditionDto | null;
  cartConditions?: CartLevelConditionDto | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  startDate: string;
  endDate: string;
  isCoupon: boolean;
  isPersonal: boolean;
  couponCode?: string | null;
  maxUsages?: number | null;
  translations?: PromotionTranslationDto[] | null;
}

/**
 * Тіло `PUT /api/promotions/{id}` на бекенді: `[FromBody] UpdatePromotionRequest` з обов’язковим `dto`.
 * Плоский JSON дає 400: «dto field is required» / помилка десеріалізації кореня.
 */
export interface UpdatePromotionRequestBody {
  dto: UpdatePromotionDto;
}

/** Поля оновлення акції (вкладені в `dto` у запиті). */
export interface UpdatePromotionDto {
  name?: string;
  description?: string | null;
  imageKey?: string | null;
  level?: PromotionLevel;
  productConditions?: ProductLevelConditionDto | null;
  cartConditions?: CartLevelConditionDto | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  startDate?: string;
  endDate?: string;
  isCoupon?: boolean;
  isPersonal?: boolean;
  couponCode?: string | null;
  maxUsages?: number | null;
}
