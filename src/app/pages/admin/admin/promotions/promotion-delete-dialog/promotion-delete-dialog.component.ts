import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { PromotionService } from '../../../../../features/promotions/promotion.service';

export interface PromotionDeleteDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-promotion-delete-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './promotion-delete-dialog.component.html',
})
export class PromotionDeleteDialogComponent {
  data = inject<PromotionDeleteDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<PromotionDeleteDialogComponent, boolean>);
  private api = inject(PromotionService);
  deleting = signal(false);

  cancel(): void {
    this.ref.close(false);
  }

  confirm(): void {
    this.deleting.set(true);
    this.api.delete(this.data.id).subscribe({
      next: () => this.ref.close(true),
      error: () => this.deleting.set(false),
    });
  }
}
