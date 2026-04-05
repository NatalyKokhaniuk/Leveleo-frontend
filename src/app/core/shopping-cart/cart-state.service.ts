import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ShoppingCartService } from '../../features/shopping-cart/shopping-cart.service';
import { ShoppingCartDto } from '../../features/shopping-cart/shopping-cart.types';
import { AuthService } from '../auth/services/auth.service';

/**
 * Локальний стан кількостей товарів у кошику (після GET /me).
 */
@Injectable({ providedIn: 'root' })
export class CartStateService {
  private auth = inject(AuthService);
  private cartApi = inject(ShoppingCartService);

  private _qtyByProduct = signal<Map<string, number>>(new Map());

  /** Для реактивних computed у компонентах (кількість по productId). */
  readonly quantities = this._qtyByProduct.asReadonly();

  /** Сума кількостей позицій (для бейджа в хедері). */
  readonly totalUnits = computed(() => {
    let n = 0;
    for (const q of this._qtyByProduct().values()) {
      n += q;
    }
    return n;
  });

  /** Кількість позиції в кошику (0 — немає). */
  quantityFor(productId: string): number {
    return this._qtyByProduct().get(productId) ?? 0;
  }

  hydrateAfterAuthRestore(): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      this._qtyByProduct.set(new Map());
      return of(void 0);
    }
    return this.reloadFromServer();
  }

  reloadFromServer(): Observable<void> {
    return this.cartApi.getMyCart().pipe(
      tap((cart) => this.applyDto(cart)),
      map(() => void 0),
      catchError(() => {
        this._qtyByProduct.set(new Map());
        return of(void 0);
      }),
    );
  }

  addToCart(productId: string, quantity = 1): Observable<void> {
    return this.cartApi.addItem({ productId, quantity }).pipe(
      switchMap(() => this.reloadFromServer()),
    );
  }

  increase(productId: string): Observable<void> {
    return this.cartApi.increaseQuantity(productId, 1).pipe(switchMap(() => this.reloadFromServer()));
  }

  decrease(productId: string): Observable<void> {
    return this.cartApi.decreaseQuantity(productId, 1).pipe(switchMap(() => this.reloadFromServer()));
  }

  removeFromCart(productId: string): Observable<void> {
    return this.cartApi.removeItem(productId).pipe(switchMap(() => this.reloadFromServer()));
  }

  private applyDto(cart: ShoppingCartDto): void {
    const m = new Map<string, number>();
    for (const it of cart.items ?? []) {
      if (it?.productId != null) {
        m.set(String(it.productId), Math.max(0, Number(it.quantity) || 0));
      }
    }
    this._qtyByProduct.set(m);
  }
}
