import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AttributeGroupService } from '../../../../../features/attribute-groups/attribute-group.service';

export interface AttributeGroupDeleteDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-attribute-group-delete-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './attribute-group-delete-dialog.component.html',
  styleUrl: './attribute-group-delete-dialog.component.scss',
})
export class AttributeGroupDeleteDialogComponent {
  data = inject<AttributeGroupDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<AttributeGroupDeleteDialogComponent, boolean>);
  private attributeGroupService = inject(AttributeGroupService);

  deleting = signal(false);

  confirm() {
    this.deleting.set(true);
    this.attributeGroupService.delete(this.data.id).subscribe({
      next: () => this.ref.close(true),
      error: () => this.deleting.set(false),
    });
  }
}
