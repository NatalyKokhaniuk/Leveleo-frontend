import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import {
  FAVORITES_STORAGE_KEY,
} from '../../core/favorites/favorites-storage';
import { FavoritesStateService } from '../../core/favorites/favorites-state.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { ProductDetailTabsComponent } from '../products/product-detail-tabs/product-detail-tabs.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    ProductDetailTabsComponent,
  ],
  templateUrl: './favorites.html',
  styleUrl: './favorites.scss',
})
export class FavoritesPage implements OnInit, OnDestroy {
  private favorites = inject(FavoritesStateService);

  loading = signal(true);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);

  ngOnInit(): void {
    this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorage);
    }
  }

  private onStorage = (e: StorageEvent): void => {
    if (e.key === FAVORITES_STORAGE_KEY) {
      this.load();
    }
  };

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.favorites
      .loadFavoriteProducts()
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of([] as ProductResponseDto[]);
        }),
      )
      .subscribe((list) => {
        this.items.set(list);
        this.loading.set(false);
      });
  }

  remove(id: string): void {
    this.favorites.removeFavorite(id).subscribe(() => {
      this.items.update((rows) => rows.filter((p) => p.id !== id));
    });
  }
}
