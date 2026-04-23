import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReviewService } from '../../../features/reviews/review.service';
import { ReviewDto } from '../../../features/reviews/review.types';

@Component({
  selector: 'app-order-item-review-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './order-item-review-form.component.html',
  styleUrl: './order-item-review-form.component.scss',
})
export class OrderItemReviewFormComponent implements OnInit {
  private reviews = inject(ReviewService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialogRef = inject(MatDialogRef<unknown>, { optional: true });

  /** Order line this review is tied to. */
  orderItemId = input.required<string>();

  saved = output<void>();

  loading = signal(true);
  saving = signal(false);
  existing = signal<ReviewDto | null>(null);
  rating = signal(5);

  form = this.fb.group({
    comment: [''],
  });

  ngOnInit(): void {
    const oid = this.orderItemId();
    this.reviews.getByOrderItem(oid).subscribe({
      next: (rev) => {
        this.existing.set(rev);
        if (rev) {
          this.rating.set(Math.min(5, Math.max(1, rev.rating)));
          this.form.patchValue({ comment: rev.comment ?? '' });
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status !== 404) {
          this.snack.open(this.translate.instant('ORDER_VIEW.REVIEW_LOAD_ERROR'), undefined, {
            duration: 4000,
          });
        }
      },
    });
  }

  setRating(value: number): void {
    this.rating.set(Math.min(5, Math.max(1, value)));
  }

  submit(): void {
    if (this.saving()) return;
    const oid = this.orderItemId();
    const commentRaw = this.form.value.comment?.trim();
    const comment = commentRaw ? commentRaw : null;
    const r = this.rating();
    const existing = this.existing();

    this.saving.set(true);
    if (existing) {
      this.reviews
        .update(existing.id, {
          rating: r,
          comment,
          photoKeys: null,
          videoKeys: null,
        })
        .subscribe({
          next: (updated) => {
            this.existing.set(updated);
            this.saving.set(false);
            this.snack.open(this.translate.instant('ORDER_VIEW.REVIEW_SAVED'), undefined, { duration: 3000 });
            this.saved.emit();
            this.dialogRef?.close({ saved: true, updated: true });
          },
          error: () => {
            this.saving.set(false);
            this.snack.open(this.translate.instant('ORDER_VIEW.REVIEW_SAVE_ERROR'), undefined, {
              duration: 4000,
            });
          },
        });
    } else {
      this.reviews
        .create({
          orderItemId: oid,
          rating: r,
          comment,
          photoKeys: null,
          videoKeys: null,
        })
        .subscribe({
          next: (created) => {
            this.existing.set(created);
            this.saving.set(false);
            this.snack.open(this.translate.instant('ORDER_VIEW.REVIEW_SENT'), undefined, { duration: 3000 });
            this.saved.emit();
            this.dialogRef?.close({ saved: true });
          },
          error: () => {
            this.saving.set(false);
            this.snack.open(this.translate.instant('ORDER_VIEW.REVIEW_SAVE_ERROR'), undefined, {
              duration: 4000,
            });
          },
        });
    }
  }

  canEdit(): boolean {
    const ex = this.existing();
    return !ex || !ex.isApproved;
  }
}
