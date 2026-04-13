import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { AuthService } from '../../core/auth/services/auth.service';
import { SelectAddressDialogComponent } from '../../features/addresses/select-address-dialog/select-address-dialog.component';
import { AddressResponseDto, DeliveryType } from '../../features/addresses/address.types';
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
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);

  readonly DeliveryType = DeliveryType;

  loading = signal(true);
  loadError = signal(false);
  cartEmpty = signal(false);
  /** Кінцева сума після усіх знижок (як у кошику). */
  totalPayable = signal(0);

  /** Згорнути блок контактів. */
  contactCollapsed = signal(false);

  selectedAddress = signal<AddressResponseDto | null>(null);
  deliveryType = signal<DeliveryType | null>(null);

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

  ngOnInit(): void {
    const u = this.auth.currentUser();
    if (u) {
      this.contactForm.patchValue({
        phoneNumber: u.phoneNumber?.trim() ?? '',
        lastName: u.lastName?.trim() ?? '',
        firstName: u.firstName?.trim() ?? '',
      });
    }
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
    this.deliveryType.set(next);
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

  mapPlaceholderClick(): void {
    this.snack.open(this.translate.instant('ORDER_CHECKOUT.MAP_HINT'), 'OK', { duration: 2500 });
  }

  goToPayment(): void {
    if (!this.canPurchase()) {
      this.contactForm.markAllAsTouched();
      this.snack.open(this.translate.instant('ORDER_CHECKOUT.FILL_REQUIRED'), 'OK', { duration: 3000 });
      return;
    }
    const addr = this.selectedAddress();
    if (!addr?.id) return;
    this.router.navigate(['/checkout'], {
      queryParams: { addressId: addr.id },
    });
  }
}
