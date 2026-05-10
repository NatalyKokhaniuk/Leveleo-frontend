/**
 * DTO під GET /api/admin/Statistics/* (camelCase як у ASP.NET Core).
 */

export interface DashboardStatsDto {
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  completedOrders: number;
  lowStockProducts: StockAlertProductDto[];
  outOfStockProducts: StockAlertProductDto[];
  pendingReviews: PendingReviewDto[];
  lowStockCount: number;
  outOfStockCount: number;
  pendingReviewsCount: number;
}

export interface PendingReviewDto {
  id: string;
  productId: string;
  userId: string;
  createdAt: string;
}

/** Активний товар у сповіщенні про залишок: { id, name, stockQuantity }. */
export interface StockAlertProductDto {
  id: string;
  name: string;
  stockQuantity: number;
}

/** Місячний звіт: лише Completed, рік UTC; лише місяці з даними. monthName — uk-UA. */
export interface MonthlySalesReportDto {
  year: number;
  month: number;
  monthName: string;
  ordersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
}

/** Денний звіт: Completed, діапазон по createdAt UTC; date зазвичай YYYY-MM-DD. */
export interface DailySalesReportDto {
  date: string;
  ordersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
}

/** Query до top-selling як SalesReportFilterDto + top (flat у query-string). */
export interface SalesReportFilterDto {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  brandId?: string;
  top?: number;
}

/**
 * Продуктовий топ: completed замовлення, групування по товару.
 * averagePrice = totalRevenue / unitsSold (округлення на бекенді, часто до 4 знаків).
 */
export interface ProductSalesStatsDto {
  productId: string;
  productName: string;
  productSlug: string;
  unitsSold: number;
  totalRevenue: number;
  averagePrice: number;
  currentStock: number;
}

/**
 * Залишки й резерв: лише активні товари, сорт availableStock ↑.
 */
export interface ProductStockHistoryDto {
  productId: string;
  productName: string;
  currentStock: number;
  reservedQuantity: number;
  availableStock: number;
  isLowStock: boolean;
  lowStockThreshold: number;
}

/**
 * Рядок промо-статистики; порядок з бекенду — за totalRevenueWithPromotion ↓.
 * Для cart-level акцій без знімка в замовленні числові поля можуть бути 0 — бекенд може дати пояснення в `summary`.
 */
export interface PromotionStatsDto {
  promotionId: string;
  promotionName: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  ordersWithPromotion: number;
  totalDiscountGiven: number;
  totalRevenueWithPromotion: number;
  uniqueCustomers: number;
  /** Текст від API (узгодженість звіту, саммарі по рядку). */
  summary?: string | null;
}
