import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
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
    return this.api.get<ShoppingCartDto>(`${this.base}/me`);
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
}
