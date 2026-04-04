import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { CategoryService } from '../../../../../features/categories/category.service';

export interface CategoryDeleteDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-category-delete-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './category-delete-dialog.component.html',
  styleUrl: './category-delete-dialog.component.scss',
})
export class CategoryDeleteDialogComponent {
  data = inject<CategoryDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<CategoryDeleteDialogComponent, boolean>);
  private categoryService = inject(CategoryService);

  deleting = signal(false);

  confirm() {
    this.deleting.set(true);
    this.categoryService.delete(this.data.id).subscribe({
      next: () => this.ref.close(true),
      error: () => this.deleting.set(false),
    });
  }
}
