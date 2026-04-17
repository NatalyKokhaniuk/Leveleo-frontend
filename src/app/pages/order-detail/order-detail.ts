import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, firstValueFrom, take } from 'rxjs';
import { AuthHandlerService } from '../../core/auth/services/auth-handler.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { DeliveryType } from '../../features/addresses/address.types';
import { OrderService } from '../../features/orders/order.service';
import { OrderAddressDto, OrderDetailDto, OrderItemDto } from '../../features/orders/order.types';

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
    TranslateModule,
  ],
  templateUrl: './order-detail.html',
})
export class OrderDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orders = inject(OrderService);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private authHandler = inject(AuthHandlerService);

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
      this.openLoginAndContinue();
      return;
    }

    this.fetchOrder(id);
  }

  /** Повторне відкриття модалки (кнопка на сторінці). */
  openLoginAgain(): void {
    this.loginCancelled.set(false);
    this.loadError.set(false);
    this.openLoginAndContinue();
  }

  private openLoginAndContinue(): void {
    this.authHandler.openLoginDialog$().subscribe((result) => {
      if (result === true) {
        this.fetchOrder(this.orderId);
      } else {
        this.loginCancelled.set(true);
      }
    });
  }

  private fetchOrder(id: string): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.loginCancelled.set(false);

    this.orders.getById(id).subscribe({
      next: (o) => {
        if (!this.canViewOrder(o)) {
          this.loading.set(false);
          void this.router.navigate(['/']);
          return;
        }
        this.order.set(o);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) {
          if (!this.auth.isAuthenticated()) {
            this.openLoginAndContinue();
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

  /** Лише власник замовлення (userId збігається з поточним акаунтом). */
  private canViewOrder(o: OrderDetailDto): boolean {
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
}
