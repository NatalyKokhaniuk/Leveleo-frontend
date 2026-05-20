import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { OrderService } from '../../../../features/orders/order.service';
import { OrderListItemDto } from '../../../../features/orders/order.types';
import { NewsletterService } from '../../../../features/newsletter/newsletter.service';
import {
  aggregateDailySales,
  aggregateMonthlySales,
  filterOrdersInIsoRange,
} from '../../../../features/statistics/statistics-sales.util';
import { StatisticsService } from '../../../../features/statistics/statistics.service';
import {
  DailySalesReportDto,
  DashboardStatsDto,
  MonthlySalesReportDto,
  ProductStockHistoryDto,
} from '../../../../features/statistics/statistics.types';

function ymdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeIso(daysBack: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - daysBack);
  return {
    start: `${ymdUtc(start)}T00:00:00.000Z`,
    end: `${ymdUtc(end)}T23:59:59.999Z`,
  };
}

function yearBoundsIso(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year}-12-31T23:59:59.999Z`,
  };
}

function minIso(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxIso(a: string, b: string): string {
  return a >= b ? a : b;
}

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [
    TranslateModule,
    DecimalPipe,
    RouterLink,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './statistics.html',
})
export class AdminStatisticsComponent implements OnInit {
  private stats = inject(StatisticsService);
  private newsletter = inject(NewsletterService);
  private ordersApi = inject(OrderService);
  private translate = inject(TranslateService);

  loading = signal(true);
  loadError = signal(false);

  dashboard = signal<DashboardStatsDto | null>(null);
  monthly = signal<MonthlySalesReportDto[]>([]);
  daily = signal<DailySalesReportDto[]>([]);
  stockStatus = signal<ProductStockHistoryDto[]>([]);
  subscribersCount = signal<number | null>(null);

  selectedYear = signal(new Date().getUTCFullYear());
  yearOptions = signal<number[]>([]);

  private range = rangeIso(30);
  private salesOrdersCache: OrderListItemDto[] = [];

  ngOnInit(): void {
    const y = new Date().getUTCFullYear();
    this.yearOptions.set([y - 2, y - 1, y, y + 1]);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const year = this.selectedYear();
    const { start, end } = this.range;
    const yearBounds = yearBoundsIso(year);
    const fetchStart = minIso(yearBounds.start, start);
    const fetchEnd = maxIso(yearBounds.end, end);

    forkJoin({
      dashboard: this.stats.getDashboardStats().pipe(catchError(() => of(null))),
      orders: this.fetchAdminOrdersInRange(fetchStart, fetchEnd).pipe(catchError(() => of([]))),
      stock: this.stats.getProductsStockStatus().pipe(catchError(() => of([]))),
      subscribers: this.newsletter.getSubscribersCount().pipe(catchError(() => of({ count: 0 }))),
    }).subscribe((res) => {
      if (res.dashboard === null) this.loadError.set(true);
      this.dashboard.set(res.dashboard);
      this.salesOrdersCache = res.orders ?? [];
      this.applySalesFromOrders(year, start, end);
      this.stockStatus.set(res.stock ?? []);
      this.subscribersCount.set(res.subscribers?.count ?? 0);
      this.loading.set(false);
    });
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    const yearBounds = yearBoundsIso(year);
    const { start, end } = this.range;
    const needStart = minIso(yearBounds.start, start);
    const needEnd = maxIso(yearBounds.end, end);
    const cached = this.salesOrdersCache;
    const hasRange =
      cached.length > 0 &&
      this.ordersCoverRange(cached, needStart, needEnd);

    if (hasRange) {
      this.applySalesFromOrders(year, start, end);
      return;
    }

    this.fetchAdminOrdersInRange(needStart, needEnd).subscribe({
      next: (orders) => {
        this.salesOrdersCache = orders;
        this.applySalesFromOrders(year, start, end);
      },
      error: () => {
        this.monthly.set([]);
        this.daily.set([]);
      },
    });
  }

  applyDailyPreset(preset: '7d' | '30d'): void {
    this.range = rangeIso(preset === '7d' ? 6 : 30);
    const { start, end } = this.range;
    const year = this.selectedYear();
    const yearBounds = yearBoundsIso(year);
    const needStart = minIso(yearBounds.start, start);
    const needEnd = maxIso(yearBounds.end, end);

    if (this.ordersCoverRange(this.salesOrdersCache, needStart, needEnd)) {
      this.applySalesFromOrders(year, start, end);
      return;
    }

    this.fetchAdminOrdersInRange(needStart, needEnd).subscribe({
      next: (orders) => {
        this.salesOrdersCache = orders;
        this.applySalesFromOrders(year, start, end);
      },
      error: () => this.daily.set([]),
    });
  }

  private applySalesFromOrders(year: number, dailyStart: string, dailyEnd: string): void {
    const yearBounds = yearBoundsIso(year);
    const yearOrders = filterOrdersInIsoRange(
      this.salesOrdersCache,
      yearBounds.start,
      yearBounds.end,
    );
    const dailyOrders = filterOrdersInIsoRange(this.salesOrdersCache, dailyStart, dailyEnd);
    this.monthly.set(
      aggregateMonthlySales(yearOrders, year, (month) => this.monthName(year, month)),
    );
    this.daily.set(aggregateDailySales(dailyOrders));
  }

  private monthName(year: number, month: number): string {
    const lang = this.translate.currentLang || 'uk';
    const locale = lang.startsWith('uk') ? 'uk-UA' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
  }

  private fetchAdminOrdersInRange(startIso: string, endIso: string): Observable<OrderListItemDto[]> {
    const pageSize = 200;
    return this.ordersApi
      .getAdminAll({ startDate: startIso, endDate: endIso, page: 1, pageSize })
      .pipe(
        switchMap((first) => {
          const pages = Math.max(1, first.totalPages ?? 1);
          if (pages <= 1) return of(first.items ?? []);
          const rest: Observable<OrderListItemDto[]>[] = [];
          for (let p = 2; p <= pages; p++) {
            rest.push(
              this.ordersApi
                .getAdminAll({ startDate: startIso, endDate: endIso, page: p, pageSize })
                .pipe(map((r) => r.items ?? []), catchError(() => of([]))),
            );
          }
          return forkJoin(rest).pipe(
            map((chunks) => (first.items ?? []).concat(...chunks)),
          );
        }),
      );
  }

  /** Груба перевірка: якщо кеш порожній — треба догрузити. */
  private ordersCoverRange(orders: OrderListItemDto[], _startIso: string, _endIso: string): boolean {
    return orders.length > 0;
  }
}
