import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import type {
  CreateCouponAssignmentDto,
  PromotionCouponAdminDto,
  PromotionCouponAssignmentDto,
  UpdateCouponAssignmentDto,
  UpdatePromotionCouponAdminDto,
} from './promotion-coupon-admin.types';

function pick<T>(o: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  const v = o[camel] ?? o[pascal];
  return v as T | undefined;
}

/** Узгодження PascalCase з ASP.NET. */
export function normalizePromotionCouponAdminDto(raw: unknown): PromotionCouponAdminDto {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const assignmentsRaw = pick<unknown[]>(o, 'assignments', 'Assignments');
  const assignments: PromotionCouponAssignmentDto[] | undefined = Array.isArray(assignmentsRaw)
    ? assignmentsRaw.map((x) => {
        if (!x || typeof x !== 'object') {
          return { id: '', userId: '' };
        }
        const a = x as Record<string, unknown>;
        return {
          id: String(a['id'] ?? a['Id'] ?? ''),
          userId: String(a['userId'] ?? a['UserId'] ?? ''),
          email: (a['email'] ?? a['Email']) as string | null | undefined,
          userName: (a['userName'] ?? a['UserName']) as string | null | undefined,
          firstName: (a['firstName'] ?? a['FirstName']) as string | null | undefined,
          lastName: (a['lastName'] ?? a['LastName']) as string | null | undefined,
          maxUsagePerUser: numOpt(a['maxUsagePerUser'] ?? a['MaxUsagePerUser']),
          expiresAt: strOpt(a['expiresAt'] ?? a['ExpiresAt']),
        };
      })
    : undefined;

  return {
    couponCode: strOpt(pick(o, 'couponCode', 'CouponCode')),
    maxUsages: numOpt(pick(o, 'maxUsages', 'MaxUsages')),
    usedCount: numOpt(pick(o, 'usedCount', 'UsedCount')),
    isCoupon: boolOpt(pick(o, 'isCoupon', 'IsCoupon')),
    isPersonal: boolOpt(pick(o, 'isPersonal', 'IsPersonal')),
    promotionName: strOpt(pick(o, 'promotionName', 'PromotionName') ?? pick(o, 'name', 'Name')),
    promotionSlug: strOpt(pick(o, 'promotionSlug', 'PromotionSlug') ?? pick(o, 'slug', 'Slug')),
    assignments,
  };
}

function strOpt(v: unknown): string | null | undefined {
  if (v == null) return v as null | undefined;
  const s = String(v).trim();
  return s.length ? s : null;
}

function numOpt(v: unknown): number | null | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function boolOpt(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return undefined;
}

@Injectable({ providedIn: 'root' })
export class PromotionCouponAdminService {
  private api = inject(ApiService);

  /**
   * Шляхи до купона акції (без префікса `/api` — його додає `ApiService`).
   * Спочатку `PromotionsController`-стиль; при 404 — legacy `Admin.../promotions/.../coupon`.
   */
  private couponBases(promotionId: string): string[] {
    const id = encodeURIComponent(promotionId);
    return [`/promotions/${id}/coupon`, `/admin/promotions/${id}/coupon`];
  }

  /** Спробувати перший шлях; якщо 404 — другий (різні реєстрації маршруту на бекенді). */
  private tryCouponPaths<T>(promotionId: string, run: (couponPath: string) => Observable<T>): Observable<T> {
    const bases = this.couponBases(promotionId);
    return run(bases[0]).pipe(
      catchError((err: unknown) => {
        if (
          err instanceof HttpErrorResponse &&
          err.status === 404 &&
          bases.length > 1
        ) {
          return run(bases[1]);
        }
        return throwError(() => err);
      }),
    );
  }

  getCoupon(promotionId: string): Observable<PromotionCouponAdminDto> {
    return this.tryCouponPaths(promotionId, (path) =>
      this.api.get<unknown>(path).pipe(map((raw) => normalizePromotionCouponAdminDto(raw))),
    );
  }

  updateCoupon(promotionId: string, dto: UpdatePromotionCouponAdminDto): Observable<PromotionCouponAdminDto> {
    return this.tryCouponPaths(promotionId, (path) =>
      this.api.put<unknown>(path, dto).pipe(map((raw) => normalizePromotionCouponAdminDto(raw))),
    );
  }

  addAssignment(
    promotionId: string,
    dto: CreateCouponAssignmentDto,
  ): Observable<PromotionCouponAssignmentDto | void> {
    return this.tryCouponPaths(promotionId, (path) =>
      this.api.post<PromotionCouponAssignmentDto | void>(`${path}/assignments`, dto),
    );
  }

  updateAssignment(
    promotionId: string,
    assignmentId: string,
    dto: UpdateCouponAssignmentDto,
  ): Observable<unknown> {
    return this.tryCouponPaths(promotionId, (path) =>
      this.api.put(`${path}/assignments/${encodeURIComponent(assignmentId)}`, dto),
    );
  }

  deleteAssignment(promotionId: string, assignmentId: string): Observable<void> {
    return this.tryCouponPaths(promotionId, (path) =>
      this.api.delete<void>(`${path}/assignments/${encodeURIComponent(assignmentId)}`),
    );
  }
}
