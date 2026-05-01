import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { AuthService } from '../../core/auth/services/auth.service';
import { DefaultAddressPreferenceService } from '../../core/services/default-address-preference.service';
import { AddressService } from '../../features/addresses/address.service';
import { SelectAddressDialogComponent } from '../../features/addresses/select-address-dialog/select-address-dialog.component';
import { AddressResponseDto, DeliveryType } from '../../features/addresses/address.types';
import { extractLiqPayCheckoutParams, submitLiqPayCheckoutForm } from '../../features/orders/liqpay-checkout.util';
import { CreateOrderResultDto } from '../../features/orders/order.types';
import { OrderService } from '../../features/orders/order.service';
import { computePricingFromCartItems } from '../../features/shopping-cart/cart-pricing.util';
import { ShoppingCartService } from '../../features/shopping-cart/shopping-cart.service';
import { ShoppingCartDto } from '../../features/shopping-cart/shopping-cart.types';

@Component({
  selector: 'app-order-checkout',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    ReactiveFormsModule,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  templateUrl: './order-checkout.html',
  styleUrl: './order-checkout.scss',
})
export class OrderCheckoutPage implements OnInit {
  private auth = inject(AuthService);
  private cartApi = inject(ShoppingCartService);
  private orders = inject(OrderService);
  private addressApi = inject(AddressService);
  private addressPreference = inject(DefaultAddressPreferenceService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);

  readonly DeliveryType = DeliveryType;

  loading = signal(true);
  loadError = signal(false);
  cartEmpty = signal(false);
  /** Є рядки з quantity > 0 (після оплати або стоку рядки можуть лишатись із сумаю 0). */
  cartHasQuantityLines = signal(false);
  /** Кінцева сума після усіх знижок (як у кошику). */
  totalPayable = signal(0);

  /** Згорнути блок контактів. */
  contactCollapsed = signal(false);

  selectedAddress = signal<AddressResponseDto | null>(null);
  deliveryType = signal<DeliveryType | null>(null);
  placingOrder = signal(false);
  /** Last order API error message (shown under Purchase; cleared on a new attempt). */
  orderPlacementError = signal<string | null>(null);

  private static readonly emptyOrderId = '00000000-0000-0000-0000-000000000000';
  /**
   * Текст `message` з бекенду в catch OrderService.CreateOrderFromCartAsync (транзакція відкочена).
   * Контролер віддає 409 Conflict з `shoppingCart` у тілі — це не успіх і не обов’язково «зміна кошика»:
   * при нормальному кошику в тілі це внутрішня помилка (LiqPay, резерв стоку, БД тощо).
   */
  private static readonly backendOrderCreationFailed = 'Order creation has failed';

  /** Invalidates contact summary computeds when form values change (forms are not signals). */
  private contactFormRevision = signal(0);

  contactForm = this.fb.nonNullable.group({
    phoneNumber: ['', [Validators.required, Validators.minLength(5)]],
    lastName: ['', Validators.required],
    firstName: ['', Validators.required],
    middleName: [''],
  });

  recipientSummary = computed(() => {
    this.contactFormRevision();
    const v = this.contactForm.getRawValue();
    const parts = [v.lastName?.trim(), v.firstName?.trim(), v.middleName?.trim()].filter(Boolean);
    return parts.length ? parts.join(' ') : '—';
  });
  contactPhoneSummary = computed(() => {
    this.contactFormRevision();
    const phone = this.contactForm.getRawValue().phoneNumber?.trim();
    return phone || '—';
  });

  /** Адреса доставки для блоку «Отримувач». */
  recipientAddressDisplay = computed(() => {
    const addr = this.selectedAddress();
    if (!addr) return null;
    const city = addr.cityName?.trim() ?? '';
    const detail =
      addr.formattedAddress?.trim() ||
      addr.warehouseDescription?.trim() ||
      addr.postomatDescription?.trim() ||
      [addr.street, addr.house, addr.flat].filter(Boolean).join(', ') ||
      '';
    if (city && detail) return `${city}, ${detail}`;
    return city || detail || null;
  });

  canPurchase = computed(() => {
    if (this.loading() || this.loadError() || this.cartEmpty()) return false;
    if (this.totalPayable() <= 0.0001) return false;
    if (!this.contactForm.valid) return false;
    if (!this.selectedAddress()) return false;
    if (this.deliveryType() === null) return false;
    return true;
  });

  /** Рядки в кошику є, але нічого не оплачується (усі недоступні). */
  checkoutZeroPayableWithLines = computed(() => {
    return (
      !this.loading() &&
      !this.loadError() &&
      !this.cartEmpty() &&
      this.cartHasQuantityLines() &&
      this.totalPayable() <= 0.0001
    );
  });

  ngOnInit(): void {
    const u = this.auth.currentUser();
    if (u) {
      this.contactForm.patchValue({
        phoneNumber: u.phoneNumber?.trim() ?? '',
        lastName: u.lastName?.trim() ?? '',
        firstName: u.firstName?.trim() ?? '',
      });
    }
    this.contactForm.valueChanges
      .pipe(startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.contactFormRevision.update((n) => n + 1));
    this.loadCart();
  }

  private loadCart(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.cartApi
      .getMyCart()
      .pipe(catchError(() => of(null)))
      .subscribe((cart) => {
        this.loading.set(false);
        if (!cart) {
          this.loadError.set(true);
          return;
        }
        const payable = this.resolveTotalPayable(cart);
        this.totalPayable.set(payable);
        const hasQty = (cart.items ?? []).some((it) => (Number(it.quantity) || 0) > 0);
        this.cartHasQuantityLines.set(hasQty);
        this.cartEmpty.set(!hasQty);
      });
  }

  private resolveTotalPayable(cart: ShoppingCartDto): number {
    const fromItems = computePricingFromCartItems(cart.items);
    const apiCartDisc = cart.totalCartDiscount;
    const apiPayable = cart.totalPayable;

    let totalCartDiscount = fromItems.totalCartDiscountFromLines;
    if (apiCartDisc != null && Number.isFinite(Number(apiCartDisc)) && Number(apiCartDisc) >= 0) {
      totalCartDiscount = Number(apiCartDisc);
    }

    let totalPayable = Math.max(0, fromItems.subtotalAfterProductPromotions - totalCartDiscount);
    if (apiPayable != null && Number.isFinite(Number(apiPayable))) {
      totalPayable = Number(apiPayable);
    }
    return totalPayable;
  }

  toggleContactCollapsed(): void {
    this.contactCollapsed.update((c) => !c);
  }

  openAddressPicker(): void {
    const dt = this.deliveryType();
    if (dt === null) {
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.SELECT_DELIVERY_FIRST'), 'OK', {
        duration: 3000,
      });
      return;
    }
    const v = this.contactForm.getRawValue();
    const ref = this.dialog.open(SelectAddressDialogComponent, {
      width: 'min(96vw - 24px, 520px)',
      maxWidth: '100vw',
      autoFocus: false,
      data: {
        selectedId: this.selectedAddress()?.id ?? null,
        preferredDefaultId: this.addressPreference.getPreferredId(),
        addressFieldsOnly: true,
        fixedDeliveryType: dt,
        recipientFromCheckout: {
          firstName: v.firstName ?? '',
          lastName: v.lastName ?? '',
          middleName: v.middleName ?? '',
          phoneNumber: v.phoneNumber ?? '',
        },
      },
    });
    ref.afterClosed().subscribe((addr) => {
      if (addr) {
        this.selectedAddress.set(addr);
        this.applyMiddleNameFromAddress(addr);
      }
    });
  }

  onDeliveryChange(e: MatRadioChange): void {
    const next = e.value as DeliveryType;
    const addr = this.selectedAddress();
    if (addr && addr.deliveryType !== next) {
      this.selectedAddress.set(null);
    }
    this.deliveryType.set(next);
    const current = this.selectedAddress();
    if (current && current.deliveryType === next) {
      return;
    }
    this.applyPreferredAddressForDelivery(next);
  }

  /** Підставити збережену «основну» адресу, якщо вона підходить під обраний тип доставки. */
  private applyPreferredAddressForDelivery(dt: DeliveryType): void {
    const pref = this.addressPreference.getPreferredId();
    if (!pref) {
      return;
    }
    this.addressApi.getById(pref).subscribe({
      next: (loaded) => {
        if (loaded.deliveryType === dt) {
          this.selectedAddress.set(loaded);
          this.applyMiddleNameFromAddress(loaded);
        }
      },
      error: () => this.addressPreference.clearPreferred(),
    });
  }

  /** Повний номер телефону для відображення (без маскування). */
  recipientPhoneDisplay(): string {
    const raw = this.contactForm.get('phoneNumber')?.value?.trim() ?? '';
    return raw.length > 0 ? raw : '—';
  }

  scrollToContact(): void {
    const el = document.getElementById('order-checkout-contact');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  goToPayment(): void {
    if (this.placingOrder()) {
      return;
    }
    const missing = this.collectMissingCheckoutFields();
    if (missing.length > 0) {
      this.contactForm.markAllAsTouched();
      this.snack.open(
        this.translate.instant('ORDER_CHECKOUT.FILL_REQUIRED_LIST', { fields: missing.join(', ') }),
        'OK',
        { duration: 5200 },
      );
      return;
    }
    this.orderPlacementError.set(null);
    const addr = this.selectedAddress();
    if (!addr?.id) return;

    this.placingOrder.set(true);
    this.cartApi.getMyCart().subscribe({
      next: (cart) => {
        const hasConflict = this.isCartStructuralChange(cart);
        if (hasConflict) {
          this.placingOrder.set(false);
          this.snack.open(this.translate.instant('CART.CART_CHANGED'), 'OK', { duration: 4500 });
          this.router.navigateByUrl('/cart');
          return;
        }
        this.orders.create({ userAddressId: addr.id }).subscribe({
          next: (res) => {
            this.placingOrder.set(false);
            this.handleOrderCreateSuccess(res);
          },
          error: (err: HttpErrorResponse) => {
            this.placingOrder.set(false);
            this.handleOrderCreateError(err);
          },
        });
      },
      error: () => {
        this.placingOrder.set(false);
        this.snack.open(this.translate.instant('CART.LOAD_ERROR'), 'OK', { duration: 3500 });
      },
    });
  }

  private collectMissingCheckoutFields(): string[] {
    const missing: string[] = [];
    const v = this.contactForm.getRawValue();
    if (!String(v.phoneNumber ?? '').trim()) {
      missing.push(this.translate.instant('ORDER_CHECKOUT.MISSING_PHONE'));
    }
    if (!String(v.lastName ?? '').trim()) {
      missing.push(this.translate.instant('ORDER_CHECKOUT.MISSING_LAST_NAME'));
    }
    if (!String(v.firstName ?? '').trim()) {
      missing.push(this.translate.instant('ORDER_CHECKOUT.MISSING_FIRST_NAME'));
    }
    if (this.deliveryType() === null) {
      missing.push(this.translate.instant('ORDER_CHECKOUT.MISSING_DELIVERY_METHOD'));
    }
    if (!this.selectedAddress()) {
      missing.push(this.translate.instant('ORDER_CHECKOUT.MISSING_ADDRESS'));
    }
    return missing;
  }

  private handleOrderCreateSuccess(res: CreateOrderResultDto): void {
    const liqpay = extractLiqPayCheckoutParams(res);
    if (liqpay) {
      this.orderPlacementError.set(null);
      submitLiqPayCheckoutForm(liqpay.data, liqpay.signature);
      return;
    }

    if (this.hasRealOrderId(this.normalizeOrderId(res))) {
      const msg = this.translate.instant('ORDER_CHECKOUT.LIQPAY_REDIRECT_FAILED');
      this.orderPlacementError.set(msg);
      this.snack.open(msg, 'OK', { duration: 6500 });
      return;
    }

    const rawMsg = res.message?.trim() ?? '';
    const msg =
      rawMsg === OrderCheckoutPage.backendOrderCreationFailed
        ? this.translate.instant('ORDER_CHECKOUT.CONFLICT_ORDER_CREATION_FAILED')
        : rawMsg || this.translate.instant('ORDER_CHECKOUT.ORDER_CREATE_FAILED');
    this.orderPlacementError.set(msg);
    this.snack.open(msg, 'OK', { duration: 6500 });

    const cart = res.shoppingCart ?? null;
    if (cart && this.isCartChanged(cart)) {
      this.router.navigateByUrl('/cart');
    }
  }

  /**
   * 409 Conflict: бекенд повертає його і при «кошик змінився», і при catch після невдалої транзакції
   * (див. `message` та `cartAdjusted` / `removedItems`). Нульовий `orderId` у тілі ігноруємо.
   */
  private handleOrderCreateError(err: HttpErrorResponse): void {
    if (err.status === 409) {
      const body = err.error as Partial<CreateOrderResultDto> & {
        errorCode?: string;
        ErrorCode?: string;
      } | null | undefined;
      const conflictCart = (body?.shoppingCart as ShoppingCartDto | null | undefined) ?? null;
      const raw = (typeof body?.message === 'string' && body.message.trim()) || '';
      const errCode = String(body?.errorCode ?? body?.ErrorCode ?? '').toUpperCase();

      let message: string;
      if (errCode === 'NO_PURCHASABLE_ITEMS') {
        message = this.translate.instant('ORDER_CHECKOUT.NO_PURCHASABLE_ITEMS');
      } else if (raw === OrderCheckoutPage.backendOrderCreationFailed) {
        message = this.translate.instant('ORDER_CHECKOUT.CONFLICT_ORDER_CREATION_FAILED');
      } else if (this.isBackendCartChangedMessage(raw)) {
        message = this.translate.instant('CART.CART_CHANGED');
      } else if (raw) {
        message = raw;
      } else {
        message = this.translate.instant('ORDER_CHECKOUT.ORDER_CREATE_FAILED');
      }

      this.orderPlacementError.set(message);
      this.snack.open(message, 'OK', { duration: 6500 });

      if (conflictCart) {
        this.applyCartSnapshot(conflictCart);
      }
      const goCart =
        errCode === 'NO_PURCHASABLE_ITEMS' ||
        (conflictCart != null && this.isCartChanged(conflictCart));
      if (goCart) {
        this.router.navigateByUrl('/cart');
      }
      return;
    }

    const code = String(err.error?.errorCode ?? '').toUpperCase();
    if (code.includes('ADDRESS_NOT_FOUND')) {
      const m = this.translate.instant('ORDER_CHECKOUT.MISSING_ADDRESS');
      this.orderPlacementError.set(m);
      this.snack.open(m, 'OK', { duration: 4200 });
      return;
    }
    if (code.includes('CART_IS_EMPTY')) {
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.CART_EMPTY'), 'OK', { duration: 4200 });
      this.router.navigateByUrl('/cart');
      return;
    }

    const message = err.error?.message || this.translate.instant('CART.CHECKOUT_ERROR');
    this.orderPlacementError.set(message);
    this.snack.open(message, 'OK', { duration: 4500 });
  }

  private isCartChanged(cart: ShoppingCartDto): boolean {
    return this.isCartStructuralChange(cart);
  }

  private isCartStructuralChange(cart: ShoppingCartDto): boolean {
    return (
      Boolean(cart.cartAdjusted) ||
      ((cart.removedItems?.length ?? 0) > 0) ||
      ((cart.removedMissingProductIds?.length ?? 0) > 0)
    );
  }

  /** Повідомлення про зміну кошика (окремо від загальної помилки створення замовлення). */
  private isBackendCartChangedMessage(message: string): boolean {
    const m = message.toLowerCase();
    return m.includes('cart has changed') || m.includes('review your items');
  }

  /** Після 409 оновлюємо відображення сум / порожнечі з тіла відповіді. */
  private applyCartSnapshot(cart: ShoppingCartDto): void {
    this.totalPayable.set(this.resolveTotalPayable(cart));
    const hasQty = (cart.items ?? []).some((it) => (Number(it.quantity) || 0) > 0);
    this.cartHasQuantityLines.set(hasQty);
    this.cartEmpty.set(!hasQty);
  }

  /** Backend may echo an empty GUID when the order was not created. */
  private hasRealOrderId(id: string | undefined | null): boolean {
    const t = (id ?? '').trim().toLowerCase();
    if (!t) return false;
    return t !== OrderCheckoutPage.emptyOrderId;
  }

  private normalizeOrderId(res: CreateOrderResultDto): string | undefined {
    const r = res as unknown as Record<string, unknown>;
    const v = res.orderId ?? r['OrderId'];
    return typeof v === 'string' ? v : undefined;
  }

  private applyMiddleNameFromAddress(addr: AddressResponseDto): void {
    const middle = (addr.middleName ?? '').trim();
    if (!middle) return;
    this.contactForm.patchValue({ middleName: middle }, { emitEvent: false });
    this.contactFormRevision.update((n) => n + 1);
  }
}
