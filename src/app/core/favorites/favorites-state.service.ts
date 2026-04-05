import { inject, Injectable, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../auth/services/auth.service';
import { UserProductRelationsService } from '../../features/user-product-relations/user-product-relations.service';
import { ProductService } from '../../features/products/product.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { readFavoriteIds, toggleFavoriteId, writeFavoriteIds } from './favorites-storage';

/**
 * Обране: для гостя — localStorage; для авторизованого — API + злиття local при вході.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesStateService {
  private auth = inject(AuthService);
  private relations = inject(UserProductRelationsService);
  private productService = inject(ProductService);

  private _ids = signal<Set<string>>(new Set());

  /** Множина id обраних (для карток товарів тощо). */
  readonly favoriteIds = this._ids.asReadonly();

  /**
   * Викликати після restoreSession та після успішного логіна / 2FA / social.
   * Якщо є сесія: завантажує з сервера, додає відсутні id з localStorage, очищає local.
   */
  hydrateAfterAuthRestore(): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      this._ids.set(readFavoriteIds());
      return of(void 0);
    }
    return this.mergeLocalIntoServerAndReload();
  }

  /**
   * Перед logout: зберегти обране з БД у localStorage, щоб гість після виходу бачив ті самі id.
   */
  exportServerFavoritesToLocalStorage(): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      return of(void 0);
    }
    return this.relations.getMyFavorites().pipe(
      tap((products) => {
        writeFavoriteIds(new Set(products.map((p) => p.id)));
        this._ids.set(new Set(products.map((p) => p.id)));
      }),
      map(() => void 0),
      catchError(() => of(void 0)),
    );
  }

  /** Список товарів для /favorites */
  loadFavoriteProducts(): Observable<ProductResponseDto[]> {
    if (!this.auth.isAuthenticated()) {
      const ids = [...readFavoriteIds()];
      if (ids.length === 0) {
        return of([]);
      }
      return forkJoin(
        ids.map((id) =>
          this.productService.getById(id).pipe(catchError(() => of(null))),
        ),
      ).pipe(
        map((list) =>
          list.filter((p): p is ProductResponseDto => p != null && p.isActive),
        ),
      );
    }
    return this.relations.getMyFavorites().pipe(
      tap((products) => this._ids.set(new Set(products.map((p) => p.id)))),
      catchError(() => of([] as ProductResponseDto[])),
    );
  }

  toggleFavorite(productId: string): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      const next = toggleFavoriteId(productId, readFavoriteIds());
      this._ids.set(next);
      return of(void 0);
    }
    const had = this._ids().has(productId);
    if (had) {
      return this.relations.removeFromFavorites(productId).pipe(
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
    return this.relations.addToFavorites(productId).pipe(
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

  removeFavorite(productId: string): Observable<void> {
    return this.toggleFavorite(productId);
  }

  private mergeLocalIntoServerAndReload(): Observable<void> {
    return this.relations.getMyFavorites().pipe(
      switchMap((products) => {
        const serverIds = new Set(products.map((p) => p.id));
        const local = readFavoriteIds();
        const toMerge = [...local].filter((id) => !serverIds.has(id));
        if (toMerge.length === 0) {
          this._ids.set(serverIds);
          writeFavoriteIds(new Set());
          return of(void 0);
        }
        return forkJoin(
          toMerge.map((id) =>
            this.relations.addToFavorites(id).pipe(catchError(() => of(null))),
          ),
        ).pipe(
          switchMap(() => this.relations.getMyFavorites()),
          tap((merged) => {
            this._ids.set(new Set(merged.map((p) => p.id)));
            writeFavoriteIds(new Set());
          }),
          map(() => void 0),
        );
      }),
      catchError(() => {
        this._ids.set(readFavoriteIds());
        return of(void 0);
      }),
    );
  }
}
