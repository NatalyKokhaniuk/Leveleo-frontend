import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export interface BackupCodesDialogData {
  codes: string[];
}

@Component({
  selector: 'app-backup-codes-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslateModule],
  templateUrl: './backup-codes-dialog.component.html',
  styleUrl: './backup-codes-dialog.component.scss',
})
export class BackupCodesDialogComponent {
  data = inject<BackupCodesDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<BackupCodesDialogComponent>);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  copied = signal(false);

  get codes(): string[] {
    return this.data?.codes ?? [];
  }

  copyAll() {
    const text = this.codes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      this.translate.get('AUTH.BACKUP_CODES_COPIED').subscribe((msg) => {
        this.snack.open(msg, undefined, { duration: 2500 });
      });
      setTimeout(() => this.copied.set(false), 3000);
    });
  }

  close() {
    this.dialogRef.close();
  }
}
