import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AttributeGroupResponseDto } from '../../../../../features/attribute-groups/attribute-group.types';
import { ProductAttributeService } from '../../../../../features/product-attributes/product-attribute.service';
import {
  AttributeType,
  CreateProductAttributeTranslationDto,
  normalizeAttributeType,
  ProductAttributeResponseDto,
} from '../../../../../features/product-attributes/product-attribute.types';

export interface ProductAttributeFormDialogData {
  mode: 'create' | 'edit';
  attribute: ProductAttributeResponseDto | null;
  groups: AttributeGroupResponseDto[];
}

@Component({
  selector: 'app-product-attribute-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './product-attribute-form-dialog.component.html',
  styleUrl: './product-attribute-form-dialog.component.scss',
})
export class ProductAttributeFormDialogComponent {
  data = inject<ProductAttributeFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private productAttributeService = inject(ProductAttributeService);
  private dialogRef = inject(MatDialogRef<ProductAttributeFormDialogComponent, boolean>);

  saving = signal(false);
  error = signal<string | null>(null);

  AttributeType = AttributeType;

  readonly typeOptions: { value: AttributeType; labelKey: string }[] = [
    { value: AttributeType.String, labelKey: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_STRING' },
    { value: AttributeType.Decimal, labelKey: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_DECIMAL' },
    { value: AttributeType.Integer, labelKey: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_INTEGER' },
    { value: AttributeType.Boolean, labelKey: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_BOOLEAN' },
  ];

  form = this.fb.nonNullable.group({
    attributeGroupId: [''],
    nameEn: ['', Validators.required],
    descriptionEn: [''],
    nameUk: ['', Validators.required],
    descriptionUk: [''],
    type: [AttributeType.String, Validators.required],
    unit: [''],
    isFilterable: [false],
    isComparable: [false],
  });

  constructor() {
    this.form.controls.attributeGroupId.addValidators(Validators.required);
    const a = this.data.attribute;
    if (a && this.data.mode === 'edit') {
      const tr = (code: string) =>
        a.translations?.find((t) => t.languageCode.toLowerCase() === code.toLowerCase());
      const uk = tr('uk');
      this.form.patchValue({
        attributeGroupId: a.attributeGroupId ?? '',
        nameEn: a.name,
        descriptionEn: a.description ?? '',
        nameUk: uk?.name ?? '',
        descriptionUk: uk?.description ?? '',
        type: normalizeAttributeType(a.type),
        unit: a.unit ?? '',
        isFilterable: a.isFilterable,
        isComparable: a.isComparable,
      });
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();

    const enDto: CreateProductAttributeTranslationDto = {
      languageCode: 'en',
      name: v.nameEn,
      description: v.descriptionEn || null,
    };
    const ukDto: CreateProductAttributeTranslationDto = {
      languageCode: 'uk',
      name: v.nameUk,
      description: v.descriptionUk || null,
    };

    const emptyToNull = (s: string) => (s.trim() === '' ? null : s.trim());

    if (this.data.mode === 'create') {
      this.productAttributeService
        .create({
          attributeGroupId: v.attributeGroupId.trim(),
          name: v.nameEn,
          description: v.descriptionEn || null,
          type: v.type,
          unit: emptyToNull(v.unit),
          isFilterable: v.isFilterable,
          isComparable: v.isComparable,
          translations: [enDto, ukDto],
        })
        .subscribe({
          next: () => this.dialogRef.close(true),
          error: (e) => {
            this.saving.set(false);
            this.error.set(this.mapError(e));
          },
        });
    } else {
      const id = this.data.attribute!.id;
      const existing = this.data.attribute!.translations ?? [];
      this.productAttributeService
        .update(id, {
          attributeGroupId: v.attributeGroupId.trim(),
          name: v.nameEn,
          description: v.descriptionEn || null,
          type: v.type,
          unit: emptyToNull(v.unit),
          isFilterable: v.isFilterable,
          isComparable: v.isComparable,
        })
        .pipe(
          switchMap(() =>
            forkJoin([
              this.upsertTranslation(id, existing, enDto),
              this.upsertTranslation(id, existing, ukDto),
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
    attributeId: string,
    existing: ProductAttributeResponseDto['translations'],
    dto: CreateProductAttributeTranslationDto,
  ): Observable<void> {
    const has = existing.some(
      (t) => t.languageCode.toLowerCase() === dto.languageCode.toLowerCase(),
    );
    if (has) {
      return this.productAttributeService.updateTranslation(attributeId, dto);
    }
    return this.productAttributeService.addTranslation(attributeId, dto);
  }

  cancel() {
    this.dialogRef.close(false);
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
