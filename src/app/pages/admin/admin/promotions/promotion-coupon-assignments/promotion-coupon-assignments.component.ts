import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import { UserResponse } from '../../../../../core/auth/models/auth.types';
import { UserService } from '../../../../../features/users/user.service';
import { PromotionCouponAdminService } from '../../../../../features/promotions/promotion-coupon-admin.service';
import type { PromotionCouponAssignmentDto } from '../../../../../features/promotions/promotion-coupon-admin.types';

@Component({
  selector: 'app-promotion-coupon-assignments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './promotion-coupon-assignments.component.html',
  styleUrl: './promotion-coupon-assignments.component.scss',
})
export class PromotionCouponAssignmentsComponent implements OnInit {
  /** Активна лише для адміна (батьківський шаблон передає лише тоді). */
  promotionId = input.required<string>();

  private usersApi = inject(UserService);
  private couponAdmin = inject(PromotionCouponAdminService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  loading = signal(false);
  saving = signal(false);
  assignments = signal<PromotionCouponAssignmentDto[]>([]);

  userSearch = '';
  userSuggestions = signal<UserResponse[]>([]);
  searchLoading = signal(false);
  pickedUser = signal<UserResponse | null>(null);
  /** `type="number"` + ngModel може дати `number` — не покладаємось на `.trim()` без приведення. */
  addMaxUsage: string | number = '';
  addExpiresLocal = '';

  private search$ = new Subject<string>();

  ngOnInit(): void {
    this.reload();
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const t = q.trim();
          if (t.length < 2) {
            return of([] as UserResponse[]);
          }
          this.searchLoading.set(true);
          const parts = t.split(/\s+/).filter(Boolean);
          const filter =
            t.includes('@')
              ? { email: t }
              : parts.length >= 2
                ? { firstName: parts[0], lastName: parts.slice(1).join(' ') }
                : { firstName: t };
          return this.usersApi.searchUsers(filter).pipe(catchError(() => of([] as UserResponse[])));
        }),
      )
      .subscribe((list) => {
        this.userSuggestions.set(list ?? []);
        this.searchLoading.set(false);
      });
  }

  onUserSearchInput(v: string): void {
    this.userSearch = v;
    this.pickedUser.set(null);
    this.search$.next(v);
  }

  pickUser(u: UserResponse): void {
    this.pickedUser.set(u);
    const label = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
    this.userSearch = `${label} (${u.email})`;
    this.userSuggestions.set([]);
  }

  clearPick(): void {
    this.pickedUser.set(null);
    this.userSearch = '';
    this.userSuggestions.set([]);
  }

  reload(): void {
    const id = this.promotionId();
    if (!id) return;
    this.loading.set(true);
    this.couponAdmin
      .getCoupon(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        catchError(() => {
          this.assignments.set([]);
          return of(null);
        }),
      )
      .subscribe((dto) => {
        this.assignments.set(dto?.assignments ?? []);
      });
  }

  submitAdd(): void {
    const u = this.pickedUser();
    if (!u?.id || this.saving()) return;
    this.saving.set(true);
    const maxU = String(this.addMaxUsage ?? '').trim();
    const exp = String(this.addExpiresLocal ?? '').trim();
    this.couponAdmin
      .addAssignment(this.promotionId(), {
        userId: u.id,
        maxUsagePerUser: maxU ? Math.max(1, Number(maxU)) : undefined,
        expiresAt: exp ? new Date(exp).toISOString() : undefined,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        catchError(() => {
          this.snack.open(this.translate.instant('ADMIN.PROMOTION.COUPON_ASSIGN_ERROR'), 'OK', {
            duration: 4000,
          });
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.clearPick();
        this.addMaxUsage = '';
        this.addExpiresLocal = '';
        this.snack.open(this.translate.instant('ADMIN.PROMOTION.COUPON_ASSIGN_OK'), 'OK', {
          duration: 2500,
        });
        this.reload();
      });
  }

  removeRow(a: PromotionCouponAssignmentDto): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.couponAdmin
      .deleteAssignment(this.promotionId(), a.id)
      .pipe(
        finalize(() => this.saving.set(false)),
        catchError(() => {
          this.snack.open(this.translate.instant('ADMIN.PROMOTION.COUPON_ASSIGN_DELETE_ERROR'), 'OK', {
            duration: 4000,
          });
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.reload();
      });
  }

  displayName(a: PromotionCouponAssignmentDto): string {
    const n = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
    if (n) return n;
    if (a.userName?.trim()) return a.userName.trim();
    return a.email ?? a.userId;
  }
}
