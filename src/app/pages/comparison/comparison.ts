import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth/services/auth.service';
import { ComparisonStateService } from '../../core/comparison/comparison-state.service';
import { UserProductRelationsService } from '../../features/user-product-relations/user-product-relations.service';
import { ProductResponseDto } from '../../features/products/product.types';
import { ProductCommerceToolbarComponent } from '../products/product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductDetailTabsComponent } from '../products/product-detail-tabs/product-detail-tabs.component';

@Component({
  selector: 'app-comparison',
  standalone: true,
  imports: [
    TranslateModule,
    RouterLink,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
  ],
  templateUrl: './comparison.html',
  styleUrl: './comparison.scss',
})
export class ComparisonPage implements OnInit {
  private auth = inject(AuthService);
  private relations = inject(UserProductRelationsService);
  private comparison = inject(ComparisonStateService);

  loading = signal(false);
  loadError = signal(false);
  items = signal<ProductResponseDto[]>([]);

  readonly isAuthenticated = this.auth.isAuthenticated;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.relations
      .getMyComparison()
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of([] as ProductResponseDto[]);
        }),
      )
      .subscribe((list) => {
        this.items.set(list.filter((p) => p.isActive));
        this.loading.set(false);
      });
  }

  remove(id: string): void {
    this.comparison.toggleComparison(id).subscribe(() => {
      this.items.update((rows) => rows.filter((p) => p.id !== id));
    });
  }
}
