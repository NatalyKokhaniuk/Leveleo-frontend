import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { ORDER_STATUS_VALUES, OrderListItemDto } from '../../../../features/orders/order.types';
import { OrderService } from '../../../../features/orders/order.service';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';
import { OrderStatusLabelPipe } from '../../../../shared/pipes/order-status-label.pipe';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    HorizontalDragScrollDirective,
    OrderStatusLabelPipe,
  ],
  templateUrl: './orders.html',
})
export class AdminOrdersComponent {
  private ordersApi = inject(OrderService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);

  readonly orderStatuses = ORDER_STATUS_VALUES;

  loading = signal(true);
  items = signal<OrderListItemDto[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);

  page = signal(1);
  readonly pageSize = 20;

  /** Порожній рядок = усі статуси */
  statusFilter = signal<string>('');
  startDate = signal('');
  endDate = signal('');
  sortBy = signal<'CreatedAt' | 'TotalPayable' | 'Status'>('CreatedAt');
  sortDirection = signal<'asc' | 'desc'>('desc');

  /** Рядок у таблиці, для якого зараз викликається POST cancel */
  cancellingOrderId = signal<string | null>(null);

  displayedColumns: string[] = ['number', 'createdAt', 'status', 'total', 'addressSummary', 'actions'];

  private readonly orderMatIdToSort: Record<string, 'CreatedAt' | 'TotalPayable' | 'Status'> = {
    createdAt: 'CreatedAt',
    total: 'TotalPayable',
    status: 'Status',
  };

  private readonly orderSortToMatId: Record<'CreatedAt' | 'TotalPayable' | 'Status', string> = {
    CreatedAt: 'createdAt',
    TotalPayable: 'total',
    Status: 'status',
  };

  /** Колонки з серверним сортуванням (узгоджено з GET admin/all) */
  orderMatSortActive(): string {
    return this.orderSortToMatId[this.sortBy()] ?? 'createdAt';
  }

  onOrderTableSort(sort: Sort): void {
    if (!sort.direction) {
      this.sortBy.set('CreatedAt');
      this.sortDirection.set('desc');
      this.page.set(1);
      this.reload();
      return;
    }
    const api = this.orderMatIdToSort[sort.active];
    if (!api) return;
    this.sortBy.set(api);
    this.sortDirection.set(sort.direction === 'asc' ? 'asc' : 'desc');
    this.page.set(1);
    this.reload();
  }

  constructor() {
    this.reload();
  }

  orderLabel(o: OrderListItemDto): string {
    const n = o.number ?? o.orderNumber;
    if (typeof n === 'string' && n.trim()) return n.trim();
    return o.id;
  }

  orderTotal(o: OrderListItemDto): number | null {
    const t = o.totalPayable;
    return typeof t === 'number' && !Number.isNaN(t) ? t : null;
  }

  addressLine(o: OrderListItemDto): string {
    const s = o.addressSummary?.trim();
    if (s) return s;
    return '—';
  }

  onFilterChange(): void {
    this.page.set(1);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.ordersApi
      .getAdminAll({
        page: this.page(),
        pageSize: this.pageSize,
        status: this.statusFilter().trim() || undefined,
        startDate: this.startDate().trim() || undefined,
        endDate: this.endDate().trim() || undefined,
        sortBy: this.sortBy(),
        sortDirection: this.sortDirection(),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.totalCount.set(res.totalCount);
          const tp = res.totalPages ?? Math.ceil(res.totalCount / Math.max(1, this.pageSize));
          this.totalPages.set(Math.max(1, tp));
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.snack.open(
            this.translate.instant('ADMIN.ORDERS_PAGE.LOAD_ERROR'),
            undefined,
            { duration: 4000 },
          );
          if (err.error?.message) console.error(err.error);
        },
      });
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.reload();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.reload();
  }

  canCancelOrder(row: OrderListItemDto): boolean {
    const s = row.status?.trim().toLowerCase();
    return s !== 'cancelled';
  }

  confirmCancelOrder(row: OrderListItemDto): void {
    if (!this.canCancelOrder(row)) return;
    const ref = this.dialog.open<AdminConfirmDeleteDialogComponent, AdminConfirmDeleteDialogData, boolean>(
      AdminConfirmDeleteDialogComponent,
      {
        width: 'min(440px, 100vw)',
        data: {
          titleKey: 'ADMIN.ORDERS_PAGE.CANCEL_ORDER_TITLE',
          messageKey: 'ADMIN.ORDERS_PAGE.CANCEL_ORDER_MSG',
          messageParams: { number: this.orderLabel(row) },
        },
      },
    );
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.cancellingOrderId.set(row.id);
      this.ordersApi.cancel(row.id).subscribe({
        next: () => {
          this.cancellingOrderId.set(null);
          this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.CANCELLED'), undefined, { duration: 3000 });
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          this.cancellingOrderId.set(null);
          this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.CANCEL_ERROR'), undefined, { duration: 4000 });
          if (err.error) console.error(err.error);
        },
      });
    });
  }
}
