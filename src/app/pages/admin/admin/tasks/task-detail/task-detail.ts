import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../../core/auth/services/auth.service';
import { UserService } from '../../../../../features/users/user.service';
import { AdminTaskService } from '../../../../../features/admin-tasks/admin-task.service';
import { AdminTaskResponseDto } from '../../../../../features/admin-tasks/admin-task.types';
import {
  CancelTaskDialogComponent,
  CancelTaskDialogData,
} from '../cancel-task-dialog/cancel-task-dialog.component';
import {
  CompleteTaskDialogComponent,
  CompleteTaskDialogData,
} from '../complete-task-dialog/complete-task-dialog.component';
import { canShowAssignToMe } from '../task-assign';
import {
  taskPriorityLabel,
  taskStatusLabel,
  taskTypeLabel,
} from '../task-labels';

@Component({
  selector: 'app-admin-task-detail',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './task-detail.html',
})
export class AdminTaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private adminTasks = inject(AdminTaskService);
  private auth = inject(AuthService);
  private users = inject(UserService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  task = signal<AdminTaskResponseDto | null>(null);
  assigneeLabel = signal<string | null>(null);
  loading = signal(true);
  notFound = signal(false);
  actionLoading = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('taskId');
    if (!id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.fetchTask(id);
  }

  private fetchTask(id: string) {
    this.loading.set(true);
    this.notFound.set(false);
    this.adminTasks.getById(id).subscribe({
      next: (t) => {
        this.task.set(t);
        this.loading.set(false);
        this.assigneeLabel.set(null);
        const aid = t.assignedTo?.trim();
        if (aid) {
          this.users.getUserById(aid).subscribe({
            next: (u) => {
              const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
              this.assigneeLabel.set(name || u.email || aid);
            },
            error: () => this.assigneeLabel.set(aid),
          });
        }
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  canAssign(t: AdminTaskResponseDto): boolean {
    return canShowAssignToMe(t, this.auth.currentUser()?.id);
  }

  /** Лише після «Взяти в роботу» (статус InProgress). */
  canComplete(t: AdminTaskResponseDto): boolean {
    return t.status === 'InProgress';
  }

  canCancel(t: AdminTaskResponseDto): boolean {
    return t.status === 'Pending' || t.status === 'InProgress';
  }

  assign() {
    const t = this.task();
    if (!t) return;
    this.actionLoading.set(true);
    this.adminTasks.assignToMe(t.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.snack.open(this.translate.instant('ADMIN.TASKS_PAGE.ASSIGN_OK'), 'OK', { duration: 4000 });
        this.fetchTask(t.id);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.snack.open(this.mapError(err), 'OK', { duration: 6000 });
      },
    });
  }

  openComplete() {
    const t = this.task();
    if (!t) return;
    const ref = this.dialog.open(CompleteTaskDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      data: { taskId: t.id, title: t.title } satisfies CompleteTaskDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.snack.open(this.translate.instant('ADMIN.TASKS_PAGE.COMPLETE_OK'), 'OK', { duration: 4000 });
        this.fetchTask(t.id);
      }
    });
  }

  openCancel() {
    const t = this.task();
    if (!t) return;
    const ref = this.dialog.open(CancelTaskDialogComponent, {
      panelClass: 'auth-dialog',
      maxWidth: '400px',
      data: { taskId: t.id, title: t.title } satisfies CancelTaskDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.snack.open(this.translate.instant('ADMIN.TASKS_PAGE.CANCEL_OK'), 'OK', { duration: 4000 });
        this.fetchTask(t.id);
      }
    });
  }

  typeLabel(row: AdminTaskResponseDto): string {
    return taskTypeLabel(this.translate, row);
  }

  statusLabel(row: AdminTaskResponseDto): string {
    return taskStatusLabel(this.translate, row);
  }

  priorityLabel(row: AdminTaskResponseDto): string {
    return taskPriorityLabel(this.translate, row);
  }

  assigneeText(t: AdminTaskResponseDto): string {
    if (!t.assignedTo?.trim()) return '—';
    return this.assigneeLabel() ?? t.assignedTo;
  }

  /** Розбір metadata для тасків зворотного зв’язку (JSON з бекенду). */
  contactFormMeta(t: AdminTaskResponseDto): {
    phone: string | null;
    category: string | null;
  } | null {
    if (t.type !== 'HandleContactForm' && t.relatedEntityType !== 'ContactForm') {
      return null;
    }
    const raw = t.metadata?.trim();
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as { Phone?: string | null; Category?: string };
      const phone = typeof o.Phone === 'string' && o.Phone.trim() ? o.Phone.trim() : null;
      const category = typeof o.Category === 'string' && o.Category.trim() ? o.Category.trim() : null;
      if (!phone && !category) return null;
      return { phone, category };
    } catch {
      return null;
    }
  }

  contactCategoryLabel(enumName: string): string {
    const map: Record<string, string> = {
      DeliveryQuestion: 'CONTACTS.CATEGORY.DELIVERY',
      OrderQuestion: 'CONTACTS.CATEGORY.ORDER',
      ReturnOrExchange: 'CONTACTS.CATEGORY.RETURN',
      ProductQuestion: 'CONTACTS.CATEGORY.PRODUCT',
      WebsiteQuestion: 'CONTACTS.CATEGORY.WEBSITE',
      PaymentQuestion: 'CONTACTS.CATEGORY.PAYMENT',
      Other: 'CONTACTS.CATEGORY.OTHER',
    };
    const key = map[enumName];
    return key ? this.translate.instant(key) : enumName;
  }

  showCompletionSection(t: AdminTaskResponseDto): boolean {
    return !!(t.completedAt || t.completionNote?.trim());
  }

  private mapError(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
      const body = err.error as { message?: string; code?: string };
      if (typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
      if (typeof body.code === 'string') {
        const key = `ERRORS.${body.code}`;
        const translated = this.translate.instant(key);
        if (translated !== key) return translated;
      }
    }
    return this.translate.instant('ADMIN.TASKS_PAGE.ACTION_ERROR');
  }
}
