/** GET/PUT купона: `/api/promotions/{id}/coupon` або fallback `/api/admin/promotions/{id}/coupon` (як зареєстровано на API). */
export interface PromotionCouponAdminDto {
  couponCode?: string | null;
  maxUsages?: number | null;
  usedCount?: number | null;
  isCoupon?: boolean;
  isPersonal?: boolean;
  promotionName?: string | null;
  promotionSlug?: string | null;
  slug?: string | null;
  name?: string | null;
  assignments?: PromotionCouponAssignmentDto[] | null;
}

export interface PromotionCouponAssignmentDto {
  id: string;
  userId: string;
  email?: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  maxUsagePerUser?: number | null;
  expiresAt?: string | null;
}

export interface UpdatePromotionCouponAdminDto {
  isCoupon?: boolean;
  isPersonal?: boolean;
  couponCode?: string | null;
  maxUsages?: number | null;
}

export interface CreateCouponAssignmentDto {
  userId: string;
  maxUsagePerUser?: number | null;
  expiresAt?: string | null;
}

export interface UpdateCouponAssignmentDto {
  maxUsagePerUser?: number | null;
  expiresAt?: string | null;
}
