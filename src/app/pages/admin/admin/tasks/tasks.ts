import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserService } from '../../../../features/users/user.service';
import { AdminTaskService } from '../../../../features/admin-tasks/admin-task.service';
import { AdminTaskResponseDto } from '../../../../features/admin-tasks/admin-task.types';
import { canShowAssignToMe } from './task-assign';
import {
  taskPriorityLabel,
  taskPriorityOptionLabel,
  taskStatusLabel,
  taskStatusOptionLabel,
  taskTypeLabel,
  taskTypeOptionLabel,
} from './task-labels';

/** Імена enum як у C# / JSON (рядки). */
const STATUS_NAMES = ['Pending', 'InProgress', 'Completed', 'Cancelled'] as const;

const TYPE_NAMES = [
  'ModerateReview',
  'ShipOrder',
  'RefundOrder',
  'InvestigatePayment',
  'RestockProduct',
  'HandleContactForm',
  'Other',
] as const;

const PRIORITY_NAMES = ['Low', 'Normal', 'High', 'Critical'] as const;

@Component({
  selector: 'app-admin-tasks',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './tasks.html',
})
export class AdminTasksComponent {
  private adminTasks = inject(AdminTaskService);
  private users = inject(UserService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);

  loading = signal(true);
  items = signal<AdminTaskResponseDto[]>([]);
  totalCount = signal(0);
  /** Кеш id користувача → відображуване ім'я */
  assigneeNames = signal<Record<string, string>>({});

  page = signal(1);
  readonly pageSize = 20;

  statusFilter = signal<string | null>(null);
  typeFilter = signal<string | null>(null);
  priorityFilter = signal<string | null>(null);
  onlyMine = signal(false);

  actionLoadingId = signal<string | null>(null);

  displayedColumns: string[] = ['title', 'type', 'priority', 'status', 'assignedTo', 'createdAt', 'actions'];

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  readonly statusOptions = [...STATUS_NAMES];
  readonly typeOptions = [...TYPE_NAMES];
  readonly priorityOptions = [...PRIORITY_NAMES];

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const userId = this.auth.currentUser()?.id;
    const assignedTo = this.onlyMine() && userId ? userId : undefined;

    this.adminTasks
      .getTasks({
        page: this.page(),
        pageSize: this.pageSize,
        status: this.statusFilter() ?? undefined,
        type: this.typeFilter() ?? undefined,
        priority: this.priorityFilter() ?? undefined,
        assignedTo,
      })
      .subscribe({
        next: (res) => {
          const total = res.totalCount ?? 0;
          const list = res.items ?? [];
          this.items.set(list);
          this.totalCount.set(total);
          this.loading.set(false);
          this.resolveAssigneeNames(list);
          const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
          if (this.page() > maxPage) {
            this.page.set(maxPage);
            this.load();
          }
        },
        error: () => {
          this.loading.set(false);
          this.snack.open(this.translate.instant('ADMIN.TASKS_PAGE.LOAD_ERROR'), 'OK', { duration: 6000 });
        },
      });
  }

  private resolveAssigneeNames(rows: AdminTaskResponseDto[]) {
    const ids = [...new Set(rows.map((r) => r.assignedTo).filter((x): x is string => !!x?.trim()))];
    const cache = this.assigneeNames();
    const missing = ids.filter((id) => !cache[id]);
    if (missing.length === 0) return;

    forkJoin(
      missing.map((id) =>
        this.users.getUserById(id).pipe(
          map((u) => {
            const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
            return { id, label: name || u.email || id };
          }),
          catchError(() => of({ id, label: id })),
        ),
      ),
    ).subscribe((results) => {
      const next = { ...this.assigneeNames() };
      for (const r of results) {
        next[r.id] = r.label;
      }
      this.assigneeNames.set(next);
    });
  }

  onFilterChange() {
    this.page.set(1);
    this.load();
  }

  toggleOnlyMine(checked: boolean) {
    this.onlyMine.set(checked);
    this.page.set(1);
    this.load();
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  canAssign(row: AdminTaskResponseDto): boolean {
    return canShowAssignToMe(row, this.auth.currentUser()?.id);
  }

  assign(row: AdminTaskResponseDto) {
    this.actionLoadingId.set(row.id);
    this.adminTasks.assignToMe(row.id).subscribe({
      next: () => {
        this.actionLoadingId.set(null);
        this.snack.open(this.translate.instant('ADMIN.TASKS_PAGE.ASSIGN_OK'), 'OK', { duration: 4000 });
        this.load();
      },
      error: (err) => {
        this.actionLoadingId.set(null);
        this.snack.open(this.mapError(err), 'OK', { duration: 6000 });
      },
    });
  }

  statusLabel(row: AdminTaskResponseDto): string {
    return taskStatusLabel(this.translate, row);
  }

  typeLabel(row: AdminTaskResponseDto): string {
    return taskTypeLabel(this.translate, row);
  }

  priorityLabel(row: AdminTaskResponseDto): string {
    return taskPriorityLabel(this.translate, row);
  }

  statusOptionLabel(name: string): string {
    return taskStatusOptionLabel(this.translate, name);
  }

  typeOptionLabel(name: string): string {
    return taskTypeOptionLabel(this.translate, name);
  }

  priorityOptionLabel(name: string): string {
    return taskPriorityOptionLabel(this.translate, name);
  }

  assigneeDisplay(row: AdminTaskResponseDto): string {
    const id = row.assignedTo?.trim();
    if (!id) return '—';
    return this.assigneeNames()[id] ?? id;
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
