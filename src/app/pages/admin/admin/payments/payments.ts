import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import {
  AdminPaymentSortBy,
  PAYMENT_STATUS_VALUES,
  PaymentListItemDto,
  PaymentResponseDto,
} from '../../../../features/payments/payment.types';
import { PaymentService } from '../../../../features/payments/payment.service';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './payments.html',
})
export class AdminPaymentsComponent implements OnInit {
  private router = inject(Router);
  private paymentsApi = inject(PaymentService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  readonly paymentStatuses = PAYMENT_STATUS_VALUES;

  refundForm = this.fb.group({
    amount: [''],
    reason: [''],
  });

  listLoading = signal(true);
  listItems = signal<PaymentListItemDto[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  page = signal(1);
  readonly pageSize = 20;
  statusFilter = signal('');
  startDate = signal('');
  endDate = signal('');
  sortBy = signal<AdminPaymentSortBy>('CreatedAt');
  sortDirection = signal<'asc' | 'desc'>('desc');

  private readonly paymentSortMatIds: Record<AdminPaymentSortBy, string> = {
    CreatedAt: 'createdAt',
    Amount: 'amount',
    Status: 'status',
    ExpireAt: 'expireAt',
  };

  private readonly paymentMatIdToSort: Record<string, AdminPaymentSortBy> = {
    createdAt: 'CreatedAt',
    amount: 'Amount',
    status: 'Status',
    expireAt: 'ExpireAt',
  };

  private static readonly paymentSortOptions: AdminPaymentSortBy[] = [
    'CreatedAt',
    'Amount',
    'Status',
    'ExpireAt',
  ];

  detailLoading = signal(false);
  payment = signal<PaymentResponseDto | null>(null);

  actionLoading = signal(false);
  cancellingPaymentId = signal<string | null>(null);

  displayedColumns: string[] = [
    'status',
    'amount',
    'orderNumber',
    'orderId',
    'createdAt',
    'expireAt',
    'actions',
  ];

  ngOnInit(): void {
    this.reloadList();
  }

  paymentMatSortActive(): string {
    return this.paymentSortMatIds[this.sortBy()] ?? 'createdAt';
  }

  onPaymentTableSort(sort: Sort): void {
    if (!sort.direction) {
      this.sortBy.set('CreatedAt');
      this.sortDirection.set('desc');
      this.page.set(1);
      this.reloadList();
      return;
    }
    const key = this.paymentMatIdToSort[sort.active];
    if (!key) return;
    this.sortBy.set(key);
    this.sortDirection.set(sort.direction === 'asc' ? 'asc' : 'desc');
    this.page.set(1);
    this.reloadList();
  }

  onPaymentSortBySelect(value: string): void {
    if (!AdminPaymentsComponent.paymentSortOptions.includes(value as AdminPaymentSortBy)) return;
    this.sortBy.set(value as AdminPaymentSortBy);
    this.onFilterChange();
  }

  onPaymentSortDirSelect(value: string): void {
    if (value !== 'asc' && value !== 'desc') return;
    this.sortDirection.set(value);
    this.onFilterChange();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.reloadList();
  }

  reloadList(): void {
    this.listLoading.set(true);
    this.paymentsApi
      .getPaged({
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
          this.listItems.set(res.items);
          this.totalCount.set(res.totalCount);
          const tp = res.totalPages ?? Math.ceil(res.totalCount / Math.max(1, this.pageSize));
          this.totalPages.set(Math.max(1, tp));
          this.listLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.listLoading.set(false);
          this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.LIST_LOAD_ERROR'), undefined, {
            duration: 4000,
          });
          if (err.error) console.error(err.error);
        },
      });
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.reloadList();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.reloadList();
  }

  selectRow(row: PaymentListItemDto): void {
    this.selectPaymentById(row.id);
  }

  private selectPaymentById(id: string): void {
    this.detailLoading.set(true);
    this.payment.set(null);
    this.paymentsApi.getById(id).subscribe({
      next: (p) => {
        this.payment.set(p);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.LOAD_ERROR'), undefined, { duration: 4000 });
      },
    });
  }

  goOrder(): void {
    const oid = this.payment()?.orderId;
    if (oid) void this.router.navigate(['/admin/orders', oid]);
  }

  canCancelPaymentRow(row: PaymentListItemDto): boolean {
    return row.status !== 'Failure';
  }

  confirmCancelPaymentRow(row: PaymentListItemDto): void {
    if (!this.canCancelPaymentRow(row)) return;
    this.runPaymentCancelFlow(row.id, false);
  }

  confirmCancel(): void {
    const p = this.payment();
    if (!p || p.status === 'Failure') return;
    this.runPaymentCancelFlow(p.id, true);
  }

  private runPaymentCancelFlow(paymentId: string, fromDetail: boolean): void {
    const ref = this.dialog.open<AdminConfirmDeleteDialogComponent, AdminConfirmDeleteDialogData, boolean>(
      AdminConfirmDeleteDialogComponent,
      {
        width: 'min(440px, 100vw)',
        data: {
          titleKey: 'ADMIN.PAYMENTS_PAGE.CANCEL_TITLE',
          messageKey: 'ADMIN.PAYMENTS_PAGE.CANCEL_MSG',
        },
      },
    );
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      if (fromDetail) this.actionLoading.set(true);
      else this.cancellingPaymentId.set(paymentId);
      this.paymentsApi.cancel(paymentId).subscribe({
        next: (updated) => {
          if (fromDetail) this.actionLoading.set(false);
          else this.cancellingPaymentId.set(null);
          if (this.payment()?.id === updated.id) this.payment.set(updated);
          this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.CANCEL_OK'), undefined, { duration: 3000 });
          this.reloadList();
        },
        error: (err: HttpErrorResponse) => {
          if (fromDetail) this.actionLoading.set(false);
          else this.cancellingPaymentId.set(null);
          this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.CANCEL_FAIL'), undefined, { duration: 4000 });
          if (err.error) console.error(err.error);
        },
      });
    });
  }

  submitRefund(): void {
    const p = this.payment();
    if (!p || p.status === 'Failure') return;
    const raw = this.refundForm.value.amount?.trim();
    let amount: number | undefined;
    if (raw) {
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) {
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.REFUND_AMOUNT_INVALID'), undefined, {
          duration: 4000,
        });
        return;
      }
      amount = n;
    }
    const reason = this.refundForm.value.reason?.trim() || undefined;
    this.actionLoading.set(true);
    this.paymentsApi.refund(p.id, { amount, reason }).subscribe({
      next: (updated) => {
        this.payment.set(updated);
        this.refundForm.reset();
        this.actionLoading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.REFUND_OK'), undefined, { duration: 3000 });
        this.reloadList();
      },
      error: (err: HttpErrorResponse) => {
        this.actionLoading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.REFUND_FAIL'), undefined, { duration: 4000 });
        if (err.error) console.error(err.error);
      },
    });
  }
}
