import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of, switchMap } from 'rxjs';
import { DeliveryType } from '../../../../../features/addresses/address.types';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { UserResponse } from '../../../../../core/auth/models/auth.types';
import { UserService } from '../../../../../features/users/user.service';
import { AdminTaskService } from '../../../../../features/admin-tasks/admin-task.service';
import { DeliveryService } from '../../../../../features/orders/delivery.service';
import { OrderService } from '../../../../../features/orders/order.service';
import {
  isArchivedFromSaleState,
  isMissingFromDatabaseState,
  orderLineCatalogHintKey,
  resolveOrderLineCatalogState,
} from '../../../../../features/products/product-catalog-display';
import {
  ORDER_STATUS_VALUES,
  OrderStatus,
  OrderAddressDto,
  OrderDetailDto,
  OrderItemDto,
  OrderUpdateDto,
} from '../../../../../features/orders/order.types';
import { OrderStatusLabelPipe } from '../../../../../shared/pipes/order-status-label.pipe';
import { PaymentStatusLabelPipe } from '../../../../../shared/pipes/payment-status-label.pipe';

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
    MatSelectModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    OrderStatusLabelPipe,
    PaymentStatusLabelPipe,
  ],
  templateUrl: './order-detail.html',
})
export class AdminOrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ordersApi = inject(OrderService);
  private usersApi = inject(UserService);
  private adminTasksApi = inject(AdminTaskService);
  private deliveryApi = inject(DeliveryService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  readonly orderStatuses = ORDER_STATUS_VALUES;

  loading = signal(true);
  notFound = signal(false);
  order = signal<OrderDetailDto | null>(null);

  saving = signal(false);
  cancelling = signal(false);
  shipping = signal(false);

  /** GET /api/users/{userId} після завантаження замовлення (Admin/Moderator). */
  customerProfile = signal<UserResponse | null>(null);

  statusForm = this.fb.group({
    status: ['', Validators.required],
  });
  shipmentForm = this.fb.group({
    trackingNumber: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('orderId')?.trim();
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.ordersApi.getDetail(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.statusForm.patchValue({
          status: o.status ?? '',
        });
        this.loadCustomerProfile(o.userId);
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

  /** ПІБ з профілю (GET /users/{id}); якщо профіль недоступний — з адреси доставки; інакше userId. */
  customerDisplayName(o: OrderDetailDto): string {
    const p = this.customerProfile();
    if (p) {
      const parts = [p.lastName, p.firstName].map((x) => x?.trim()).filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
    if (o.address) {
      const fromAddr = this.recipientFullName(o.address).trim();
      if (fromAddr) return fromAddr;
    }
    return o.userId?.trim() || '—';
  }

  private loadCustomerProfile(userId: string | null | undefined): void {
    this.customerProfile.set(null);
    const id = userId?.trim();
    if (!id) return;
    this.usersApi.getUserById(id).subscribe({
      next: (u) => this.customerProfile.set(u),
      error: () => this.customerProfile.set(null),
    });
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

  lineProductTitle(item: OrderItemDto): string {
    const n = item.productSnapshot?.name?.trim();
    return n || item.productName;
  }

  lineCatalogHintKey(item: OrderItemDto): string | null {
    return orderLineCatalogHintKey(resolveOrderLineCatalogState(item.productSnapshot));
  }

  lineProductPublicLinkSegments(item: OrderItemDto): string[] | null {
    const st = resolveOrderLineCatalogState(item.productSnapshot);
    if (isMissingFromDatabaseState(st) || isArchivedFromSaleState(st)) return null;
    const slug = item.productSnapshot?.slug?.trim();
    if (!slug) return null;
    return ['/products', slug];
  }

  /** Для архівних/існуючих рядків — адмін-товар за id рядка. */
  lineProductAdminLinkSegments(item: OrderItemDto): string[] | null {
    if (isMissingFromDatabaseState(resolveOrderLineCatalogState(item.productSnapshot))) {
      return null;
    }
    const id = item.productSnapshot?.id?.trim() || item.productId?.trim();
    if (!id) return null;
    return ['/admin/products', id];
  }

  saveStatus(): void {
    const o = this.order();
    if (!o || this.statusForm.invalid) return;
    const status = this.statusForm.value.status?.trim();
    if (!status) {
      this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.STATUS_EMPTY'), undefined, { duration: 3000 });
      return;
    }
    const dto: OrderUpdateDto = { status };
    this.saving.set(true);
    this.ordersApi.update(o.id, dto).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.statusForm.patchValue({
          status: updated.status ?? '',
        });
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

  statusInList(status: string | null | undefined): boolean {
    if (!status) return false;
    return ORDER_STATUS_VALUES.includes(status as OrderStatus);
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
          this.statusForm.patchValue({
            status: updated.status ?? '',
          });
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

  sendOrder(): void {
    const o = this.order();
    if (!o) return;
    const trackingNumber = this.shipmentForm.value.trackingNumber?.trim();
    if (!trackingNumber) {
      this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.SHIP_TRACKING_REQUIRED'), undefined, { duration: 3500 });
      return;
    }
    this.shipping.set(true);
    this.deliveryApi
      .createManualForOrder(o.id, trackingNumber)
      .pipe(
        switchMap(() =>
          this.adminTasksApi.findOpenShipOrderTask(o.id).pipe(
            switchMap((task) => {
              if (!task) return of(null);
              const shippedNote = `${this.translate.instant('ADMIN.TASKS_PAGE.SHIPPED_NOTE_PREFIX')}${trackingNumber}`;
              if (task.status === 'Pending') {
                return this.adminTasksApi.assignToMe(task.id).pipe(
                  switchMap((assigned) => this.adminTasksApi.complete(assigned.id, { completionNote: shippedNote })),
                  catchError(() => of(null)),
                );
              }
              if (task.status === 'InProgress') {
                return this.adminTasksApi.complete(task.id, { completionNote: shippedNote }).pipe(catchError(() => of(null)));
              }
              return of(null);
            }),
          ),
        ),
        switchMap(() => this.ordersApi.getDetail(o.id)),
      )
      .subscribe({
        next: (updatedOrder) => {
          this.order.set(updatedOrder);
          this.statusForm.patchValue({ status: updatedOrder.status ?? '' });
          this.shipmentForm.patchValue({ trackingNumber: '' });
          this.shipping.set(false);
          this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.SHIP_OK'), undefined, { duration: 3500 });
        },
        error: () => {
          this.shipping.set(false);
          this.snack.open(this.translate.instant('ADMIN.ORDERS_PAGE.SHIP_ERROR'), undefined, { duration: 4500 });
        },
      });
  }
}
