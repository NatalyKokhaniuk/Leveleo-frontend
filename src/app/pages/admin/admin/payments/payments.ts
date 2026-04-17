import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AdminConfirmDeleteDialogComponent,
  AdminConfirmDeleteDialogData,
} from '../../admin-confirm-delete-dialog/admin-confirm-delete-dialog.component';
import { PaymentService } from '../../../../features/payments/payment.service';
import { PaymentResponseDto } from '../../../../features/payments/payment.types';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './payments.html',
})
export class AdminPaymentsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private paymentsApi = inject(PaymentService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  lookupForm = this.fb.group({
    paymentId: ['', Validators.required],
  });

  refundForm = this.fb.group({
    amount: [''],
    reason: [''],
  });

  loading = signal(false);
  payment = signal<PaymentResponseDto | null>(null);

  actionLoading = signal(false);

  ngOnInit(): void {
    const fromQuery = this.route.snapshot.queryParamMap.get('paymentId')?.trim();
    if (fromQuery) {
      this.lookupForm.patchValue({ paymentId: fromQuery });
      this.loadById(fromQuery);
    }
  }

  load(): void {
    const id = this.lookupForm.value.paymentId?.trim();
    if (!id) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { paymentId: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadById(id);
  }

  private loadById(id: string): void {
    this.loading.set(true);
    this.payment.set(null);
    this.paymentsApi.getById(id).subscribe({
      next: (p) => {
        this.payment.set(p);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.LOAD_ERROR'), undefined, { duration: 4000 });
      },
    });
  }

  goOrder(): void {
    const oid = this.payment()?.orderId;
    if (oid) void this.router.navigate(['/admin/orders', oid]);
  }

  confirmCancel(): void {
    const p = this.payment();
    if (!p) return;
    const ref = this.dialog.open<AdminConfirmDeleteDialogComponent, AdminConfirmDeleteDialogData, boolean>(
      AdminConfirmDeleteDialogComponent,
      {
        width: 'min(440px, 100vw)',
        data: {
          titleKey: 'ADMIN.PAYMENTS_PAGE.CANCEL_TITLE',
          messageKey: 'ADMIN.PAYMENTS_PAGE.CANCEL_MSG',
        },
      },
    );
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.actionLoading.set(true);
      this.paymentsApi.cancel(p.id).subscribe({
        next: (updated) => {
          this.payment.set(updated);
          this.actionLoading.set(false);
          this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.CANCEL_OK'), undefined, { duration: 3000 });
        },
        error: (err: HttpErrorResponse) => {
          this.actionLoading.set(false);
          this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.CANCEL_FAIL'), undefined, { duration: 4000 });
          if (err.error) console.error(err.error);
        },
      });
    });
  }

  submitRefund(): void {
    const p = this.payment();
    if (!p) return;
    const raw = this.refundForm.value.amount?.trim();
    let amount: number | undefined;
    if (raw) {
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) {
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.REFUND_AMOUNT_INVALID'), undefined, {
          duration: 4000,
        });
        return;
      }
      amount = n;
    }
    const reason = this.refundForm.value.reason?.trim() || undefined;
    this.actionLoading.set(true);
    this.paymentsApi.refund(p.id, { amount, reason }).subscribe({
      next: (updated) => {
        this.payment.set(updated);
        this.refundForm.reset();
        this.actionLoading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.REFUND_OK'), undefined, { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.actionLoading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PAYMENTS_PAGE.REFUND_FAIL'), undefined, { duration: 4000 });
        if (err.error) console.error(err.error);
      },
    });
  }
}
