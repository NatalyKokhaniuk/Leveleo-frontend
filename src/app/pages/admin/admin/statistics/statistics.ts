import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatisticsService } from '../../../../features/statistics/statistics.service';
import { DashboardStatsDto, MonthlySalesReportDto } from '../../../../features/statistics/statistics.types';

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [TranslateModule, DecimalPipe, MatProgressSpinnerModule],
  templateUrl: './statistics.html',
  styleUrl: './statistics.scss',
})
export class AdminStatisticsComponent implements OnInit {
  private api = inject(StatisticsService);

  loading = signal(true);
  loadError = signal(false);
  dashboard = signal<DashboardStatsDto | null>(null);
  monthly = signal<MonthlySalesReportDto[]>([]);

  readonly maxRevenue = computed(() =>
    Math.max(1, ...this.monthly().map((x) => Number(x.totalRevenue || 0))),
  );

  ngOnInit(): void {
    const year = new Date().getFullYear();
    forkJoin({
      dashboard: this.api.getDashboardStats(),
      monthly: this.api.getMonthlySales(year),
    })
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of({ dashboard: null, monthly: [] as MonthlySalesReportDto[] });
        }),
      )
      .subscribe((res) => {
        this.dashboard.set(res.dashboard);
        this.monthly.set(res.monthly);
        this.loading.set(false);
      });
  }

  revenueBarWidth(revenue: number): string {
    return `${Math.max(3, (Number(revenue || 0) / this.maxRevenue()) * 100)}%`;
  }
}
