import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrderService } from '../../../../features/orders/order.service';
import { OrderSummaryDto } from '../../../../features/orders/order.types';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

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
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './orders.html',
})
export class AdminOrdersComponent {
  private ordersApi = inject(OrderService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  loading = signal(true);
  items = signal<OrderSummaryDto[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);

  page = signal(1);
  readonly pageSize = 20;

  statusFilter = signal('');
  orderNumberFilter = signal('');
  startDate = signal('');
  endDate = signal('');
  sortBy = signal<'CreatedAt' | 'TotalPayable' | 'Status'>('CreatedAt');
  sortDirection = signal<'asc' | 'desc'>('desc');

  displayedColumns: string[] = ['number', 'createdAt', 'status', 'total', 'userId', 'actions'];

  constructor() {
    this.reload();
  }

  orderLabel(o: OrderSummaryDto): string {
    const n = o.number ?? o.orderNumber;
    if (typeof n === 'string' && n.trim()) return n.trim();
    return o.id;
  }

  orderTotal(o: OrderSummaryDto): number | null {
    const t = o.totalPayable ?? o.totalAmount ?? o.total;
    return typeof t === 'number' && !Number.isNaN(t) ? t : null;
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
        orderNumber: this.orderNumberFilter().trim() || undefined,
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
}
