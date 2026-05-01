import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
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
  /** Знято з продажу / нема в каталозі — не додавати й не збільшувати кількість (зменшити/прибрати з кошика можна). */
  purchaseBlocked = input(false);

  private auth = inject(AuthService);
  private cart = inject(CartStateService);
  private comparison = inject(ComparisonStateService);

  busy = false;

  /**
   * Інлайн-підказка для гостя (як на сторінці кошика), без модального вікна.
   */
  guestHint = signal<'none' | 'compare' | 'purchase'>('none');

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.guestHint.set('none');
      }
    });
  }

  /** Реактивно від оновлень кошика на сервері. */
  qty = computed(() => this.cart.quantities().get(this.productId()) ?? 0);
  inComparison = computed(() => this.comparison.comparisonIds().has(this.productId()));
  canIncrease = computed(() => {
    if (this.purchaseBlocked()) return false;
    const max = this.maxQuantity();
    if (max == null) return true;
    return this.qty() < Math.max(0, max);
  });

  isAuthed(): boolean {
    return this.auth.isAuthenticated();
  }

  onCompare(): void {
    if (!this.isAuthed()) {
      this.guestHint.set('compare');
      return;
    }
    this.busy = true;
    this.comparison
      .toggleComparison(this.productId())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe();
  }

  onAddToCart(): void {
    if (this.purchaseBlocked()) {
      return;
    }
    if (!this.isAuthed()) {
      this.guestHint.set('purchase');
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
    if (this.purchaseBlocked()) {
      return;
    }
    if (!this.isAuthed()) {
      this.guestHint.set('purchase');
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
