import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AdminTaskService } from '../../../../../features/admin-tasks/admin-task.service';

export interface CompleteTaskDialogData {
  taskId: string;
  title: string;
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

  saving = signal(false);

  form = this.fb.nonNullable.group({
    completionNote: [''],
  });

  submit() {
    const note = this.form.get('completionNote')?.value?.trim();
    this.saving.set(true);
    this.adminTasks
      .complete(this.data.taskId, {
        completionNote: note ? note : null,
      })
      .subscribe({
        next: () => this.ref.close(true),
        error: () => this.saving.set(false),
      });
  }
}
