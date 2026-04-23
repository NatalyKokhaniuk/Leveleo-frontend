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
  outOfStockProducts:StockAlertProductDto[];
  pendingReviews:PendingReviewDto[];
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
