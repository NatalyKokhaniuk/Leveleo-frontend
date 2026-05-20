import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  DailySalesReportDto,
  DashboardStatsDto,
  MonthlySalesReportDto,
  ProductStockHistoryDto,
} from './statistics.types';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private api = inject(ApiService);
  private readonly base = '/admin/statistics';

  getDashboardStats(): Observable<DashboardStatsDto> {
    return this.api.get<DashboardStatsDto>(`${this.base}/dashboard`);
  }

  getSalesMonthly(year: number): Observable<MonthlySalesReportDto[]> {
    return this.api.get<MonthlySalesReportDto[]>(
      `${this.base}/sales/monthly?year=${encodeURIComponent(String(year))}`,
    );
  }

  getSalesDaily(startDateIso: string, endDateIso: string): Observable<DailySalesReportDto[]> {
    const q = `startDate=${encodeURIComponent(startDateIso)}&endDate=${encodeURIComponent(endDateIso)}`;
    return this.api.get<DailySalesReportDto[]>(`${this.base}/sales/daily?${q}`);
  }

  getProductsStockStatus(): Observable<ProductStockHistoryDto[]> {
    return this.api.get<ProductStockHistoryDto[]>(`${this.base}/products/stock-status`);
  }
}
