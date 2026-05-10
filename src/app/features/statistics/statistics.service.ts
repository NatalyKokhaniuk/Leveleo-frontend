import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  DailySalesReportDto,
  DashboardStatsDto,
  MonthlySalesReportDto,
  ProductSalesStatsDto,
  ProductStockHistoryDto,
  PromotionStatsDto,
  SalesReportFilterDto,
} from './statistics.types';

/**
 * Адмінська статистика LeveLEO — базовий шлях GET /api/admin/Statistics/…
 * (через ApiService з префіксом /api). Авторизація — як у додатку (cookie / Bearer).
 */
@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private api = inject(ApiService);
  private readonly base = '/admin/Statistics';

  /** DashboardStatsDto. */
  getDashboardStats(): Observable<DashboardStatsDto> {
    return this.api.get<DashboardStatsDto>(`${this.base}/dashboard`);
  }

  /** MonthlySalesReportDto[]. year = 0 або без параметра на бекенді — поточний рік UTC. */
  getSalesMonthly(year: number): Observable<MonthlySalesReportDto[]> {
    return this.api.get<MonthlySalesReportDto[]>(
      `${this.base}/sales/monthly?year=${encodeURIComponent(String(year))}`,
    );
  }

  /** DailySalesReportDto[]. Діапазон у query — ISO DateTimeOffset (наприклад …Z). */
  getSalesDaily(startDateIso: string, endDateIso: string): Observable<DailySalesReportDto[]> {
    const q = `startDate=${encodeURIComponent(startDateIso)}&endDate=${encodeURIComponent(endDateIso)}`;
    return this.api.get<DailySalesReportDto[]>(`${this.base}/sales/daily?${q}`);
  }

  /** ProductSalesStatsDto[]. Query flat (camelCase): top, startDate, endDate, categoryId, brandId. */
  getProductsTopSelling(filter: SalesReportFilterDto): Observable<ProductSalesStatsDto[]> {
    const top = filter.top ?? 10;
    const parts = [`top=${encodeURIComponent(String(top))}`];
    if (filter.startDate) parts.push(`startDate=${encodeURIComponent(filter.startDate)}`);
    if (filter.endDate) parts.push(`endDate=${encodeURIComponent(filter.endDate)}`);
    if (filter.categoryId) parts.push(`categoryId=${encodeURIComponent(filter.categoryId)}`);
    if (filter.brandId) parts.push(`brandId=${encodeURIComponent(filter.brandId)}`);
    return this.api.get<ProductSalesStatsDto[]>(`${this.base}/products/top-selling?${parts.join('&')}`);
  }

  /** ProductStockHistoryDto[] без параметрів. */
  getProductsStockStatus(): Observable<ProductStockHistoryDto[]> {
    return this.api.get<ProductStockHistoryDto[]>(`${this.base}/products/stock-status`);
  }

  /** PromotionStatsDto[], activeOnly у query-string. */
  getPromotionStats(activeOnly: boolean): Observable<PromotionStatsDto[]> {
    return this.api.get<PromotionStatsDto[]>(
      `${this.base}/promotions?activeOnly=${activeOnly ? 'true' : 'false'}`,
    );
  }
}
