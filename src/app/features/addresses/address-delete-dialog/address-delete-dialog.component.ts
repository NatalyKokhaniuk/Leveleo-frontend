import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

export interface AddressDeleteDialogData {
  /** Рядок для відображення (наприклад formattedAddress). */
  label: string;
}

@Component({
  selector: 'app-address-delete-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslateModule],
  templateUrl: './address-delete-dialog.component.html',
})
export class AddressDeleteDialogComponent {
  data = inject<AddressDeleteDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<AddressDeleteDialogComponent, boolean>);
}
