import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { PromotionService } from '../../../../../features/promotions/promotion.service';

export interface PromotionDeleteDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-promotion-delete-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './promotion-delete-dialog.component.html',
})
export class PromotionDeleteDialogComponent {
  data = inject<PromotionDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<PromotionDeleteDialogComponent, boolean>);
  private promotionService = inject(PromotionService);

  deleting = signal(false);

  confirm(): void {
    this.deleting.set(true);
    this.promotionService.delete(this.data.id).subscribe({
      next: () => this.ref.close(true),
      error: () => this.deleting.set(false),
    });
  }
}
