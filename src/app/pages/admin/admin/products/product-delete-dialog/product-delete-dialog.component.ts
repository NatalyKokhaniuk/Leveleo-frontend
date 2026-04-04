import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

export interface ProductDeleteDialogData {
  name: string;
}

@Component({
  selector: 'app-product-delete-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslateModule],
  templateUrl: './product-delete-dialog.component.html',
})
export class ProductDeleteDialogComponent {
  data = inject<ProductDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<ProductDeleteDialogComponent, boolean>);
}
