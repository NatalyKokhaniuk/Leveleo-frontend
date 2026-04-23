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

export interface StockAlertProductDto {
  id: string;
  name: string;
  stockQuantity: number;
}

export interface MonthlySalesReportDto {
  year: number;
  month: number;
  monthName: string;
  ordersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface DailySalesReportDto {
  date: string;
  ordersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface TopSellingProductDto {
  productId: string;
  productName: string;
  productSlug: string;
  unitsSold: number;
  totalRevenue: number;
  averagePrice: number;
  currentStock: number;
}

export interface ProductStockStatusDto {
  productId: string;
  productName: string;
  currentStock: number;
  reservedQuantity: number;
  availableStock: number;
  isLowStock: boolean;
  lowStockThreshold: number;
}

export interface PromotionStatisticsDto {
  promotionId: string;
  promotionName: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  ordersWithPromotion: number;
  totalDiscountGiven: number;
  totalRevenueWithPromotion: number;
  uniqueCustomers: number;
}
