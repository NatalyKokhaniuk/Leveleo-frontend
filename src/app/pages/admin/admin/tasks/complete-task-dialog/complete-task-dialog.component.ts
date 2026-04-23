import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { AdminTaskService } from '../../../../../features/admin-tasks/admin-task.service';
import { DeliveryService } from '../../../../../features/orders/delivery.service';

export interface CompleteTaskDialogData {
  taskId: string;
  title: string;
  taskType?: string;
  relatedEntityId?: string | null;
}

@Component({
  selector: 'app-complete-task-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './complete-task-dialog.component.html',
})
export class CompleteTaskDialogComponent {
  data = inject<CompleteTaskDialogData>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<CompleteTaskDialogComponent, boolean>);
  private fb = inject(FormBuilder);
  private adminTasks = inject(AdminTaskService);
  private deliveries = inject(DeliveryService);
  private translate = inject(TranslateService);

  saving = signal(false);

  form = this.fb.nonNullable.group({
    completionNote: [''],
    trackingNumber: [''],
  });

  isShipOrderTask(): boolean {
    return this.data.taskType === 'ShipOrder' && !!this.data.relatedEntityId?.trim();
  }

  submit() {
    const note = this.form.get('completionNote')?.value?.trim();
    const tracking = this.form.get('trackingNumber')?.value?.trim();
    this.saving.set(true);
    if (this.isShipOrderTask()) {
      const orderId = this.data.relatedEntityId?.trim() ?? '';
      if (!tracking) {
        this.saving.set(false);
        return;
      }
      const shippedPrefix = this.translate.instant('ADMIN.TASKS_PAGE.SHIPPED_NOTE_PREFIX');
      const shipmentNote = `${shippedPrefix}${tracking}`;
      const completionNote = note ? `${shipmentNote}\n${note}` : shipmentNote;
      this.deliveries.createManualForOrder(orderId, tracking).subscribe({
        next: () => this.completeTask(completionNote),
        error: () => this.saving.set(false),
      });
      return;
    }
    this.completeTask(note ? note : null);
  }

  private completeTask(completionNote: string | null) {
    this.adminTasks.complete(this.data.taskId, { completionNote }).subscribe({
      next: () => this.ref.close(true),
      error: () => this.saving.set(false),
    });
  }
}
