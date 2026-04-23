import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatisticsService } from '../../../../features/statistics/statistics.service';
import {
  DailySalesReportDto,
  DashboardStatsDto,
  MonthlySalesReportDto,
  ProductStockStatusDto,
  PromotionStatisticsDto,
  TopSellingProductDto,
} from '../../../../features/statistics/statistics.types';

Chart.register(...registerables);

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdToStartIso(ymd: string): string {
  return `${ymd}T00:00:00.000Z`;
}

function ymdToEndIso(ymd: string): string {
  return `${ymd}T23:59:59.999Z`;
}

function cssColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [
    TranslateModule,
    DecimalPipe,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatSlideToggleModule,
    RouterLink,
  ],
  templateUrl: './statistics.html',
  styleUrl: './statistics.scss',
})
export class AdminStatisticsComponent implements OnInit, OnDestroy {
  private api = inject(StatisticsService);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  monthlyCanvas = viewChild<ElementRef<HTMLCanvasElement>>('monthlyCanvas');
  dailyCanvas = viewChild<ElementRef<HTMLCanvasElement>>('dailyCanvas');
  topSellingCanvas = viewChild<ElementRef<HTMLCanvasElement>>('topSellingCanvas');
  stockCanvas = viewChild<ElementRef<HTMLCanvasElement>>('stockCanvas');
  promotionsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('promotionsCanvas');

  loading = signal(true);
  loadError = signal(false);
  partialBusy = signal(false);

  dashboard = signal<DashboardStatsDto | null>(null);
  monthly = signal<MonthlySalesReportDto[]>([]);
  daily = signal<DailySalesReportDto[]>([]);
  topSelling = signal<TopSellingProductDto[]>([]);
  stockStatus = signal<ProductStockStatusDto[]>([]);
  promotions = signal<PromotionStatisticsDto[]>([]);

  selectedYear = signal(new Date().getFullYear());
  yearOptions = signal<number[]>([]);

  dailyStartYmd = signal('');
  dailyEndYmd = signal('');
  topCount = signal(10);
  promoActiveOnly = signal(false);

  private chartMonthly: Chart | null = null;
  private chartDaily: Chart | null = null;
  private chartTop: Chart | null = null;
  private chartStock: Chart | null = null;
  private chartPromo: Chart | null = null;

  ngOnInit(): void {
    const y = new Date().getFullYear();
    this.yearOptions.set([y - 2, y - 1, y, y + 1]);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    this.dailyStartYmd.set(formatYmd(start));
    this.dailyEndYmd.set(formatYmd(end));
    this.reloadAll();
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.loading()) this.queueCharts();
    });
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  reloadAll(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const year = this.selectedYear();
    const ds = ymdToStartIso(this.dailyStartYmd());
    const de = ymdToEndIso(this.dailyEndYmd());
    const top = this.topCount();
    const promoOnly = this.promoActiveOnly();

    forkJoin({
      dashboard: this.api.getDashboardStats().pipe(catchError(() => of(null))),
      monthly: this.api.getMonthlySales(year).pipe(catchError(() => of([] as MonthlySalesReportDto[]))),
      daily: this.api.getDailySales(ds, de).pipe(catchError(() => of([] as DailySalesReportDto[]))),
      topSelling: this.api.getTopSelling({ startDate: ds, endDate: de, top }).pipe(catchError(() => of([]))),
      stock: this.api.getStockStatus().pipe(catchError(() => of([] as ProductStockStatusDto[]))),
      promotions: this.api.getPromotions(promoOnly).pipe(catchError(() => of([] as PromotionStatisticsDto[]))),
    }).subscribe((res) => {
      if (res.dashboard === null) this.loadError.set(true);
      this.dashboard.set(res.dashboard);
      this.monthly.set(res.monthly ?? []);
      this.daily.set(res.daily ?? []);
      this.topSelling.set(res.topSelling ?? []);
      this.stockStatus.set(res.stock ?? []);
      this.promotions.set(res.promotions ?? []);
      this.loading.set(false);
      this.queueCharts();
    });
  }

  setDailyStart(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.dailyStartYmd.set(v);
  }

  setDailyEnd(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.dailyEndYmd.set(v);
  }

  setTopCount(ev: Event): void {
    const raw = Number((ev.target as HTMLInputElement).value);
    if (!Number.isFinite(raw)) return;
    this.topCount.set(Math.min(50, Math.max(3, Math.floor(raw))));
  }

  onYearChange(year: number | string): void {
    const y = typeof year === 'string' ? Number(year) : year;
    if (!Number.isFinite(y)) return;
    this.selectedYear.set(y);
    this.partialBusy.set(true);
    this.api.getMonthlySales(y).subscribe({
      next: (rows) => {
        this.monthly.set(rows ?? []);
        this.partialBusy.set(false);
        this.queueCharts();
      },
      error: () => {
        this.monthly.set([]);
        this.partialBusy.set(false);
        this.queueCharts();
      },
    });
  }

  applyDailyRange(): void {
    const ds = ymdToStartIso(this.dailyStartYmd());
    const de = ymdToEndIso(this.dailyEndYmd());
    this.partialBusy.set(true);
    forkJoin({
      daily: this.api.getDailySales(ds, de).pipe(catchError(() => of([] as DailySalesReportDto[]))),
      topSelling: this.api
        .getTopSelling({ startDate: ds, endDate: de, top: this.topCount() })
        .pipe(catchError(() => of([]))),
    }).subscribe((res) => {
      this.daily.set(res.daily ?? []);
      this.topSelling.set(res.topSelling ?? []);
      this.partialBusy.set(false);
      this.queueCharts();
    });
  }

  applyTopCount(): void {
    const ds = ymdToStartIso(this.dailyStartYmd());
    const de = ymdToEndIso(this.dailyEndYmd());
    this.partialBusy.set(true);
    this.api.getTopSelling({ startDate: ds, endDate: de, top: this.topCount() }).subscribe({
      next: (rows) => {
        this.topSelling.set(rows ?? []);
        this.partialBusy.set(false);
        this.queueCharts();
      },
      error: () => {
        this.topSelling.set([]);
        this.partialBusy.set(false);
        this.queueCharts();
      },
    });
  }

  onPromoActiveToggle(value: boolean): void {
    this.promoActiveOnly.set(value);
    this.partialBusy.set(true);
    this.api.getPromotions(value).subscribe({
      next: (rows) => {
        this.promotions.set(rows ?? []);
        this.partialBusy.set(false);
        this.queueCharts();
      },
      error: () => {
        this.promotions.set([]);
        this.partialBusy.set(false);
        this.queueCharts();
      },
    });
  }

  refreshStock(): void {
    this.partialBusy.set(true);
    this.api.getStockStatus().subscribe({
      next: (rows) => {
        this.stockStatus.set(rows ?? []);
        this.partialBusy.set(false);
        this.queueCharts();
      },
      error: () => {
        this.stockStatus.set([]);
        this.partialBusy.set(false);
        this.queueCharts();
      },
    });
  }

  /** Після оновлення DOM (canvas у шаблоні) перемальовуємо графіки. */
  private queueCharts(): void {
    if (this.loading()) return;
    afterNextRender(
      () => {
        this.refreshCharts();
      },
      { injector: this.injector },
    );
  }

  private refreshCharts(): void {
    this.destroyCharts();
    this.buildMonthlyChart();
    this.buildDailyChart();
    this.buildTopSellingChart();
    this.buildStockChart();
    this.buildPromotionsChart();
  }

  private destroyCharts(): void {
    this.chartMonthly?.destroy();
    this.chartMonthly = null;
    this.chartDaily?.destroy();
    this.chartDaily = null;
    this.chartTop?.destroy();
    this.chartTop = null;
    this.chartStock?.destroy();
    this.chartStock = null;
    this.chartPromo?.destroy();
    this.chartPromo = null;
  }

  private buildMonthlyChart(): void {
    const canvas = this.monthlyCanvas()?.nativeElement;
    const rows = this.monthly();
    if (!canvas || rows.length === 0) return;

    const labels = rows.map((r) => r.monthName || `${r.month}/${r.year}`);
    const primary = cssColor('--mat-sys-primary', '#6750a4');
    const tertiary = cssColor('--mat-sys-tertiary', '#7d5260');

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.translate.instant('ADMIN.STATS.CHART_REVENUE'),
            data: rows.map((r) => Number(r.totalRevenue) || 0),
            backgroundColor: colorWithAlpha(primary, 0.75),
            borderColor: primary,
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: this.translate.instant('ADMIN.STATS.CHART_ORDERS'),
            data: rows.map((r) => Number(r.ordersCount) || 0),
            backgroundColor: colorWithAlpha(tertiary, 0.65),
            borderColor: tertiary,
            borderWidth: 1,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: this.translate.instant('ADMIN.STATS.CHART_REVENUE') },
            ticks: { maxTicksLimit: 6 },
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: this.translate.instant('ADMIN.STATS.CHART_ORDERS') },
            ticks: { maxTicksLimit: 6 },
          },
          x: { ticks: { maxRotation: 45, minRotation: 0 } },
        },
        plugins: { legend: { position: 'top' } },
      },
    };
    this.chartMonthly = new Chart(canvas, cfg);
  }

  private buildDailyChart(): void {
    const canvas = this.dailyCanvas()?.nativeElement;
    const rows = this.daily();
    if (!canvas || rows.length === 0) return;

    const labels = rows.map((r) => shortDateLabel(r.date));
    const primary = cssColor('--mat-sys-primary', '#6750a4');
    const secondary = cssColor('--mat-sys-secondary', '#625b71');

    const cfg: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.translate.instant('ADMIN.STATS.CHART_REVENUE'),
            data: rows.map((r) => Number(r.totalRevenue) || 0),
            borderColor: primary,
            backgroundColor: colorWithAlpha(primary, 0.15),
            fill: true,
            tension: 0.25,
            yAxisID: 'y',
          },
          {
            label: this.translate.instant('ADMIN.STATS.CHART_ORDERS'),
            data: rows.map((r) => Number(r.ordersCount) || 0),
            borderColor: secondary,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.25,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: this.translate.instant('ADMIN.STATS.CHART_REVENUE') },
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: this.translate.instant('ADMIN.STATS.CHART_ORDERS') },
          },
          x: { ticks: { maxTicksLimit: 14 } },
        },
        plugins: { legend: { position: 'top' } },
      },
    };
    this.chartDaily = new Chart(canvas, cfg);
  }

  private buildTopSellingChart(): void {
    const canvas = this.topSellingCanvas()?.nativeElement;
    const rows = this.topSelling();
    if (!canvas || rows.length === 0) return;

    const labels = rows.map((r) => truncate(r.productName || '—', 36));
    const primary = cssColor('--mat-sys-primary', '#6750a4');

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.translate.instant('ADMIN.STATS.CHART_UNITS_SOLD'),
            data: rows.map((r) => Number(r.unitsSold) || 0),
            backgroundColor: colorWithAlpha(primary, 0.75),
            borderColor: primary,
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { ticks: { autoSkip: false } },
        },
        plugins: { legend: { display: false } },
      },
    };
    this.chartTop = new Chart(canvas, cfg);
  }

  private buildStockChart(): void {
    const canvas = this.stockCanvas()?.nativeElement;
    const rows = this.stockStatus();
    if (!canvas || rows.length === 0) return;

    let low = 0;
    let ok = 0;
    for (const r of rows) {
      if (r.isLowStock) low += 1;
      else ok += 1;
    }
    if (low === 0 && ok === 0) return;

    const errorC = cssColor('--mat-sys-error', '#b3261e');
    const primary = cssColor('--mat-sys-primary', '#6750a4');

    const cfg: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: [
          this.translate.instant('ADMIN.STATS.STOCK_LOW'),
          this.translate.instant('ADMIN.STATS.STOCK_OK'),
        ],
        datasets: [
          {
            data: [low, ok],
            backgroundColor: [colorWithAlpha(errorC, 0.85), colorWithAlpha(primary, 0.75)],
            borderColor: [errorC, primary],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    };
    this.chartStock = new Chart(canvas, cfg);
  }

  private buildPromotionsChart(): void {
    const canvas = this.promotionsCanvas()?.nativeElement;
    const rows = this.promotions();
    if (!canvas || rows.length === 0) return;

    const labels = rows.map((r) => truncate(r.promotionName || '—', 28));
    const tertiary = cssColor('--mat-sys-tertiary', '#7d5260');

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.translate.instant('ADMIN.STATS.CHART_ORDERS'),
            data: rows.map((r) => Number(r.ordersWithPromotion) || 0),
            backgroundColor: colorWithAlpha(tertiary, 0.75),
            borderColor: tertiary,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxRotation: 60, minRotation: 0 } },
        },
        plugins: { legend: { display: false } },
      },
    };
    this.chartPromo = new Chart(canvas, cfg);
  }
}

function shortDateLabel(isoDate: string): string {
  const s = (isoDate ?? '').trim();
  if (s.length >= 10) return s.slice(0, 10);
  return s || '—';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function colorWithAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#') && (c.length === 7 || c.length === 9)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
