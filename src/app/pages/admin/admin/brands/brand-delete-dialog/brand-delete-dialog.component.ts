import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { BrandService } from '../../../../../features/brands/brand.service';

export interface BrandDeleteDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-brand-delete-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './brand-delete-dialog.component.html',
  styleUrl: './brand-delete-dialog.component.scss',
})
export class BrandDeleteDialogComponent {
  data = inject<BrandDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<BrandDeleteDialogComponent, boolean>);
  private brandService = inject(BrandService);

  deleting = signal(false);

  confirm() {
    this.deleting.set(true);
    this.brandService.delete(this.data.id).subscribe({
      next: () => this.ref.close(true),
      error: () => this.deleting.set(false),
    });
  }
}
