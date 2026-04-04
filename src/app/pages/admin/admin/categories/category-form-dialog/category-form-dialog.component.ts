import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
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
import { CategoryService } from '../../../../../features/categories/category.service';
import {
  CategoryResponseDto,
  CreateCategoryTranslationDto,
} from '../../../../../features/categories/category.types';

export interface CategoryFormDialogData {
  mode: 'create' | 'edit';
  category: CategoryResponseDto | null;
  allCategories: CategoryResponseDto[];
}

@Component({
  selector: 'app-category-form-dialog',
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
  templateUrl: './category-form-dialog.component.html',
  styleUrl: './category-form-dialog.component.scss',
})
export class CategoryFormDialogComponent {
  data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private dialogRef = inject(MatDialogRef<CategoryFormDialogComponent, boolean>);

  saving = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nameEn: ['', Validators.required],
    descriptionEn: [''],
    nameUk: ['', Validators.required],
    descriptionUk: [''],
    parentId: [''],
    isActive: [true],
  });

  parentOptions = computed(() => {
    const exclude = this.data.category?.id;
    return [...this.data.allCategories]
      .filter((x) => x.id !== exclude)
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath, undefined, { sensitivity: 'base' }));
  });

  constructor() {
    const c = this.data.category;
    if (c && this.data.mode === 'edit') {
      const tr = (code: string) =>
        c.translations?.find((t) => t.languageCode.toLowerCase() === code.toLowerCase());
      const uk = tr('uk');
      this.form.patchValue({
        nameEn: c.name,
        descriptionEn: c.description ?? '',
        nameUk: uk?.name ?? '',
        descriptionUk: uk?.description ?? '',
        parentId: c.parentId ?? '',
        isActive: c.isActive,
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
    const parentId = v.parentId === '' ? null : v.parentId;

    const enDto: CreateCategoryTranslationDto = {
      languageCode: 'en',
      name: v.nameEn,
      description: v.descriptionEn || null,
    };
    const ukDto: CreateCategoryTranslationDto = {
      languageCode: 'uk',
      name: v.nameUk,
      description: v.descriptionUk || null,
    };

    if (this.data.mode === 'create') {
      this.categoryService
        .create({
          name: v.nameEn,
          description: v.descriptionEn || null,
          parentId,
          isActive: v.isActive,
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
      const id = this.data.category!.id;
      const existing = this.data.category!.translations ?? [];
      this.categoryService
        .update(id, {
          name: v.nameEn,
          description: v.descriptionEn || null,
          parentId,
          isActive: v.isActive,
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
    categoryId: string,
    existing: CategoryResponseDto['translations'],
    dto: CreateCategoryTranslationDto,
  ): Observable<void> {
    const has = existing.some(
      (t) => t.languageCode.toLowerCase() === dto.languageCode.toLowerCase(),
    );
    if (has) {
      return this.categoryService.updateTranslation(categoryId, dto);
    }
    return this.categoryService.addTranslation(categoryId, dto);
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
