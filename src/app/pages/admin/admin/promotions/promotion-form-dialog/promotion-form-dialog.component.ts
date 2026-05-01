import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, from, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../../core/auth/services/auth.service';
import { MediaService } from '../../../../../core/services/media.service';
import { PromotionCouponAdminService } from '../../../../../features/promotions/promotion-coupon-admin.service';
import type {
  PromotionCouponAdminDto,
  UpdatePromotionCouponAdminDto,
} from '../../../../../features/promotions/promotion-coupon-admin.types';
import {
  catalogStateBadgeKey,
  resolveOrderLineCatalogState,
  isArchivedFromSaleState,
  isMissingFromDatabaseState,
} from '../../../../../features/products/product-catalog-display';
import { PromotionService } from '../../../../../features/promotions/promotion.service';
import {
  CartLevelConditionDto,
  CreatePromotionDto,
  DiscountType,
  ProductLevelConditionDto,
  PromotionLevel,
  PromotionReferencedProductDto,
  PromotionResponseDto,
  PromotionTranslationDto,
  UpdatePromotionDto,
} from '../../../../../features/promotions/promotion.types';
import { toDiscountType, toPromotionLevel } from '../../../../../features/promotions/promotion-enum.util';
import {
  guidListToCsv,
  invalidGuidsInCsv,
  parseGuidCsv,
} from '../../../../../features/promotions/promotion-optional.util';
import { PromotionCouponAssignmentsComponent } from '../promotion-coupon-assignments/promotion-coupon-assignments.component';
import { PromotionEntityIdsPickerComponent } from '../promotion-entity-ids-picker/promotion-entity-ids-picker.component';

export interface PromotionFormDialogData {
  mode: 'create' | 'edit';
  promotion: PromotionResponseDto | null;
}

/**
 * Значення `datetime-local` без зони — парсимо як локальний календарний час.
 * `new Date("...T..:..")` у частини браузерів трактує рядок інакше й дає зсув відносно API.
 */
function parseDatetimeLocalInput(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = m[6] != null ? Number(m[6]) : 0;
  const dt = new Date(y, mo, d, hh, mm, ss, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Лише однаковий момент часу — невалідно; різний порядок у полях виправляється при відправці. */
function datesEqualValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  const ds = parseDatetimeLocalInput(start);
  const de = parseDatetimeLocalInput(end);
  if (!ds || !de) {
    return null;
  }
  if (ds.getTime() === de.getTime()) {
    return { datesEqual: true };
  }
  return null;
}

@Component({
  selector: 'app-promotion-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatCheckboxModule,
    TranslateModule,
    PromotionEntityIdsPickerComponent,
    PromotionCouponAssignmentsComponent,
    RouterLink,
  ],
  templateUrl: './promotion-form-dialog.component.html',
  styleUrl: './promotion-form-dialog.component.scss',
})
export class PromotionFormDialogComponent implements OnInit, OnDestroy {
  data = inject<PromotionFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private promotionService = inject(PromotionService);
  private couponAdmin = inject(PromotionCouponAdminService);
  private auth = inject(AuthService);
  private dialogRef = inject(MatDialogRef<PromotionFormDialogComponent, boolean>);
  private mediaService = inject(MediaService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  /** Лише адмін керує персональною акцією та призначеннями через купон-ендпоінт (див. `PromotionCouponAdminService`). */
  readonly isAdmin = this.auth.isAdmin;

  saving = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  /** Останній знімок з getById (переклади для upsert). */
  private promotionSnapshot: PromotionResponseDto | null = null;
  /** GET купона — лічильник і поля (шлях на бекенді: promotions або admin/promotions). */
  couponAdminSnapshot = signal<PromotionCouponAdminDto | null>(null);
  isUploadingImage = signal(false);
  imagePreviewUrl = signal<string | null>(null);
  private imagePreviewBlobUrl: string | null = null;

  readonly PromotionLevel = PromotionLevel;
  readonly DiscountType = DiscountType;

  readonly levelOptions = [
    { value: PromotionLevel.Product, labelKey: 'ADMIN.PROMOTION.LEVEL_PRODUCT' },
    { value: PromotionLevel.Cart, labelKey: 'ADMIN.PROMOTION.LEVEL_CART' },
  ];

  readonly discountOptions = [
    { value: DiscountType.Percentage, labelKey: 'ADMIN.PROMOTION.DISCOUNT_PERCENT' },
    { value: DiscountType.FixedAmount, labelKey: 'ADMIN.PROMOTION.DISCOUNT_FIXED' },
  ];

  referencedPromotionProducts(): PromotionReferencedProductDto[] {
    const raw = this.data.promotion?.referencedProducts;
    return Array.isArray(raw) ? raw : [];
  }

  referencedProductLabel(row: PromotionReferencedProductDto): string {
    return row.name?.trim() || row.productId;
  }

  referencedProductBadgeKey(row: PromotionReferencedProductDto): string {
    return catalogStateBadgeKey(
      resolveOrderLineCatalogState({
        existsInCatalog: row.existsInCatalog,
        isActive: row.isActive ?? undefined,
        catalogDisplayState: row.catalogDisplayState,
      }),
    );
  }

  referencedProductStoreSegments(row: PromotionReferencedProductDto): string[] | null {
    const st = resolveOrderLineCatalogState({
      existsInCatalog: row.existsInCatalog,
      isActive: row.isActive ?? undefined,
      catalogDisplayState: row.catalogDisplayState,
    });
    if (isMissingFromDatabaseState(st) || isArchivedFromSaleState(st)) return null;
    const slug = row.slug?.trim();
    return slug ? ['/products', slug] : null;
  }

  referencedProductAdminSegments(row: PromotionReferencedProductDto): string[] | null {
    const st = resolveOrderLineCatalogState({
      existsInCatalog: row.existsInCatalog,
      isActive: row.isActive ?? undefined,
      catalogDisplayState: row.catalogDisplayState,
    });
    if (isMissingFromDatabaseState(st)) return null;
    return ['/admin/products', row.productId];
  }

  form = this.fb.nonNullable.group(
    {
      nameEn: ['', Validators.required],
      descriptionEn: [''],
      nameUk: [''],
      descriptionUk: [''],
      imageKey: [''],
      level: [PromotionLevel.Product, Validators.required],
      discountType: [DiscountType.Percentage, Validators.required],
      /** `null` — порожнє поле; `0` на blur скидається в `null` (`onDiscountBlur`). */
      discountValue: new FormControl<number | null>(null, {
        validators: [Validators.required, Validators.min(0)],
      }),
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      productIdsCsv: [''],
      productCategoryIdsCsv: [''],
      cartMinTotal: [''],
      cartMinQty: [''],
      cartProductIdsCsv: [''],
      cartCategoryIdsCsv: [''],
      isCoupon: [false],
      isPersonal: [false],
      couponCode: [''],
      maxUsages: [''],
    },
    { validators: [datesEqualValidator] },
  );

  constructor() {
    const p = this.data.promotion;
    if (p && this.data.mode === 'edit') {
      this.patchFromPromotion(p);
    }
  }

  ngOnInit(): void {
    if (this.data.mode === 'edit' && this.data.promotion) {
      this.loading.set(true);
      const id = this.data.promotion.id;
      if (this.isAdmin()) {
        forkJoin({
          full: this.promotionService.getById(id),
          coupon: this.couponAdmin.getCoupon(id).pipe(catchError(() => of(null))),
        })
          .pipe(finalize(() => this.loading.set(false)))
          .subscribe({
            next: ({ full, coupon }) => {
              this.patchFromPromotion(full);
              if (coupon) {
                this.couponAdminSnapshot.set(coupon);
                this.patchCouponFromAdmin(coupon);
              } else {
                this.couponAdminSnapshot.set(null);
              }
              this.syncPersonalControlForRole();
            },
            error: () => {
              this.patchFromPromotion(this.data.promotion!);
              this.syncPersonalControlForRole();
            },
          });
      } else {
        this.promotionService
          .getById(id)
          .pipe(finalize(() => this.loading.set(false)))
          .subscribe({
            next: (full) => {
              this.patchFromPromotion(full);
              this.syncPersonalControlForRole();
            },
            error: () => {
              this.patchFromPromotion(this.data.promotion!);
              this.syncPersonalControlForRole();
            },
          });
      }
    } else {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      this.form.patchValue({
        startDate: this.toDatetimeLocal(now),
        endDate: this.toDatetimeLocal(week),
        discountValue: null,
      });
      this.syncPersonalControlForRole();
    }

    const ik = this.data.promotion?.imageKey?.trim();
    if (ik && this.data.mode === 'edit') {
      this.mediaService.getSignedUrl(ik).subscribe({
        next: (r) => this.imagePreviewUrl.set(r.url),
        error: () => this.imagePreviewUrl.set(null),
      });
    }
  }

  ngOnDestroy(): void {
    this.revokeImageBlobPreview();
  }

  private toDatetimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Порівняння значень mat-select з API (число / рядок enum). */
  compareLevel = (a: unknown, b: unknown): boolean =>
    toPromotionLevel(a) === toPromotionLevel(b);

  compareDiscountType = (a: unknown, b: unknown): boolean =>
    toDiscountType(a) === toDiscountType(b);

  /**
   * Модератор не змінює «персональну» ознаку в UI — поле вимикається, значення береться зі знімка при збереженні.
   */
  private syncPersonalControlForRole(): void {
    const c = this.form.get('isPersonal');
    if (!c) {
      return;
    }
    if (this.isAdmin()) {
      c.enable({ emitEvent: false });
    } else {
      c.disable({ emitEvent: false });
    }
  }

  /** Дані купона з адмін-ендпоінта мають пріоритет над полями в PromotionResponseDto. */
  private patchCouponFromAdmin(c: PromotionCouponAdminDto): void {
    const maxU = c.maxUsages != null ? String(c.maxUsages) : '';
    this.form.patchValue({
      isCoupon: c.isCoupon ?? this.form.get('isCoupon')?.value,
      isPersonal: c.isPersonal ?? this.form.get('isPersonal')?.value,
      couponCode: c.couponCode ?? '',
      maxUsages: maxU,
    });
  }

  private patchFromPromotion(p: PromotionResponseDto): void {
    this.promotionSnapshot = p;
    const tr = (code: string) =>
      p.translations?.find((t) => t.languageCode.toLowerCase() === code.toLowerCase());
    const uk = tr('uk');
    const enName = p.name ?? '';
    const enDescription = p.description ?? '';
    this.form.patchValue({
      nameEn: enName,
      descriptionEn: enDescription,
      // Якщо uk-перекладу ще немає, підставляємо en, щоб форма залишалась валідною.
      nameUk: uk?.name ?? enName,
      descriptionUk: uk?.description ?? enDescription,
      imageKey: p.imageKey ?? '',
      level: toPromotionLevel(p.level),
      discountType: toDiscountType(p.discountType ?? DiscountType.Percentage),
      discountValue: this.coerceDiscountValueForForm(p.discountValue),
      startDate: this.toDatetimeLocal(new Date(p.startDate)),
      endDate: this.toDatetimeLocal(new Date(p.endDate)),
      productIdsCsv: guidListToCsv(p.productConditions?.productIds),
      productCategoryIdsCsv: guidListToCsv(p.productConditions?.categoryIds),
      cartMinTotal:
        p.cartConditions?.minTotalAmount != null ? String(p.cartConditions.minTotalAmount) : '',
      cartMinQty: p.cartConditions?.minQuantity != null ? String(p.cartConditions.minQuantity) : '',
      cartProductIdsCsv: guidListToCsv(p.cartConditions?.productIds),
      cartCategoryIdsCsv: guidListToCsv(p.cartConditions?.categoryIds),
      isCoupon: p.isCoupon,
      isPersonal: p.isPersonal,
      couponCode: p.couponCode ?? '',
      maxUsages: p.maxUsages != null ? String(p.maxUsages) : '',
    });
    this.syncPersonalControlForRole();
  }

  private buildCouponUpdateDto(): UpdatePromotionCouponAdminDto {
    const v = this.form.getRawValue();
    return {
      isCoupon: v.isCoupon,
      isPersonal: v.isPersonal,
      couponCode: v.isCoupon ? v.couponCode.trim() : null,
      maxUsages: v.isCoupon ? this.intOrNull(v.maxUsages) : null,
    };
  }

  private effectiveIsPersonal(): boolean {
    if (this.isAdmin()) {
      return !!this.form.getRawValue().isPersonal;
    }
    return !!this.promotionSnapshot?.isPersonal;
  }

  /**
   * API може дати число, рядок (decimal), null; у полі не ховаємо законне 0 — лише відсутнє значення.
   */
  private coerceDiscountValueForForm(v: unknown): number | null {
    if (v === null || v === undefined) {
      return null;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
    const s = String(v).trim();
    if (s === '') {
      return null;
    }
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  private emptyToNull(s: string): string | null {
    return s.trim() === '' ? null : s.trim();
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  readonlySlug(): string {
    if (this.data.mode === 'edit') {
      return this.promotionSnapshot?.slug ?? this.data.promotion?.slug ?? '—';
    }
    const nameEn = this.form.get('nameEn')?.value ?? '';
    const generated = this.slugify(String(nameEn));
    return generated || '—';
  }

  /** `type="number"` у шаблоні дає number | null, не рядок. */
  private numOrNull(s: string | number | null | undefined): number | null {
    if (s == null || s === '') {
      return null;
    }
    const t = String(s).trim();
    if (!t) {
      return null;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  private intOrNull(s: string | number | null | undefined): number | null {
    const n = this.numOrNull(s);
    if (n === null) {
      return null;
    }
    return Math.floor(n);
  }

  private buildConditions(level: PromotionLevel): {
    productConditions: ProductLevelConditionDto | null;
    cartConditions: CartLevelConditionDto | null;
  } {
    const v = this.form.getRawValue();
    if (level === PromotionLevel.Product) {
      const pids = parseGuidCsv(v.productIdsCsv);
      const cids = parseGuidCsv(v.productCategoryIdsCsv);
      return {
        productConditions: {
          productIds: pids.length ? pids : null,
          categoryIds: cids.length ? cids : null,
        },
        cartConditions: null,
      };
    }
    const cartPids = parseGuidCsv(v.cartProductIdsCsv);
    const cartCids = parseGuidCsv(v.cartCategoryIdsCsv);
    return {
      productConditions: null,
      cartConditions: {
        minTotalAmount: this.numOrNull(v.cartMinTotal),
        minQuantity: this.intOrNull(v.cartMinQty),
        productIds: cartPids.length ? cartPids : null,
        categoryIds: cartCids.length ? cartCids : null,
      },
    };
  }

  private validateGuidFields(): string | null {
    const v = this.form.getRawValue();
    const level = toPromotionLevel(v.level);
    const fields: { csv: string; key: string }[] =
      level === PromotionLevel.Product
        ? [
            { csv: v.productIdsCsv, key: 'ADMIN.PROMOTION.ERR_PRODUCT_IDS' },
            { csv: v.productCategoryIdsCsv, key: 'ADMIN.PROMOTION.ERR_CATEGORY_IDS' },
          ]
        : [
            { csv: v.cartProductIdsCsv, key: 'ADMIN.PROMOTION.ERR_CART_PRODUCT_IDS' },
            { csv: v.cartCategoryIdsCsv, key: 'ADMIN.PROMOTION.ERR_CART_CATEGORY_IDS' },
          ];
    for (const { csv, key } of fields) {
      const bad = invalidGuidsInCsv(csv);
      if (bad.length) {
        return this.translate.instant(key, { invalid: bad.slice(0, 3).join(', ') });
      }
    }
    return null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const guidErr = this.validateGuidFields();
    if (guidErr) {
      this.error.set(guidErr);
      return;
    }
    const v = this.form.getRawValue();
    if (v.isCoupon && !v.couponCode.trim()) {
      this.error.set(this.translate.instant('ADMIN.PROMOTION.COUPON_CODE_REQUIRED'));
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const level = toPromotionLevel(v.level);
    const discountType = toDiscountType(v.discountType);
    const rawDv = v.discountValue;
    const discountValue =
      rawDv === null || rawDv === undefined
        ? NaN
        : typeof rawDv === 'number'
          ? rawDv
          : Number(String(rawDv).trim());
    if (!Number.isFinite(discountValue)) {
      this.saving.set(false);
      this.error.set(this.translate.instant('ADMIN.PROMOTION.DISCOUNT_VALUE_REQUIRED'));
      return;
    }
    const { productConditions, cartConditions } = this.buildConditions(level);
    const emptyToNull = this.emptyToNull.bind(this);
    const a = parseDatetimeLocalInput(v.startDate);
    const b = parseDatetimeLocalInput(v.endDate);
    if (!a || !b) {
      this.saving.set(false);
      this.error.set(this.translate.instant('ADMIN.PROMOTION.DATES_ORDER_ERROR'));
      return;
    }
    const ta = a.getTime();
    const tb = b.getTime();
    if (ta === tb) {
      this.saving.set(false);
      this.error.set(this.translate.instant('ADMIN.PROMOTION.DATES_EQUAL_ERROR'));
      return;
    }
    const startDt = ta < tb ? a : b;
    const endDt = ta < tb ? b : a;
    const startIso = startDt.toISOString();
    const endIso = endDt.toISOString();

    const enTr: PromotionTranslationDto = {
      languageCode: 'en',
      name: v.nameEn,
      description: v.descriptionEn || null,
    };
    const ukTr: PromotionTranslationDto = {
      languageCode: 'uk',
      name: v.nameUk,
      description: v.descriptionUk || null,
    };

    if (this.data.mode === 'create') {
      const generatedSlug = this.slugify(v.nameEn) || `promotion-${Date.now()}`;
      const dto: CreatePromotionDto = {
        name: v.nameEn,
        slug: generatedSlug,
        description: v.descriptionEn || null,
        imageKey: emptyToNull(v.imageKey),
        level,
        productConditions,
        cartConditions,
        discountType,
        discountValue,
        startDate: startIso,
        endDate: endIso,
        isCoupon: v.isCoupon,
        isPersonal: this.effectiveIsPersonal(),
        couponCode: v.isCoupon ? v.couponCode.trim() : null,
        maxUsages: v.isCoupon ? this.intOrNull(v.maxUsages) : null,
        translations: [enTr, ukTr],
      };
      this.promotionService
        .create(dto)
        .pipe(
          switchMap((created) =>
            this.isAdmin()
              ? this.couponAdmin.updateCoupon(created.id, this.buildCouponUpdateDto()).pipe(
                  catchError((e) => {
                    this.saving.set(false);
                    this.error.set(this.mapError(e));
                    return throwError(() => e);
                  }),
                  map(() => created),
                )
              : of(created),
          ),
          switchMap((created) =>
            this.ensureTranslationsPersisted(created.id, created.translations ?? [], enTr, ukTr),
          ),
        )
        .subscribe({
          next: () => this.dialogRef.close(true),
          error: (e) => {
            this.saving.set(false);
            this.error.set(this.mapError(e));
          },
        });
    } else {
      const id = this.data.promotion!.id;
      const existing =
        (this.promotionSnapshot ?? this.data.promotion)!.translations ?? [];
      const dto: UpdatePromotionDto = {
        name: v.nameEn,
        description: v.descriptionEn || null,
        imageKey: emptyToNull(v.imageKey),
        level,
        productConditions,
        cartConditions,
        discountType,
        discountValue,
        startDate: startIso,
        endDate: endIso,
        isCoupon: v.isCoupon,
        isPersonal: this.effectiveIsPersonal(),
        couponCode: v.isCoupon ? v.couponCode.trim() : null,
        maxUsages: v.isCoupon ? this.intOrNull(v.maxUsages) : null,
      };
      this.promotionService
        .update(id, dto)
        .pipe(
          switchMap(() =>
            this.isAdmin()
              ? this.couponAdmin.updateCoupon(id, this.buildCouponUpdateDto()).pipe(
                  catchError((e) => {
                    this.saving.set(false);
                    this.error.set(this.mapError(e));
                    return throwError(() => e);
                  }),
                )
              : of(null),
          ),
          switchMap(() =>
            this.upsertTranslation(id, existing, enTr).pipe(
              concatMap(() => this.upsertTranslation(id, existing, ukTr)),
            ),
          ),
        )
        .subscribe({
          next: () => this.dialogRef.close(true),
          error: (e) => {
            this.saving.set(false);
            this.error.set(this.mapError(e));
          },
        });
    }
  }

  /**
   * Після створення акції бекенд може не зберегти `translations` з тіла POST — дописуємо en/uk через API.
   */
  private ensureTranslationsPersisted(
    promotionId: string,
    existing: PromotionResponseDto['translations'],
    enTr: PromotionTranslationDto,
    ukTr: PromotionTranslationDto,
  ): Observable<void> {
    return from([enTr, ukTr] as const).pipe(
      concatMap((tr) => this.upsertTranslation(promotionId, existing, tr)),
      map(() => undefined),
    );
  }

  private upsertTranslation(
    promotionId: string,
    existing: PromotionResponseDto['translations'],
    dto: PromotionTranslationDto,
  ): Observable<unknown> {
    const matched = existing.find(
      (t) => t.languageCode.toLowerCase() === dto.languageCode.toLowerCase(),
    );
    const dtoToSend: PromotionTranslationDto = {
      ...dto,
      // На бекенді пошук перекладу може бути case-sensitive (EN vs en).
      languageCode: matched?.languageCode ?? dto.languageCode,
    };

    // Надійніший порядок для нестабільного бекенду:
    // спочатку пробуємо UPDATE, і лише якщо перекладу справді немає — ADD.
    return this.promotionService.updateTranslation(promotionId, dtoToSend).pipe(
      catchError((err: unknown) => {
        if (!this.shouldRetryTranslationUpsertAsAdd(err)) {
          return throwError(() => err);
        }
        return this.promotionService.addTranslation(promotionId, dtoToSend);
      }),
    );
  }

  private httpErrorText(err: HttpErrorResponse): string {
    const body = err.error;
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && 'message' in body) {
      return String((body as { message?: string }).message ?? '');
    }
    return JSON.stringify(body ?? '');
  }

  /**
   * PUT перекладу міг не знайти рядок (existing застарів або дані з getAll без translations),
   * тоді EF повертає «affected 0 row(s)» — пробуємо POST створення.
   */
  private shouldRetryTranslationUpsertAsAdd(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status < 400) {
      return false;
    }
    if (err.status === 404 || err.status === 412) {
      return true;
    }
    const raw = this.httpErrorText(err);
    if (
      raw.includes('Translation for language') ||
      raw.includes('not found for promotion') ||
      raw.includes('not found for Promotion')
    ) {
      return true;
    }
    return (
      err.status === 500 &&
      (raw.includes('affected 0') ||
        raw.includes('Concurrency') ||
        raw.includes('concurrency') ||
        raw.includes('INTERNAL_ERROR'))
    );
  }

  /** Для шаблону: mat-select може тримати рядок, порівнюємо через toPromotionLevel. */
  levelIsProduct(): boolean {
    return toPromotionLevel(this.form.get('level')?.value) === PromotionLevel.Product;
  }

  levelIsCart(): boolean {
    return toPromotionLevel(this.form.get('level')?.value) === PromotionLevel.Cart;
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  /** Порожнє поле замість відображеного `0` (blur, щоб не ламати введення `0.5`, `10` тощо). */
  onDiscountBlur(): void {
    const c = this.form.controls.discountValue;
    if (c.value === 0) {
      c.setValue(null);
    }
  }

  onImageClick(): void {
    document.getElementById('promotion-image-input')?.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.snack.open(this.translate.instant('PROFILE.AVATAR_INVALID_TYPE'), 'OK', {
        duration: 3000,
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.snack.open(this.translate.instant('PROFILE.AVATAR_TOO_LARGE'), 'OK', { duration: 3000 });
      return;
    }
    const previousKey = this.form.get('imageKey')?.value?.trim() || '';
    this.setImageBlobPreview(URL.createObjectURL(file));
    this.isUploadingImage.set(true);
    this.mediaService.upload(file).subscribe({
      next: (res) => {
        if (previousKey && previousKey !== res.key) {
          this.mediaService.delete(previousKey).subscribe();
        }
        this.form.patchValue({ imageKey: res.key });
        this.mediaService.getSignedUrl(res.key).subscribe({
          next: (signed) => {
            this.revokeImageBlobPreview();
            this.imagePreviewUrl.set(signed.url);
            this.isUploadingImage.set(false);
          },
          error: () => this.isUploadingImage.set(false),
        });
      },
      error: () => {
        this.isUploadingImage.set(false);
        this.revokeImageBlobPreview();
        this.imagePreviewUrl.set(null);
        this.snack.open(this.translate.instant('PROFILE.AVATAR_UPLOAD_ERROR'), 'OK', {
          duration: 3000,
        });
      },
    });
  }

  removeImage(): void {
    const key = this.form.get('imageKey')?.value?.trim();
    if (key) {
      this.mediaService.delete(key).subscribe();
    }
    this.form.patchValue({ imageKey: '' });
    this.revokeImageBlobPreview();
    this.imagePreviewUrl.set(null);
  }

  hasImageKey(): boolean {
    return !!this.form.get('imageKey')?.value?.trim();
  }

  private setImageBlobPreview(objectUrl: string): void {
    this.revokeImageBlobPreview();
    this.imagePreviewBlobUrl = objectUrl;
    this.imagePreviewUrl.set(objectUrl);
  }

  private revokeImageBlobPreview(): void {
    if (this.imagePreviewBlobUrl) {
      URL.revokeObjectURL(this.imagePreviewBlobUrl);
      this.imagePreviewBlobUrl = null;
    }
  }

  private mapError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      const text =
        typeof body === 'string'
          ? body
          : body && typeof body === 'object' && 'message' in body
            ? String((body as { message?: string }).message)
            : '';
      if (
        text.includes('affected 0') ||
        text.includes('Concurrency') ||
        err.message?.includes('affected 0')
      ) {
        return this.translate.instant('ADMIN.PROMOTION.CONCURRENCY_ERROR');
      }
      if (body && typeof body === 'object') {
        const code = (body as { errorCode?: string }).errorCode;
        if (code === 'INVALID_DATES') {
          return this.translate.instant('ADMIN.PROMOTION.DATES_ORDER_ERROR');
        }
        if ('message' in body) {
          return String((body as { message?: string }).message ?? err.message);
        }
      }
      return err.message || 'Error';
    }
    return 'Error';
  }
}
