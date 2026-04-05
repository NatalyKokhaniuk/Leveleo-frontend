import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { MediaService } from '../../../../../core/services/media.service';
import { PromotionService } from '../../../../../features/promotions/promotion.service';
import {
  CartLevelConditionDto,
  CreatePromotionDto,
  DiscountType,
  ProductLevelConditionDto,
  PromotionLevel,
  PromotionResponseDto,
  PromotionTranslationDto,
  UpdatePromotionDto,
} from '../../../../../features/promotions/promotion.types';
import { toDiscountType, toPromotionLevel } from '../../../../../features/promotions/promotion-enum.util';
import {
  invalidGuidsInCsv,
  optionalGuidList,
  optionalJsonToCsv,
  parseGuidCsv,
} from '../../../../../features/promotions/promotion-optional.util';
import { PromotionEntityIdsPickerComponent } from '../promotion-entity-ids-picker/promotion-entity-ids-picker.component';

export interface PromotionFormDialogData {
  mode: 'create' | 'edit';
  promotion: PromotionResponseDto | null;
}

function datesOrderValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  if (!start || !end) {
    return null;
  }
  if (new Date(start as string) >= new Date(end as string)) {
    return { datesOrder: true };
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
  ],
  templateUrl: './promotion-form-dialog.component.html',
  styleUrl: './promotion-form-dialog.component.scss',
})
export class PromotionFormDialogComponent implements OnInit, OnDestroy {
  data = inject<PromotionFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private promotionService = inject(PromotionService);
  private dialogRef = inject(MatDialogRef<PromotionFormDialogComponent, boolean>);
  private mediaService = inject(MediaService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  saving = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  /** Останній знімок з getById (переклади для upsert). */
  private promotionSnapshot: PromotionResponseDto | null = null;
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

  form = this.fb.nonNullable.group(
    {
      nameEn: ['', Validators.required],
      descriptionEn: [''],
      nameUk: ['', Validators.required],
      descriptionUk: [''],
      slug: ['', Validators.required],
      imageKey: [''],
      level: [PromotionLevel.Product, Validators.required],
      discountType: [DiscountType.Percentage, Validators.required],
      discountValue: [0, [Validators.required, Validators.min(0)]],
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
    { validators: [datesOrderValidator] },
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
      this.promotionService
        .getById(this.data.promotion.id)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (full) => this.patchFromPromotion(full),
          error: () => {
            this.patchFromPromotion(this.data.promotion!);
          },
        });
    } else {
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      this.form.patchValue({
        startDate: this.toDatetimeLocal(now),
        endDate: this.toDatetimeLocal(week),
      });
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

  private patchFromPromotion(p: PromotionResponseDto): void {
    this.promotionSnapshot = p;
    const tr = (code: string) =>
      p.translations?.find((t) => t.languageCode.toLowerCase() === code.toLowerCase());
    const uk = tr('uk');
    this.form.patchValue({
      nameEn: p.name ?? '',
      descriptionEn: p.description ?? '',
      nameUk: uk?.name ?? '',
      descriptionUk: uk?.description ?? '',
      slug: p.slug,
      imageKey: p.imageKey ?? '',
      level: toPromotionLevel(p.level),
      discountType: toDiscountType(p.discountType ?? DiscountType.Percentage),
      discountValue: p.discountValue ?? 0,
      startDate: this.toDatetimeLocal(new Date(p.startDate)),
      endDate: this.toDatetimeLocal(new Date(p.endDate)),
      productIdsCsv: optionalJsonToCsv(p.productConditions?.productIds),
      productCategoryIdsCsv: optionalJsonToCsv(p.productConditions?.categoryIds),
      cartMinTotal:
        p.cartConditions?.minTotalAmount != null ? String(p.cartConditions.minTotalAmount) : '',
      cartMinQty: p.cartConditions?.minQuantity != null ? String(p.cartConditions.minQuantity) : '',
      cartProductIdsCsv: optionalJsonToCsv(p.cartConditions?.productIds),
      cartCategoryIdsCsv: optionalJsonToCsv(p.cartConditions?.categoryIds),
      isCoupon: p.isCoupon,
      isPersonal: p.isPersonal,
      couponCode: p.couponCode ?? '',
      maxUsages: p.maxUsages != null ? String(p.maxUsages) : '',
    });
  }

  private emptyToNull(s: string): string | null {
    return s.trim() === '' ? null : s.trim();
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
          productIds: optionalGuidList(pids),
          categoryIds: optionalGuidList(cids),
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
        productIds: optionalGuidList(cartPids),
        categoryIds: optionalGuidList(cartCids),
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
    const discountValue = Number(v.discountValue);
    const { productConditions, cartConditions } = this.buildConditions(level);
    const emptyToNull = this.emptyToNull.bind(this);
    const startIso = new Date(v.startDate).toISOString();
    const endIso = new Date(v.endDate).toISOString();

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
      const dto: CreatePromotionDto = {
        name: v.nameEn,
        slug: v.slug.trim(),
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
        isPersonal: v.isPersonal,
        couponCode: v.isCoupon ? v.couponCode.trim() : null,
        maxUsages: v.isCoupon && v.maxUsages.trim() ? Number(v.maxUsages) : null,
        translations: [enTr, ukTr],
      };
      this.promotionService.create(dto).subscribe({
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
        isPersonal: v.isPersonal,
        couponCode: v.isCoupon ? v.couponCode.trim() : null,
        maxUsages: v.isCoupon && v.maxUsages.trim() ? Number(v.maxUsages) : null,
      };
      this.promotionService
        .update(id, dto)
        .pipe(
          switchMap(() =>
            forkJoin([
              this.upsertTranslation(id, existing, enTr),
              this.upsertTranslation(id, existing, ukTr),
            ]),
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

  private upsertTranslation(
    promotionId: string,
    existing: PromotionResponseDto['translations'],
    dto: PromotionTranslationDto,
  ): Observable<unknown> {
    const has = existing.some(
      (t) => t.languageCode.toLowerCase() === dto.languageCode.toLowerCase(),
    );
    if (has) {
      return this.promotionService.updateTranslation(promotionId, dto);
    }
    return this.promotionService.addTranslation(promotionId, dto);
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
      if (body && typeof body === 'object' && 'message' in body) {
        return String((body as { message?: string }).message ?? err.message);
      }
      return err.message || 'Error';
    }
    return 'Error';
  }
}
