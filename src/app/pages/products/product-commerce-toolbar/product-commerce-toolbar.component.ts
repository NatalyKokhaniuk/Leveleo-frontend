import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { AuthHandlerService } from '../../../core/auth/services/auth-handler.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { ComparisonStateService } from '../../../core/comparison/comparison-state.service';
import { CartStateService } from '../../../core/shopping-cart/cart-state.service';

@Component({
  selector: 'app-product-commerce-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './product-commerce-toolbar.component.html',
  styleUrl: './product-commerce-toolbar.component.scss',
})
export class ProductCommerceToolbarComponent {
  productId = input.required<string>();
  maxQuantity = input<number | null>(null);
  /** Приховати кнопку порівняння (наприклад у кошику). */
  hideCompare = input(false);

  private auth = inject(AuthService);
  private authHandler = inject(AuthHandlerService);
  private cart = inject(CartStateService);
  private comparison = inject(ComparisonStateService);

  busy = false;

  /** Реактивно від оновлень кошика на сервері. */
  qty = computed(() => this.cart.quantities().get(this.productId()) ?? 0);
  inComparison = computed(() => this.comparison.comparisonIds().has(this.productId()));
  canIncrease = computed(() => {
    const max = this.maxQuantity();
    if (max == null) return true;
    return this.qty() < Math.max(0, max);
  });

  isAuthed(): boolean {
    return this.auth.isAuthenticated();
  }

  onCompare(): void {
    if (!this.isAuthed()) {
      this.authHandler.openAuthDialog('login');
      return;
    }
    this.busy = true;
    this.comparison
      .toggleComparison(this.productId())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe();
  }

  onAddToCart(): void {
    if (!this.isAuthed()) {
      this.authHandler.openAuthDialog('login');
      return;
    }
    if (!this.canIncrease()) {
      return;
    }
    this.busy = true;
    this.cart
      .addToCart(this.productId(), 1)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe();
  }

  inc(): void {
    if (!this.isAuthed()) {
      this.authHandler.openAuthDialog('login');
      return;
    }
    if (!this.canIncrease()) {
      return;
    }
    this.busy = true;
    this.cart
      .increase(this.productId())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe();
  }

  dec(): void {
    if (!this.isAuthed()) {
      return;
    }
    this.busy = true;
    this.cart
      .decrease(this.productId())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe();
  }

  onRemoveFromCart(): void {
    if (!this.isAuthed()) {
      return;
    }
    this.busy = true;
    this.cart
      .removeFromCart(this.productId())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe();
  }
}
