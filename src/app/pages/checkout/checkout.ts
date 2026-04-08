import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
export class CheckoutPage {
  private orders = inject(OrderService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private router = inject(Router);

  addressId = signal('');
  busy = signal(false);

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
}
