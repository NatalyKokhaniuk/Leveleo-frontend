import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { productLocalizedName } from '../../../features/products/product-display-i18n';
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

  private lang = signal(this.translate.currentLang || 'uk');

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });
  }

  displayName(): string {
    return productLocalizedName(this.data.product, this.lang());
  }

  close(): void {
    this.dialogRef.close();
  }
}
