import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrderService } from '../../features/orders/order.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [TranslateModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutPage implements OnInit {
  private orders = inject(OrderService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  addressId = signal('');
  busy = signal(false);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((pm) => {
      const id = pm.get('addressId')?.trim();
      if (id) this.addressId.set(id);
    });
  }

  submit(): void {
    const userAddressId = this.addressId().trim();
    if (!userAddressId || this.busy()) {
      this.snack.open(this.translate.instant('CART.ADDRESS_REQUIRED'), 'OK', { duration: 2500 });
      return;
    }
    this.busy.set(true);
    this.orders.create({ userAddressId }).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.shoppingCart) {
          this.snack.open(res.message || this.translate.instant('CART.CART_CHANGED'), 'OK', {
            duration: 3500,
          });
          this.router.navigateByUrl('/cart');
          return;
        }
        if (res.payload) {
          this.redirectToLiqPay(res.payload);
          return;
        }
        this.snack.open(this.translate.instant('CART.ORDER_CREATED'), 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.busy.set(false);
        if (err?.status === 409) {
          const message = err?.error?.message || this.translate.instant('CART.CART_CHANGED');
          this.snack.open(message, 'OK', { duration: 3500 });
          this.router.navigateByUrl('/cart');
          return;
        }
        const message = err?.error?.message || this.translate.instant('CART.CHECKOUT_ERROR');
        this.snack.open(message, 'OK', { duration: 3500 });
      },
    });
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
}
