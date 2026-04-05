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
  name: string;
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

/** Плоский JSON для оновлення (як у брендів/продуктів — бекенд мапить у Optional). */
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
