import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { productLocalizedName } from '../../../features/products/product-display-i18n';
import { ProductService } from '../../../features/products/product.service';
import { ProductResponseDto } from '../../../features/products/product.types';
import { ProductDetailTabsComponent } from '../../products/product-detail-tabs/product-detail-tabs.component';

export interface OrderItemReviewDialogData {
  productId: string;
  orderItemId: string;
}

@Component({
  selector: 'app-order-item-review-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    RouterLink,
    ProductDetailTabsComponent,
  ],
  templateUrl: './order-item-review-dialog.component.html',
  styleUrl: './order-item-review-dialog.component.scss',
})
export class OrderItemReviewDialogComponent implements OnInit {
  data = inject<OrderItemReviewDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<OrderItemReviewDialogComponent>);
  private products = inject(ProductService);
  private translate = inject(TranslateService);

  private lang = signal(this.translate.currentLang || 'uk');

  loading = signal(true);
  loadError = signal(false);
  product = signal<ProductResponseDto | null>(null);

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
    this.products.getById(this.data.productId).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  displayName(): string {
    const p = this.product();
    if (!p) return '';
    return productLocalizedName(p, this.lang());
  }

  close(): void {
    this.dialogRef.close();
  }
}
