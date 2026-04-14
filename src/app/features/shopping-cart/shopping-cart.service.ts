import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { normalizeShoppingCartDto } from './shopping-cart-normalize.util';
import { AddCartItemDto, ShoppingCartDto, ShoppingCartItemDto } from './shopping-cart.types';

/**
 * ShoppingCartController — операції кошика лише для авторизованих.
 * GET /api/ShoppingCart/me
 */
@Injectable({ providedIn: 'root' })
export class ShoppingCartService {
  private api = inject(ApiService);
  private base = '/ShoppingCart';

  getMyCart(): Observable<ShoppingCartDto> {
    return this.api
      .get<unknown>(`${this.base}/me`)
      .pipe(map((raw) => normalizeShoppingCartDto(raw)));
  }

  addItem(dto: AddCartItemDto): Observable<ShoppingCartItemDto> {
    return this.api.post<ShoppingCartItemDto>(`${this.base}/items`, dto);
  }

  increaseQuantity(productId: string, amount = 1): Observable<ShoppingCartItemDto> {
    const q = amount > 0 ? `?amount=${amount}` : '';
    return this.api.post<ShoppingCartItemDto>(
      `${this.base}/items/${encodeURIComponent(productId)}/increase${q}`,
      {},
    );
  }

  decreaseQuantity(productId: string, amount = 1): Observable<ShoppingCartItemDto | null> {
    const q = amount > 0 ? `?amount=${amount}` : '';
    return this.api.post<ShoppingCartItemDto | null>(
      `${this.base}/items/${encodeURIComponent(productId)}/decrease${q}`,
      {},
    );
  }

  removeItem(productId: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/items/${encodeURIComponent(productId)}`);
  }

  applyCoupon(couponCode: string): Observable<ShoppingCartDto> {
    const code = couponCode.trim();
    /** Деякі ендпоінти очікують PascalCase у тілі JSON. */
    const body = { couponCode: code, CouponCode: code };
    return this.api
      .post<unknown>(`${this.base}/coupon`, body)
      .pipe(map((raw) => normalizeShoppingCartDto(raw)));
  }

  removeCoupon(): Observable<ShoppingCartDto> {
    return this.api
      .delete<unknown>(`${this.base}/coupon`)
      .pipe(map((raw) => normalizeShoppingCartDto(raw)));
  }

  clear(): Observable<void> {
    return this.api.delete<void>(`${this.base}/clear`);
  }
}
