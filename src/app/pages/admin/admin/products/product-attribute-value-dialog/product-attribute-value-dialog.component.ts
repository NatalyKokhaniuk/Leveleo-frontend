import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProductAttributeValueService } from '../../../../../features/product-attribute-values/product-attribute-value.service';
import {
  CreateProductAttributeValueDto,
  ProductAttributeValueResponseDto,
  UpdateProductAttributeValueDto,
} from '../../../../../features/product-attribute-values/product-attribute-value.types';
import {
  AttributeType,
  normalizeAttributeType,
  ProductAttributeResponseDto,
} from '../../../../../features/product-attributes/product-attribute.types';

export interface ProductAttributeValueDialogData {
  mode: 'create' | 'edit';
  productId: string;
  attributes: ProductAttributeResponseDto[];
  existing: ProductAttributeValueResponseDto | null;
}

@Component({
  selector: 'app-product-attribute-value-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './product-attribute-value-dialog.component.html',
})
export class ProductAttributeValueDialogComponent {
  data = inject<ProductAttributeValueDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private service = inject(ProductAttributeValueService);
  ref = inject(MatDialogRef<ProductAttributeValueDialogComponent, boolean>);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  saving = false;

  private readonly decimalValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const s = String(control.value ?? '')
      .trim()
      .replace(',', '.');
    if (!s) {
      return { required: true };
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? null : { decimalFormat: true };
  };

  private readonly integerValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const s = String(control.value ?? '').trim();
    if (!s) {
      return { required: true };
    }
    return /^-?\d+$/.test(s) ? null : { integerFormat: true };
  };

  form = this.fb.nonNullable.group({
    productAttributeId: ['', Validators.required],
    stringValue: [''],
    decimalValue: [''],
    intValue: [''],
    boolValue: [false],
    valueUk: [''],
    valueEn: [''],
  });

  constructor() {
    if (this.data.mode === 'edit' && this.data.existing) {
      const v = this.data.existing;
      const trUk = v.translations?.find((t) => t.languageCode.toLowerCase() === 'uk');
      const trEn = v.translations?.find((t) => t.languageCode.toLowerCase() === 'en');
      this.form.patchValue({
        productAttributeId: v.productAttributeId,
        stringValue: v.stringValue ?? '',
        decimalValue: v.decimalValue != null ? String(v.decimalValue) : '',
        intValue: v.intValue != null ? String(v.intValue) : '',
        boolValue: v.boolValue ?? false,
        valueUk: trUk?.value ?? '',
        valueEn: trEn?.value ?? '',
      });
      this.form.controls.productAttributeId.disable();
      this.applyValidatorsForAttr(this.selectedAttr());
    } else {
      this.applyValidatorsForAttr(undefined);
      this.form.controls.productAttributeId.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() => {
          this.resetValueFields();
          this.applyValidatorsForAttr(this.selectedAttr());
        });
    }
  }

  selectedAttr(): ProductAttributeResponseDto | undefined {
    const id = this.form.getRawValue().productAttributeId;
    return this.data.attributes.find((a) => a.id === id);
  }

  isStringType(at: ProductAttributeResponseDto): boolean {
    return normalizeAttributeType(at.type) === AttributeType.String;
  }

  isDecimalType(at: ProductAttributeResponseDto): boolean {
    return normalizeAttributeType(at.type) === AttributeType.Decimal;
  }

  isIntegerType(at: ProductAttributeResponseDto): boolean {
    return normalizeAttributeType(at.type) === AttributeType.Integer;
  }

  isBooleanType(at: ProductAttributeResponseDto): boolean {
    return normalizeAttributeType(at.type) === AttributeType.Boolean;
  }

  private resetValueFields(): void {
    this.form.patchValue(
      {
        stringValue: '',
        decimalValue: '',
        intValue: '',
        boolValue: false,
        valueUk: '',
        valueEn: '',
      },
      { emitEvent: false },
    );
  }

  private applyValidatorsForAttr(attr: ProductAttributeResponseDto | undefined): void {
    const c = this.form.controls;
    const valueControls = [c.stringValue, c.decimalValue, c.intValue, c.valueUk, c.valueEn];
    for (const ctrl of valueControls) {
      ctrl.clearValidators();
    }
    c.boolValue.clearValidators();

    if (!attr) {
      for (const ctrl of [...valueControls, c.boolValue]) {
        ctrl.updateValueAndValidity({ emitEvent: false });
      }
      return;
    }

    const t = normalizeAttributeType(attr.type);
    switch (t) {
      case AttributeType.String:
        c.stringValue.setValidators([Validators.required]);
        break;
      case AttributeType.Decimal:
        c.decimalValue.setValidators([this.decimalValidator]);
        break;
      case AttributeType.Integer:
        c.intValue.setValidators([this.integerValidator]);
        break;
      case AttributeType.Boolean:
        break;
    }

    for (const ctrl of [...valueControls, c.boolValue]) {
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  submit(): void {
    if (this.form.invalid || this.saving) return;
    const raw = this.form.getRawValue();
    const attr = this.selectedAttr();
    if (!attr) return;

    const typeNum = normalizeAttributeType(attr.type);

    const translations: { languageCode: string; value: string }[] = [];
    if (typeNum === AttributeType.String) {
      if (raw.valueUk.trim()) {
        translations.push({ languageCode: 'uk', value: raw.valueUk.trim() });
      }
      if (raw.valueEn.trim()) {
        translations.push({ languageCode: 'en', value: raw.valueEn.trim() });
      }
    }

    this.saving = true;

    if (this.data.mode === 'create') {
      const dto: CreateProductAttributeValueDto = {
        productId: this.data.productId,
        productAttributeId: raw.productAttributeId,
        translations: translations.length ? translations : undefined,
      };
      switch (typeNum) {
        case AttributeType.String:
          dto.stringValue = raw.stringValue.trim() || null;
          break;
        case AttributeType.Decimal: {
          const n = parseFloat(String(raw.decimalValue).replace(',', '.'));
          dto.decimalValue = Number.isFinite(n) ? n : null;
          break;
        }
        case AttributeType.Integer: {
          const n = parseInt(String(raw.intValue).trim(), 10);
          dto.intValue = Number.isFinite(n) ? n : null;
          break;
        }
        case AttributeType.Boolean:
          dto.boolValue = raw.boolValue;
          break;
      }

      this.service.create(this.data.productId, dto).subscribe({
        next: () => {
          this.saving = false;
          this.ref.close(true);
        },
        error: () => {
          this.saving = false;
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.ATTR_VALUE_SAVE_ERROR'), 'OK', {
            duration: 5000,
          });
        },
      });
      return;
    }

    const ex = this.data.existing!;
    const dto: UpdateProductAttributeValueDto = {
      translations: translations.length ? translations : undefined,
    };
    switch (typeNum) {
      case AttributeType.String:
        dto.stringValue = raw.stringValue.trim() || null;
        break;
      case AttributeType.Decimal: {
        const n = parseFloat(String(raw.decimalValue).replace(',', '.'));
        dto.decimalValue = Number.isFinite(n) ? n : null;
        break;
      }
      case AttributeType.Integer: {
        const n = parseInt(String(raw.intValue).trim(), 10);
        dto.intValue = Number.isFinite(n) ? n : null;
        break;
      }
      case AttributeType.Boolean:
        dto.boolValue = raw.boolValue;
        break;
    }

    this.service.update(ex.id, dto).subscribe({
      next: () => {
        this.saving = false;
        this.ref.close(true);
      },
      error: () => {
        this.saving = false;
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.ATTR_VALUE_SAVE_ERROR'), 'OK', {
          duration: 5000,
        });
      },
    });
  }
}
