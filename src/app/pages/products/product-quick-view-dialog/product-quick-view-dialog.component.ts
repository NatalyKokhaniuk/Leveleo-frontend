import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/services/auth.service';
import { productLocalizedName } from '../../../features/products/product-display-i18n';
import { isCatalogPurchaseBlocked } from '../../../features/products/product-catalog-display';
import { ProductResponseDto } from '../../../features/products/product.types';
import { ProductCommerceToolbarComponent } from '../product-commerce-toolbar/product-commerce-toolbar.component';
import { ProductDetailTabsComponent } from '../product-detail-tabs/product-detail-tabs.component';

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
    RouterLink,
    TranslateModule,
    ProductDetailTabsComponent,
    ProductCommerceToolbarComponent,
  ],
  templateUrl: './product-quick-view-dialog.component.html',
  styleUrl: './product-quick-view-dialog.component.scss',
})
export class ProductQuickViewDialogComponent implements OnInit {
  data = inject<ProductQuickViewDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProductQuickViewDialogComponent>);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private auth = inject(AuthService);

  private lang = signal(this.translate.currentLang || 'uk');

  canManageProduct(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Moderator']);
  }

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
  }

  displayName(): string {
    return productLocalizedName(this.data.product, this.lang());
  }

  /** Заголовок у діалозі: публічне посилання лише якщо товар можна купити з вітрини. */
  titlePublicSegments(): string[] | null {
    const p = this.data.product;
    if (!p?.slug?.trim() || isCatalogPurchaseBlocked(p)) return null;
    return ['/products', p.slug.trim()];
  }

  toolbarPurchaseBlocked(): boolean {
    return isCatalogPurchaseBlocked(this.data.product);
  }

  close(): void {
    this.dialogRef.close();
  }

  openProductPage(): void {
    const segs = this.titlePublicSegments();
    if (!segs) return;
    const tree = this.router.createUrlTree(segs);
    const url = this.router.serializeUrl(tree);
    window.open(url, '_blank', 'noopener');
    this.dialogRef.close();
  }
}
