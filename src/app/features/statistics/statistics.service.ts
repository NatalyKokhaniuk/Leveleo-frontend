import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  DailySalesReportDto,
  DashboardStatsDto,
  MonthlySalesReportDto,
  ProductStockStatusDto,
  PromotionStatisticsDto,
  TopSellingProductDto,
} from './statistics.types';

/** Відповідає GET /api/admin/Statistics/... */
@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private api = inject(ApiService);
  private readonly base = '/admin/Statistics';

  getDashboardStats(): Observable<DashboardStatsDto> {
    return this.api.get<DashboardStatsDto>(`${this.base}/dashboard`);
  }

  getMonthlySales(year: number): Observable<MonthlySalesReportDto[]> {
    return this.api.get<MonthlySalesReportDto[]>(
      `${this.base}/sales/monthly?year=${encodeURIComponent(String(year))}`,
    );
  }

  getDailySales(startDateIso: string, endDateIso: string): Observable<DailySalesReportDto[]> {
    const q = `startDate=${encodeURIComponent(startDateIso)}&endDate=${encodeURIComponent(endDateIso)}`;
    return this.api.get<DailySalesReportDto[]>(`${this.base}/sales/daily?${q}`);
  }

  getTopSelling(params: {
    startDate?: string;
    endDate?: string;
    categoryId?: string;
    brandId?: string;
    top?: number;
  }): Observable<TopSellingProductDto[]> {
    const parts = [`top=${encodeURIComponent(String(params.top ?? 10))}`];
    if (params.startDate) parts.push(`StartDate=${encodeURIComponent(params.startDate)}`);
    if (params.endDate) parts.push(`EndDate=${encodeURIComponent(params.endDate)}`);
    if (params.categoryId) parts.push(`CategoryId=${encodeURIComponent(params.categoryId)}`);
    if (params.brandId) parts.push(`BrandId=${encodeURIComponent(params.brandId)}`);
    return this.api.get<TopSellingProductDto[]>(`${this.base}/products/top-selling?${parts.join('&')}`);
  }

  getStockStatus(): Observable<ProductStockStatusDto[]> {
    return this.api.get<ProductStockStatusDto[]>(`${this.base}/products/stock-status`);
  }

  getPromotions(activeOnly: boolean): Observable<PromotionStatisticsDto[]> {
    return this.api.get<PromotionStatisticsDto[]>(
      `${this.base}/promotions?activeOnly=${activeOnly ? 'true' : 'false'}`,
    );
  }
}
