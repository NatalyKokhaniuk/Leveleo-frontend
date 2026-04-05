import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { ProductResponseDto } from '../../../features/products/product.types';

export interface ProductQuickViewDialogData {
  product: ProductResponseDto;
}

@Component({
  selector: 'app-product-quick-view-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    DecimalPipe,
  ],
  templateUrl: './product-quick-view-dialog.component.html',
  styleUrl: './product-quick-view-dialog.component.scss',
})
export class ProductQuickViewDialogComponent implements OnInit {
  data = inject<ProductQuickViewDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProductQuickViewDialogComponent>);
  private mediaUrlCache = inject(MediaUrlCacheService);

  imageUrl = signal<string | null>(null);
  imageLoading = signal(true);

  ngOnInit(): void {
    const key = this.data.product.mainImageKey?.trim();
    if (!key) {
      this.imageLoading.set(false);
      return;
    }
    this.mediaUrlCache.getUrl(key).subscribe({
      next: (url) => {
        this.imageUrl.set(url);
        this.imageLoading.set(false);
      },
      error: () => this.imageLoading.set(false),
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  starFilled(index: number): boolean {
    const r = this.data.product.averageRating;
    if (r == null || Number.isNaN(r)) {
      return false;
    }
    return index < Math.round(Math.min(5, Math.max(0, r)));
  }

  displayPrice(): number {
    const p = this.data.product;
    return p.discountedPrice != null ? p.discountedPrice : p.price;
  }

  listPrice(): number {
    return this.data.product.price;
  }

  hasDiscount(): boolean {
    const p = this.data.product;
    return p.discountedPrice != null && p.discountedPrice < p.price;
  }

  promotionLabel(): string | null {
    const pr = this.data.product.appliedPromotion;
    if (!pr) {
      return null;
    }
    return pr.name?.trim() || null;
  }
}
