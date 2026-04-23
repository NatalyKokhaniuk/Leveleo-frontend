import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, catchError, filter, firstValueFrom, forkJoin, map, of, take } from 'rxjs';
import { AuthService } from '../../core/auth/services/auth.service';
import { DeliveryType } from '../../features/addresses/address.types';
import { OrderService } from '../../features/orders/order.service';
import { OrderAddressDto, OrderDetailDto, OrderItemDto } from '../../features/orders/order.types';
import { ReviewService } from '../../features/reviews/review.service';
import { ReviewDto } from '../../features/reviews/review.types';
import { OrderStatusLabelPipe } from '../../shared/pipes/order-status-label.pipe';
import { PaymentStatusLabelPipe } from '../../shared/pipes/payment-status-label.pipe';
import {
  OrderItemReviewDialogComponent,
  OrderItemReviewDialogData,
} from './order-item-review-dialog/order-item-review-dialog.component';

export type OrderItemReviewUi =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'has'; review: ReviewDto }
  | { kind: 'unavailable' };

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
    OrderStatusLabelPipe,
    PaymentStatusLabelPipe,
  ],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orders = inject(OrderService);
  private translate = inject(TranslateService);
  readonly auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private reviews = inject(ReviewService);

  /** Стан відгуку по orderItemId для кнопок «Залишити / Показати відгук». */
  itemReviewUi = signal<Record<string, OrderItemReviewUi>>({});

  /** Очікування входу через шапку (без модального вікна). */
  private authWaitSub: Subscription | null = null;
  private isAuthenticated$ = toObservable(this.auth.isAuthenticated);
  loading = signal(true);
  loadError = signal(false);
  missingId = signal(false);
  order = signal<OrderDetailDto | null>(null);

  /** Користувач закрив вікно входу без успішного логіну. */
  loginCancelled = signal(false);

  /** Маршрут `/order-success` — показуємо банер про успішну оплату. */
  successMode = signal(false);

  private orderId = '';

  orderLabel = computed(() => {
    const o = this.order();
    if (!o) return '';
    return this.displayOrderNumber(o);
  });

  async ngOnInit(): Promise<void> {
    await firstValueFrom(this.auth.isRestoring$.pipe(filter((v) => !v), take(1)));

    const path = this.route.snapshot.routeConfig?.path;
    this.successMode.set(path === 'order-success');

    const id =
      this.route.snapshot.paramMap.get('orderId')?.trim() ||
      this.route.snapshot.queryParamMap.get('orderId')?.trim() ||
      '';

    if (!id) {
      this.missingId.set(true);
      this.loading.set(false);
      this.loadError.set(true);
      return;
    }

    this.orderId = id;

    if (!this.auth.isAuthenticated()) {
      this.loading.set(false);
      this.waitForAuthThenLoadOrder();
      return;
    }

    this.fetchOrder(id);
  }

  /** Показати знову підказку про вхід (як у кошику). */
  openLoginAgain(): void {
    this.loginCancelled.set(false);
    this.loadError.set(false);
    this.waitForAuthThenLoadOrder();
  }

  /** Закрити підказку без входу (залишається текст «пізніше»). */
  dismissGuestOrderHint(): void {
    this.authWaitSub?.unsubscribe();
    this.authWaitSub = null;
    this.loginCancelled.set(true);
  }

  ngOnDestroy(): void {
    this.authWaitSub?.unsubscribe();
  }

  private waitForAuthThenLoadOrder(): void {
    this.authWaitSub?.unsubscribe();
  this.authWaitSub = this.isAuthenticated$  // ✅ використовуємо готовий Observable
    .pipe(filter((v) => v), take(1))
    .subscribe(() => {
      this.fetchOrder(this.orderId);
    });
  }

  private fetchOrder(id: string): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.loginCancelled.set(false);

    this.orders.getDetail(id).subscribe({
      next: (o) => {
        if (!this.canViewOrder(o)) {
          this.loading.set(false);
          void this.router.navigate(['/']);
          return;
        }
        this.order.set(o);
        this.loading.set(false);
        this.loadOrderItemReviewStates(o);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) {
          if (!this.auth.isAuthenticated()) {
            this.order.set(null);
            this.waitForAuthThenLoadOrder();
            return;
          }
          this.loadError.set(true);
          return;
        }
        if (err.status === 403) {
          void this.router.navigate(['/']);
          return;
        }
        this.loadError.set(true);
      },
    });
  }

  /** Власник замовлення або Admin/Moderator (як на API GET /api/Orders/...). */
  private canViewOrder(o: OrderDetailDto): boolean {
    if (this.auth.isAdmin() || this.auth.isModerator()) return true;
    const me = this.auth.currentUser()?.id;
    const owner = o.userId;
    if (!me || !owner) return true;
    return me.trim().toLowerCase() === String(owner).trim().toLowerCase();
  }

  displayOrderNumber(o: OrderDetailDto): string {
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
    const lower = raw.toLowerCase();

    let kind: DeliveryType | null = null;
    if (/^-?\d+$/.test(raw)) {
      const n = Number(raw);
      if (n === DeliveryType.Warehouse) kind = DeliveryType.Warehouse;
      else if (n === DeliveryType.Doors) kind = DeliveryType.Doors;
      else if (n === DeliveryType.Postomat) kind = DeliveryType.Postomat;
    } else {
      if (lower === 'warehouse') kind = DeliveryType.Warehouse;
      else if (lower === 'doors') kind = DeliveryType.Doors;
      else if (lower === 'postomat') kind = DeliveryType.Postomat;
    }

    if (kind === DeliveryType.Warehouse) {
      return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_WAREHOUSE');
    }
    if (kind === DeliveryType.Doors) {
      return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_COURIER');
    }
    if (kind === DeliveryType.Postomat) {
      return this.translate.instant('ORDER_CHECKOUT.DELIVERY_NP_POSTOMAT');
    }
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

  trackingUrl(trackingNumber: string): string {
    return `https://novaposhta.ua/tracking/${encodeURIComponent(trackingNumber.trim())}`;
  }

  /** Відгук по рядку замовлення — після відправлення або завершення. */
  orderEligibleForItemReview(o: OrderDetailDto): boolean {
    const s = (o.status ?? '').trim().toLowerCase();
    return s === 'shipped' || s === 'completed';
  }

  reviewButtonState(orderItemId: string): 'loading' | 'leave' | 'show' | 'unavailable' {
    const ui = this.itemReviewUi()[orderItemId];
    if (!ui || ui.kind === 'loading') return 'loading';
    if (ui.kind === 'none') return 'leave';
    if (ui.kind === 'has') return 'show';
    return 'unavailable';
  }

  openOrderItemReview(productId: string, orderItemId: string): void {
    const ref = this.dialog.open<OrderItemReviewDialogComponent, OrderItemReviewDialogData>(
      OrderItemReviewDialogComponent,
      {
        panelClass: ['auth-dialog', 'product-quick-view-panel'],
        width: 'min(96vw - 24px, 1040px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'min(88vh, 820px)',
        maxHeight: 'min(88vh, calc(100vh - 24px))',
        data: { productId, orderItemId },
      },
    );
    ref.afterClosed().subscribe((result: { saved?: boolean } | undefined) => {
      if (result?.saved) {
        this.refreshOrderItemReview(orderItemId);
      }
    });
  }

  private loadOrderItemReviewStates(o: OrderDetailDto): void {
    if (!this.auth.isAuthenticated() || !this.orderEligibleForItemReview(o)) {
      this.itemReviewUi.set({});
      return;
    }
    const items = o.orderItems ?? [];
    if (!items.length) {
      this.itemReviewUi.set({});
      return;
    }
    const loading: Record<string, OrderItemReviewUi> = {};
    for (const it of items) {
      loading[it.id] = { kind: 'loading' };
    }
    this.itemReviewUi.set(loading);

    forkJoin(
      items.map((item) =>
        this.reviews.getByOrderItem(item.id).pipe(
          map((rev): { id: string; ui: OrderItemReviewUi } => ({
            id: item.id,
            ui: rev ? { kind: 'has', review: rev } : { kind: 'none' },
          })),
          catchError((err: HttpErrorResponse) =>
            of({
              id: item.id,
              ui: { kind: err.status === 403 ? 'unavailable' : 'none' } satisfies OrderItemReviewUi,
            }),
          ),
        ),
      ),
    ).subscribe((rows) => {
      const next: Record<string, OrderItemReviewUi> = {};
      for (const r of rows) next[r.id] = r.ui;
      this.itemReviewUi.set(next);
    });
  }

  private refreshOrderItemReview(orderItemId: string): void {
    this.reviews.getByOrderItem(orderItemId).subscribe({
      next: (rev) => {
        this.itemReviewUi.update((cur) => ({
          ...cur,
          [orderItemId]: rev ? { kind: 'has', review: rev } : { kind: 'none' },
        }));
      },
      error: (err: HttpErrorResponse) => {
        this.itemReviewUi.update((cur) => ({
          ...cur,
          [orderItemId]: { kind: err.status === 403 ? 'unavailable' : 'none' },
        }));
      },
    });
  }
}
