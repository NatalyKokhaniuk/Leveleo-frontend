import { inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { UserProductRelationsService } from '../../features/user-product-relations/user-product-relations.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { AuthService } from '../auth/services/auth.service';

/** Порівняння товарів — лише для авторизованих (API). */
@Injectable({ providedIn: 'root' })
export class ComparisonStateService {
  private auth = inject(AuthService);
  private relations = inject(UserProductRelationsService);

  private _ids = signal<Set<string>>(new Set());

  readonly comparisonIds = this._ids.asReadonly();

  inComparison(productId: string): boolean {
    return this._ids().has(productId);
  }

  hydrateAfterAuthRestore(): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      this._ids.set(new Set());
      return of(void 0);
    }
    return this.relations.getMyComparison().pipe(
      tap((products: ProductResponseDto[]) =>
        this._ids.set(new Set(products.map((p) => p.id))),
      ),
      map(() => void 0),
      catchError(() => {
        this._ids.set(new Set());
        return of(void 0);
      }),
    );
  }

  toggleComparison(productId: string): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      return of(void 0);
    }
    if (this._ids().has(productId)) {
      return this.relations.removeFromComparison(productId).pipe(
        tap(() =>
          this._ids.update((s) => {
            const n = new Set(s);
            n.delete(productId);
            return n;
          }),
        ),
        map(() => void 0),
        catchError(() => of(void 0)),
      );
    }
    return this.relations.addToComparison(productId).pipe(
      tap(() =>
        this._ids.update((s) => {
          const n = new Set(s);
          n.add(productId);
          return n;
        }),
      ),
      map(() => void 0),
      catchError(() => of(void 0)),
    );
  }
}
