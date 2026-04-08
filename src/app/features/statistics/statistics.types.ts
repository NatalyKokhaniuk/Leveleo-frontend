export interface DashboardStatsDto {
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  completedOrders: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  pendingReviews: number;
}

export interface MonthlySalesReportDto {
  year: number;
  month: number;
  monthName: string;
  ordersCount: number;
  totalRevenue: number;
  averageOrderValue: number;
}
