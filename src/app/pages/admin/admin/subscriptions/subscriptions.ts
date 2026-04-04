import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NewsletterService } from '../../../../features/newsletter/newsletter.service';
import { ActiveSubscriberDto } from '../../../../features/newsletter/newsletter.types';

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
  ],
  templateUrl: './subscriptions.html',
})
export class AdminSubscriptionsComponent {
  private newsletter = inject(NewsletterService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  subscribers = signal<ActiveSubscriberDto[]>([]);
  loading = signal(true);
  search = signal('');
  page = signal(1);
  readonly pageSize = 15;

  displayedColumns: string[] = ['email', 'fullName', 'subscribedAt', 'source', 'hasAccount'];

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
    return list;
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
}
