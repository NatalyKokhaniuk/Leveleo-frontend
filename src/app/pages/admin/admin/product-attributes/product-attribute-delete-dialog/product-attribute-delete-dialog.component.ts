import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { ProductAttributeService } from '../../../../../features/product-attributes/product-attribute.service';

export interface ProductAttributeDeleteDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-product-attribute-delete-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './product-attribute-delete-dialog.component.html',
  styleUrl: './product-attribute-delete-dialog.component.scss',
})
export class ProductAttributeDeleteDialogComponent {
  data = inject<ProductAttributeDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<ProductAttributeDeleteDialogComponent, boolean>);
  private productAttributeService = inject(ProductAttributeService);

  deleting = signal(false);

  confirm() {
    this.deleting.set(true);
    this.productAttributeService.delete(this.data.id).subscribe({
      next: () => this.ref.close(true),
      error: () => this.deleting.set(false),
    });
  }
}
