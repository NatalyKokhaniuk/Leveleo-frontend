import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { NewsletterService } from '../../../../features/newsletter/newsletter.service';
import { ActiveSubscriberDto } from '../../../../features/newsletter/newsletter.types';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './subscriptions.html',
})
export class AdminSubscriptionsComponent {
  private newsletter = inject(NewsletterService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  readonly auth = inject(AuthService);

  subscribers = signal<ActiveSubscriberDto[]>([]);
  loading = signal(true);
  search = signal('');
  page = signal(1);
  readonly pageSize = 15;

  /** Стовпець «Дії» лише для Admin. */
  displayedColumns = computed(() => {
    const base: string[] = ['email', 'fullName', 'subscribedAt', 'source', 'hasAccount'];
    return this.auth.isAdmin() ? [...base, 'actions'] : base;
  });

  deletingId = signal<string | null>(null);

  sortKey = signal<
    'email' | 'fullName' | 'subscribedAt' | 'source' | 'hasAccount' | null
  >(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  filteredSubscribers = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = [...this.subscribers()];
    if (term) {
      list = list.filter((s) => {
        const email = s.email?.toLowerCase() ?? '';
        const name = (s.fullName ?? '').toLowerCase();
        return email.includes(term) || name.includes(term);
      });
    }
    const key = this.sortKey();
    if (!key) return list;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let va: string | number | boolean = '';
      let vb: string | number | boolean = '';
      switch (key) {
        case 'email':
          va = (a.email ?? '').toLowerCase();
          vb = (b.email ?? '').toLowerCase();
          break;
        case 'fullName':
          va = (a.fullName ?? '').toLowerCase();
          vb = (b.fullName ?? '').toLowerCase();
          break;
        case 'subscribedAt':
          va = new Date(a.subscribedAt).getTime();
          vb = new Date(b.subscribedAt).getTime();
          break;
        case 'source':
          va = (a.source ?? '').toLowerCase();
          vb = (b.source ?? '').toLowerCase();
          break;
        case 'hasAccount':
          va = a.hasAccount ? 1 : 0;
          vb = b.hasAccount ? 1 : 0;
          break;
        default:
          return 0;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return sorted;
  });

  paginatedSubscribers = computed(() => {
    const all = this.filteredSubscribers();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredSubscribers().length / this.pageSize)),
  );

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.newsletter.getActiveSubscribers().subscribe({
      next: (list) => {
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime(),
        );
        this.subscribers.set(sorted);
        this.loading.set(false);
        this.clampPage();
      },
      error: () => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('ADMIN.SUBSCRIPTIONS_PAGE.LOAD_ERROR'), 'OK', {
          duration: 6000,
        });
      },
    });
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil(this.filteredSubscribers().length / this.pageSize));
    if (this.page() > total) {
      this.page.set(total);
    }
  }

  dash(value: string | null | undefined): string {
    return value?.trim() ? value : '—';
  }

  yesNo(has: boolean): string {
    return has
      ? this.translate.instant('ADMIN.SUBSCRIPTIONS_PAGE.YES')
      : this.translate.instant('ADMIN.SUBSCRIPTIONS_PAGE.NO');
  }

  changeSort(key: 'email' | 'fullName' | 'subscribedAt' | 'source' | 'hasAccount'): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.page.set(1);
  }

  sortIndicator(key: 'email' | 'fullName' | 'subscribedAt' | 'source' | 'hasAccount'): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  confirmRemove(row: ActiveSubscriberDto): void {
    if (!this.auth.isAdmin()) return;

    const data: AdminConfirmDeleteDialogData = {
      messageKey: 'ADMIN.SUBSCRIPTIONS_PAGE.DELETE_CONFIRM',
      messageParams: { email: row.email },
    };
    this.dialog
      .open(AdminConfirmDeleteDialogComponent, {
        width: 'min(440px, 100vw)',
        data,
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.deletingId.set(row.id);
        this.newsletter.adminUnsubscribeByEmail(row.email).subscribe({
          next: () => {
            this.deletingId.set(null);
            this.subscribers.update((list) => list.filter((s) => s.id !== row.id));
            this.clampPage();
          },
          error: (err: unknown) => {
            this.deletingId.set(null);
            if (err instanceof HttpErrorResponse && err.status === 404) {
              this.snack.open(
                this.translate.instant('ADMIN.SUBSCRIPTIONS_PAGE.DELETE_NOT_FOUND'),
                'OK',
                { duration: 6000 },
              );
              return;
            }
            this.snack.open(this.translate.instant('ADMIN.SUBSCRIPTIONS_PAGE.DELETE_ERROR'), 'OK', {
              duration: 6000,
            });
          },
        });
      });
  }
}
