import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { DashboardStatsDto, MonthlySalesReportDto } from './statistics.types';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private api = inject(ApiService);
  private base = '/admin/statistics';

  getDashboardStats(): Observable<DashboardStatsDto> {
    return this.api.get<DashboardStatsDto>(`${this.base}/dashboard`);
  }

  getMonthlySales(year: number): Observable<MonthlySalesReportDto[]> {
    return this.api.get<MonthlySalesReportDto[]>(`${this.base}/sales/monthly?year=${year}`);
  }
}
