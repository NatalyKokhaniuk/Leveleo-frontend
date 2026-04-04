import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AdminTaskService } from '../../../../../features/admin-tasks/admin-task.service';

export interface CancelTaskDialogData {
  taskId: string;
  title: string;
}

@Component({
  selector: 'app-cancel-task-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslateModule],
  templateUrl: './cancel-task-dialog.component.html',
})
export class CancelTaskDialogComponent {
  data = inject<CancelTaskDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<CancelTaskDialogComponent, boolean>);
  private adminTasks = inject(AdminTaskService);

  cancelling = signal(false);

  confirm() {
    this.cancelling.set(true);
    this.adminTasks.cancel(this.data.taskId).subscribe({
      next: () => this.ref.close(true),
      error: () => this.cancelling.set(false),
    });
  }
}
