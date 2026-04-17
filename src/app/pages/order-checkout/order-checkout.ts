import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../core/auth/services/auth.service';
import { AddressService } from '../../features/addresses/address.service';
import { SelectAddressDialogComponent } from '../../features/addresses/select-address-dialog/select-address-dialog.component';
import { AddressResponseDto, CreateAddressDto, DeliveryType } from '../../features/addresses/address.types';
import { CreateOrderResultDto } from '../../features/orders/order.types';
import { OrderService } from '../../features/orders/order.service';
import { DeliveryPointDto } from '../../features/shipping/nova-poshta.types';
import {
  SelectDeliveryMapDialogComponent,
  SelectDeliveryMapDialogData,
} from '../../features/shipping/select-delivery-map-dialog/select-delivery-map-dialog.component';
import { NovaPoshtaService } from '../../features/shipping/nova-poshta.service';
import { NpSettlementOption } from '../../features/shipping/nova-poshta.types';
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
    MatAutocompleteModule,
  ],
  templateUrl: './order-checkout.html',
  styleUrl: './order-checkout.scss',
})
export class OrderCheckoutPage implements OnInit {
  private auth = inject(AuthService);
  private cartApi = inject(ShoppingCartService);
  private orders = inject(OrderService);
  private addressApi = inject(AddressService);
  private np = inject(NovaPoshtaService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);

  readonly DeliveryType = DeliveryType;

  /** Ref населеного пункту НП для мапи / адреси (settlementRef у контракті). */
  settlementRef = signal('');
  settlementCityName = signal('');
  settlementSearchResults = signal<NpSettlementOption[]>([]);
  settlementSearchLoading = signal(false);
  private lastSettlementPick: NpSettlementOption | null = null;

  /** Пошук міста перед «Обрати на мапі». */
  cityForm = this.fb.nonNullable.group({
    citySearch: [''],
  });

  loading = signal(true);
  loadError = signal(false);
  cartEmpty = signal(false);
  /** Кінцева сума після усіх знижок (як у кошику). */
  totalPayable = signal(0);

  /** Згорнути блок контактів. */
  contactCollapsed = signal(false);

  selectedAddress = signal<AddressResponseDto | null>(null);
  deliveryType = signal<DeliveryType | null>(null);
  placingOrder = signal(false);

  contactForm = this.fb.nonNullable.group({
    phoneNumber: ['', [Validators.required, Validators.minLength(5)]],
    lastName: ['', Validators.required],
    firstName: ['', Validators.required],
    middleName: [''],
  });

  recipientSummary = computed(() => {
    const v = this.contactForm.getRawValue();
    const parts = [v.lastName?.trim(), v.firstName?.trim(), v.middleName?.trim()].filter(Boolean);
    return parts.length ? parts.join(' ') : '—';
  });
  contactPhoneSummary = computed(() => {
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
    if (!this.contactForm.valid) return false;
    if (!this.selectedAddress()) return false;
    if (this.deliveryType() === null) return false;
    return true;
  });

  canOpenNpMap = computed(() => {
    const dt = this.deliveryType();
    if (dt !== DeliveryType.Warehouse && dt !== DeliveryType.Postomat) return false;
    return this.settlementRef().trim().length > 0;
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
    this.setupSettlementSearch();
    this.loadCart();
  }

  private setupSettlementSearch(): void {
    this.cityForm.controls.citySearch.valueChanges
      .pipe(
        tap((q) => {
          const t = String(q ?? '').trim();
          if (!this.lastSettlementPick) return;
          if (t === '' || t !== this.lastSettlementPick.description.trim()) {
            this.lastSettlementPick = null;
            this.settlementRef.set('');
            this.settlementCityName.set('');
          }
        }),
        debounceTime(300),
        map((q) => String(q ?? '').trim()),
        distinctUntilChanged(),
        switchMap((t) => {
          if (t.length < 1) {
            this.settlementSearchResults.set([]);
            return of<NpSettlementOption[]>([]);
          }
          this.settlementSearchLoading.set(true);
          return this.np.searchCities(t).pipe(
            finalize(() => this.settlementSearchLoading.set(false)),
            catchError(() => of<NpSettlementOption[]>([])),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => this.settlementSearchResults.set(results));
  }

  onSettlementSelected(ref: string): void {
    const opt = this.settlementSearchResults().find((o) => o.ref === ref);
    if (!opt) return;
    this.lastSettlementPick = opt;
    this.settlementRef.set(opt.ref);
    this.settlementCityName.set(opt.description);
    this.cityForm.patchValue({ citySearch: opt.description }, { emitEvent: false });
  }

  private clearSettlement(): void {
    this.lastSettlementPick = null;
    this.settlementRef.set('');
    this.settlementCityName.set('');
    this.cityForm.patchValue({ citySearch: '' }, { emitEvent: false });
    this.settlementSearchResults.set([]);
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
        const hasItems = (cart.items ?? []).some((it) => (Number(it.quantity) || 0) > 0);
        this.cartEmpty.set(!hasItems);
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
      }
    });
  }

  onDeliveryChange(e: MatRadioChange): void {
    const next = e.value as DeliveryType;
    const addr = this.selectedAddress();
    if (addr && addr.deliveryType !== next) {
      this.selectedAddress.set(null);
    }
    if (next === DeliveryType.Doors) {
      this.clearSettlement();
    }
    this.deliveryType.set(next);
  }

  /** Для блоку «Адреса»: якщо спосіб НП, можна обрати точку на мапі після вибору міста. */
  canOpenMapForSelectedDelivery(): boolean {
    const dt = this.deliveryType();
    if (dt !== DeliveryType.Warehouse && dt !== DeliveryType.Postomat) return false;
    return this.canOpenNpMap();
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

  openNpMapDialog(): void {
    const dt = this.deliveryType();
    if (dt !== DeliveryType.Warehouse && dt !== DeliveryType.Postomat) {
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.MAP_NEED_NP_TYPE'), 'OK', {
        duration: 3000,
      });
      return;
    }
    const settlement = this.settlementRef().trim();
    if (!settlement) {
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.MAP_NEED_CITY'), 'OK', {
        duration: 3000,
      });
      return;
    }
    const npType: SelectDeliveryMapDialogData['npType'] =
      dt === DeliveryType.Warehouse ? 'branch' : 'postomat';
    const ref = this.dialog.open(SelectDeliveryMapDialogComponent, {
      width: 'min(96vw - 24px, 720px)',
      maxWidth: '100vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: {
        settlementRef: settlement,
        cityName: this.settlementCityName().trim() || settlement,
        npType,
      } satisfies SelectDeliveryMapDialogData,
    });
    ref.afterClosed().subscribe((point) => {
      if (point) this.saveAddressFromMapPoint(point);
    });
  }

  private saveAddressFromMapPoint(point: DeliveryPointDto): void {
    const v = this.contactForm.getRawValue();
    const dt = this.deliveryType();
    if (dt !== DeliveryType.Warehouse && dt !== DeliveryType.Postomat) return;

    const cityRef = this.settlementRef().trim();
    const cityName = this.settlementCityName().trim() || null;
    const description = [point.name, point.shortAddress].filter(Boolean).join(' — ');

    const dto: CreateAddressDto = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      middleName: (v.middleName ?? '').trim(),
      phoneNumber: v.phoneNumber.trim(),
      deliveryType: dt,
      cityRef,
      cityName,
      warehouseRef: null,
      warehouseDescription: null,
      streetRef: null,
      street: null,
      house: null,
      flat: null,
      floor: null,
      additionalInfo: null,
      postomatRef: null,
      postomatDescription: null,
    };

    if (dt === DeliveryType.Warehouse) {
      dto.warehouseRef = point.ref;
      dto.warehouseDescription = description;
    } else {
      dto.postomatRef = point.ref;
      dto.postomatDescription = description;
    }

    this.addressApi.create(dto).subscribe({
      next: (addr) => {
        this.selectedAddress.set(addr);
        this.snack.open(this.translate.instant('ORDER_CHECKOUT.MAP_ADDRESS_SAVED'), 'OK', {
          duration: 2500,
        });
      },
      error: () => {
        this.snack.open(this.translate.instant('ADDRESS.SAVE_ERROR'), 'OK', { duration: 4000 });
      },
    });
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
    const addr = this.selectedAddress();
    if (!addr?.id) return;

    this.placingOrder.set(true);
    this.cartApi.getMyCart().subscribe({
      next: (cart) => {
        const hasConflict = Boolean(cart.cartAdjusted) || ((cart.removedItems?.length ?? 0) > 0);
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
    if (res.shoppingCart) {
      const message = res.message?.trim() || this.translate.instant('CART.CART_CHANGED');
      this.snack.open(message, 'OK', { duration: 4500 });
      if (this.isCartChanged(res.shoppingCart)) {
        this.router.navigateByUrl('/cart');
      }
      return;
    }
    if (res.payload) {
      this.redirectToLiqPay(res.payload);
      return;
    }
    this.snack.open(this.translate.instant('CART.ORDER_CREATED'), 'OK', { duration: 3200 });
  }

  private handleOrderCreateError(err: HttpErrorResponse): void {
    if (err.status === 409) {
      const conflictCart = (err.error?.shoppingCart as ShoppingCartDto | null | undefined) ?? null;
      const message = err.error?.message || this.translate.instant('CART.CART_CHANGED');
      this.snack.open(message, 'OK', { duration: 4500 });
      if (!conflictCart || this.isCartChanged(conflictCart)) {
        this.router.navigateByUrl('/cart');
      }
      return;
    }

    const code = String(err.error?.errorCode ?? '').toUpperCase();
    if (code.includes('ADDRESS_NOT_FOUND')) {
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.MISSING_ADDRESS'), 'OK', { duration: 4200 });
      return;
    }
    if (code.includes('CART_IS_EMPTY')) {
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.CART_EMPTY'), 'OK', { duration: 4200 });
      this.router.navigateByUrl('/cart');
      return;
    }

    const message = err.error?.message || this.translate.instant('CART.CHECKOUT_ERROR');
    this.snack.open(message, 'OK', { duration: 4500 });
  }

  private redirectToLiqPay(payload: string | Record<string, unknown>): void {
    const parsed = this.parsePayload(payload);
    const data = parsed?.['data'];
    const signature = parsed?.['signature'];
    if (typeof data !== 'string' || typeof signature !== 'string') {
      this.snack.open(this.translate.instant('CART.ORDER_CREATED'), 'OK', { duration: 3000 });
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.liqpay.ua/api/3/checkout';
    form.style.display = 'none';

    const dataInput = document.createElement('input');
    dataInput.name = 'data';
    dataInput.value = data;
    form.appendChild(dataInput);

    const signInput = document.createElement('input');
    signInput.name = 'signature';
    signInput.value = signature;
    form.appendChild(signInput);

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  private parsePayload(payload: string | Record<string, unknown>): Record<string, unknown> | null {
    if (typeof payload === 'object' && payload !== null) return payload;
    try {
      const parsed = JSON.parse(payload) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private isCartChanged(cart: ShoppingCartDto): boolean {
    return Boolean(cart.cartAdjusted) || ((cart.removedItems?.length ?? 0) > 0);
  }
}
