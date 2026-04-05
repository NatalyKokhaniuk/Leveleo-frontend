import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

export interface AdminConfirmDeleteDialogData {
  /** Defaults to ADMIN.CONFIRM_DELETE.TITLE */
  titleKey?: string;
  /** Defaults to ADMIN.CONFIRM_DELETE.MESSAGE */
  messageKey?: string;
  messageParams?: Record<string, string | number | undefined>;
}

@Component({
  selector: 'app-admin-confirm-delete-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './admin-confirm-delete-dialog.component.html',
  styleUrl: './admin-confirm-delete-dialog.component.scss',
})
export class AdminConfirmDeleteDialogComponent {
  ref = inject(MatDialogRef<AdminConfirmDeleteDialogComponent, boolean>);
  private rawData = inject<AdminConfirmDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  private get data(): AdminConfirmDeleteDialogData {
    return this.rawData ?? {};
  }

  titleKey(): string {
    return this.data.titleKey ?? 'ADMIN.CONFIRM_DELETE.TITLE';
  }

  messageKey(): string {
    return this.data.messageKey ?? 'ADMIN.CONFIRM_DELETE.MESSAGE';
  }

  messageParams(): Record<string, string | number | undefined> {
    return this.data.messageParams ?? {};
  }
}
