import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, map, startWith } from 'rxjs';
import { ReviewService } from '../../../../features/reviews/review.service';
import { ReviewDto } from '../../../../features/reviews/review.types';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';
import {
  catalogStateBadgeKey,
  resolveOrderLineCatalogState,
  isArchivedFromSaleState,
  isMissingFromDatabaseState,
} from '../../../../features/products/product-catalog-display';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { MediaImageThumbComponent } from '../shared/media-image-thumb/media-image-thumb.component';
import { AdminReviewCommentOverflowDirective } from './admin-review-comment-overflow.directive';

type RatingFilter = '' | '1' | '2' | '3' | '4' | '5';
type ModerationFilter = 'all' | 'pending' | 'allowed' | 'rejected';
type SortColumn = 'productName' | 'rating' | 'comment' | 'createdAt';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
    MatSortModule,
    MatProgressSpinnerModule,
    HorizontalDragScrollDirective,
    AdminReviewCommentOverflowDirective,
    MediaImageThumbComponent,
  ],
  templateUrl: './reviews.html',
  styleUrl: './reviews.scss',
})
export class AdminReviewsComponent {
  private reviewsApi = inject(ReviewService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  filterForm = this.fb.group({
    productSearch: [''],
    rating: this.fb.nonNullable.control<RatingFilter>(''),
    moderation: this.fb.nonNullable.control<ModerationFilter>('all'),
  });

  /** Щоб computed перераховувався при зміні фільтрів. */
  private filterSnapshot = toSignal(
    this.filterForm.valueChanges.pipe(
      startWith(this.filterForm.getRawValue()),
      map(() => this.filterForm.getRawValue()),
    ),
    { initialValue: this.filterForm.getRawValue() },
  );

  loading = signal(true);
  items = signal<ReviewDto[]>([]);
  totalCount = signal(0);
  page = signal(1);
  readonly pageSize = 20;
  pendingAction = signal<{ id: string; kind: 'approve' | 'reject' | 'delete' } | null>(null);
  bulkBusy = signal(false);

  /** Розгорнуті коментарі (id відгуку). */
  expandedCommentIds = signal<ReadonlySet<string>>(new Set());

  /** Коментарі, де виміряно переповнення одного рядка (показ «…ще» / «сховати»). */
  private commentOverflowIds = signal<ReadonlySet<string>>(new Set());

  displayedColumns: string[] = ['productName', 'rating', 'comment', 'createdAt', 'actions'];

  /** Сортування на поточній сторінці (після клієнтських фільтрів). */
  sortState = signal<{ active: SortColumn; direction: 'asc' | 'desc' }>({
    active: 'createdAt',
    direction: 'desc',
  });

  filteredRows = computed(() => {
    this.filterSnapshot();
    const rows = this.items();
    const raw = this.filterForm.getRawValue();
    const q = (raw.productSearch ?? '').trim().toLowerCase();
    const rating = raw.rating;
    const mod = raw.moderation ?? 'all';

    return rows.filter((r) => {
      if (mod === 'pending' && !this.isPendingModeration(r)) return false;
      if (mod === 'allowed' && !r.isApproved) return false;
      if (mod === 'rejected' && !this.isRejectedReview(r)) return false;
      if (rating && String(r.rating) !== rating) return false;
      if (q && !(r.productName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  displayRows = computed(() => {
    const rows = [...this.filteredRows()];
    const { active, direction } = this.sortState();
    const mul = direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (active) {
        case 'productName':
          cmp = (a.productName ?? '').localeCompare(b.productName ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'rating':
          cmp = (Number(a.rating) || 0) - (Number(b.rating) || 0);
          break;
        case 'comment':
          cmp = (a.comment ?? '').localeCompare(b.comment ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'createdAt': {
          const ta = Date.parse(a.createdAt ?? '') || 0;
          const tb = Date.parse(b.createdAt ?? '') || 0;
          cmp = ta - tb;
          break;
        }
        default:
          break;
      }
      return cmp * mul;
    });
    return rows;
  });

  bulkApproveTargets = computed(() =>
    this.filteredRows().filter((r) => this.canApprove(r) && !this.isCancelledOrderRow(r)),
  );

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  constructor() {
    this.load();
  }

  onSortChange(ev: Sort): void {
    const valid: SortColumn[] = ['productName', 'rating', 'comment', 'createdAt'];
    const active = valid.includes(ev.active as SortColumn) ? (ev.active as SortColumn) : 'createdAt';
    const direction: 'asc' | 'desc' =
      ev.direction === 'asc' || ev.direction === 'desc' ? ev.direction : 'desc';
    this.sortState.set({ active, direction });
  }

  /** Стан з `ReviewResponseDto`; без нових полів API — відкат у {@link resolveOrderLineCatalogState}. */
  private reviewCatalogState(r: ReviewDto) {
    return resolveOrderLineCatalogState({
      existsInCatalog: r.productExistsInCatalog,
      isActive: r.productIsActive ?? undefined,
      catalogDisplayState: r.productCatalogDisplayState,
    });
  }

  reviewProductHref(r: ReviewDto): string | null {
    const st = this.reviewCatalogState(r);
    if (isMissingFromDatabaseState(st)) return null;
    if (isArchivedFromSaleState(st)) {
      return this.router.serializeUrl(this.router.createUrlTree(['/admin/products', r.productId]));
    }
    const slug = r.productSlug?.trim();
    if (slug) {
      return this.router.serializeUrl(this.router.createUrlTree(['/products', slug]));
    }
    return this.router.serializeUrl(this.router.createUrlTree(['/admin/products', r.productId]));
  }

  reviewProductBadgeKey(r: ReviewDto): string | null {
    const st = this.reviewCatalogState(r);
    return st === 'activeInCatalog' ? null : catalogStateBadgeKey(st);
  }

  isRejectedReview(r: ReviewDto): boolean {
    if (r.isRejected === true) return true;
    const st = (r.moderationStatus ?? '').trim().toLowerCase();
    return st === 'rejected' || st === 'declined' || st === 'cancelled';
  }

  isCancelledOrderRow(r: ReviewDto): boolean {
    const s = (r.orderStatus ?? '').trim().toLowerCase();
    return s === 'cancelled';
  }

  /** Очікує рішення модератора (не опубліковано й не відхилено). */
  isPendingModeration(r: ReviewDto): boolean {
    return !r.isApproved && !this.isRejectedReview(r);
  }

  /** Вже схвалено або відхилено — лише видалення. */
  isModeratedFinal(r: ReviewDto): boolean {
    return r.isApproved || this.isRejectedReview(r);
  }

  canApprove(r: ReviewDto): boolean {
    return this.isPendingModeration(r);
  }

  canReject(r: ReviewDto): boolean {
    return this.isPendingModeration(r);
  }

  canDelete(r: ReviewDto): boolean {
    return this.isModeratedFinal(r);
  }

  load(): void {
    this.loading.set(true);
    this.reviewsApi.getAdminAll(this.page(), this.pageSize).subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.totalCount.set(res.totalCount ?? 0);
        this.expandedCommentIds.set(new Set());
        this.commentOverflowIds.set(new Set());
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.LIST_LOAD_ERROR'), undefined, {
          duration: 4000,
        });
        if (err.error) console.error(err.error);
      },
    });
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  approve(r: ReviewDto): void {
    if (this.pendingAction() || !this.canApprove(r)) return;
    this.pendingAction.set({ id: r.id, kind: 'approve' });
    this.reviewsApi.approve(r.id).subscribe({
      next: () => {
        this.pendingAction.set(null);
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.APPROVE_OK'), undefined, { duration: 2500 });
        this.load();
      },
      error: () => {
        this.pendingAction.set(null);
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.APPROVE_FAIL'), undefined, { duration: 4000 });
      },
    });
  }

  reject(r: ReviewDto): void {
    if (this.pendingAction() || !this.canReject(r)) return;
    this.pendingAction.set({ id: r.id, kind: 'reject' });
    this.reviewsApi.reject(r.id).subscribe({
      next: () => {
        this.pendingAction.set(null);
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.REJECT_OK'), undefined, { duration: 2500 });
        this.load();
      },
      error: () => {
        this.pendingAction.set(null);
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.REJECT_FAIL'), undefined, { duration: 4000 });
      },
    });
  }

  confirmDeleteReview(r: ReviewDto): void {
    if (this.pendingAction() || !this.canDelete(r)) return;
    const ref = this.dialog.open<AdminConfirmDeleteDialogComponent, AdminConfirmDeleteDialogData, boolean>(
      AdminConfirmDeleteDialogComponent,
      {
        width: 'min(440px, 100vw)',
        data: {
          titleKey: 'ADMIN.REVIEWS_PAGE.DELETE_TITLE',
          messageKey: 'ADMIN.REVIEWS_PAGE.DELETE_MSG',
          messageParams: { name: r.productName },
        },
      },
    );
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.pendingAction.set({ id: r.id, kind: 'delete' });
      this.reviewsApi.deleteReview(r.id).subscribe({
        next: () => {
          this.pendingAction.set(null);
          this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.DELETE_OK'), undefined, { duration: 2500 });
          this.load();
        },
        error: () => {
          this.pendingAction.set(null);
          this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.DELETE_FAIL'), undefined, { duration: 4000 });
        },
      });
    });
  }

  commentBody(r: { comment: string | null }): string {
    return (r.comment ?? '').trim();
  }

  /** Не вміщується в один рядок (виміряно на згорнутому тексті). */
  commentNeedsToggle(r: { id: string; comment: string | null }): boolean {
    return this.commentBody(r) !== '' && this.commentOverflowIds().has(r.id);
  }

  onCommentOverflow(id: string, value: boolean): void {
    this.commentOverflowIds.update((cur) => {
      const has = cur.has(id);
      if (value === has) return cur;
      const next = new Set(cur);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  isCommentExpanded(id: string): boolean {
    return this.expandedCommentIds().has(id);
  }

  toggleCommentExpand(id: string, event?: Event): void {
    event?.stopPropagation();
    this.expandedCommentIds.update((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  approveAll(): void {
    const targets = this.bulkApproveTargets();
    if (targets.length === 0 || this.bulkBusy()) {
      if (targets.length === 0) {
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.APPROVE_ALL_NONE'), undefined, {
          duration: 3000,
        });
      }
      return;
    }
    this.bulkBusy.set(true);
    forkJoin(targets.map((r) => this.reviewsApi.approve(r.id))).subscribe({
      next: () => {
        this.bulkBusy.set(false);
        this.snack.open(
          this.translate.instant('ADMIN.REVIEWS_PAGE.APPROVE_ALL_OK', { count: targets.length }),
          undefined,
          { duration: 3500 },
        );
        this.load();
      },
      error: () => {
        this.bulkBusy.set(false);
        this.snack.open(this.translate.instant('ADMIN.REVIEWS_PAGE.APPROVE_ALL_FAIL'), undefined, {
          duration: 4000,
        });
      },
    });
  }
}
