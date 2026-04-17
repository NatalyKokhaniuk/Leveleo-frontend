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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DeliveryType } from '../../../../../features/addresses/address.types';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { OrderService } from '../../../../../features/orders/order.service';
import { OrderAddressDto, OrderDetailDto, OrderItemDto } from '../../../../../features/orders/order.types';

@Component({
  selector: 'app-admin-order-detail',
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
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './order-detail.html',
})
export class AdminOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ordersApi = inject(OrderService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  loading = signal(true);
  notFound = signal(false);
  order = signal<OrderDetailDto | null>(null);

  saving = signal(false);
  cancelling = signal(false);

  statusForm = this.fb.group({
    status: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('orderId')?.trim();
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.ordersApi.getById(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.statusForm.patchValue({ status: o.status ?? '' });
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  displayNumber(o: OrderDetailDto): string {
    const n = o.number ?? o.orderNumber;
    if (typeof n === 'string' && n.trim()) return n.trim();
    return o.id;
  }

  orderTotal(o: OrderDetailDto): number | null {
    const t = o.totalPayable ?? o.totalAmount ?? o.total;
    return typeof t === 'number' && !Number.isNaN(t) ? t : null;
  }

  recipientFullName(a: OrderAddressDto): string {
    return [a.lastName, a.firstName, a.middleName].filter((x) => x?.trim()).join(' ');
  }

  deliveryTypeLabel(dt: string | number | undefined | null): string {
    if (dt === undefined || dt === null || dt === '') return '—';
    const raw = String(dt).trim();
    if (/^-?\d+$/.test(raw)) {
      const n = Number(raw);
      if (n === DeliveryType.Warehouse) {
        return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_WAREHOUSE');
      }
      if (n === DeliveryType.Doors) {
        return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_COURIER');
      }
      if (n === DeliveryType.Postomat) {
        return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_POSTOMAT');
      }
    }
    const lower = raw.toLowerCase();
    if (lower === 'warehouse') return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_WAREHOUSE');
    if (lower === 'doors') return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_COURIER');
    if (lower === 'postomat') return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_POSTOMAT');
    return raw;
  }

  lineUnitPrice(item: OrderItemDto): number {
    const d = item.discountedUnitPrice;
    if (typeof d === 'number' && !Number.isNaN(d)) return d;
    return item.unitPrice;
  }

  lineTotal(item: OrderItemDto): number {
    const d = item.totalDiscountedPrice;
    if (typeof d === 'number' && !Number.isNaN(d)) return d;
    return item.quantity * this.lineUnitPrice(item);
  }

  saveStatus(): void {
    const o = this.order();
    if (!o) return;
    const status = this.statusForm.value.status?.trim();
    if (!status) {
      this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.STATUS_EMPTY'), undefined, { duration: 3000 });
      return;
    }
    this.saving.set(true);
    this.ordersApi.update(o.id, { status }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.statusForm.patchValue({ status: updated.status ?? '' });
        this.saving.set(false);
        this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.SAVED'), undefined, { duration: 2500 });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.SAVE_ERROR'), undefined, { duration: 4000 });
        if (err.error) console.error(err.error);
      },
    });
  }

  confirmCancelOrder(): void {
    const o = this.order();
    if (!o) return;
    const ref = this.dialog.open<AdminConfirmDeleteDialogComponent, AdminConfirmDeleteDialogData, boolean>(
      AdminConfirmDeleteDialogComponent,
      {
        width: 'min(440px, 100vw)',
        data: {
          titleKey: 'ADMIN.ORDERS_PAGE.CANCEL_ORDER_TITLE',
          messageKey: 'ADMIN.ORDERS_PAGE.CANCEL_ORDER_MSG',
          messageParams: { number: this.displayNumber(o) },
        },
      },
    );
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.cancelling.set(true);
      this.ordersApi.cancel(o.id).subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.statusForm.patchValue({ status: updated.status ?? '' });
          this.cancelling.set(false);
          this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.CANCELLED'), undefined, { duration: 3000 });
        },
        error: () => {
          this.cancelling.set(false);
          this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.CANCEL_ERROR'), undefined, { duration: 4000 });
        },
      });
    });
  }
}
