import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MediaService } from '../../../../../core/services/media.service';
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
export class CategoryFormDialogComponent implements OnInit, OnDestroy {
  data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private dialogRef = inject(MatDialogRef<CategoryFormDialogComponent, boolean>);
  private mediaService = inject(MediaService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  saving = signal(false);
  error = signal<string | null>(null);
  isUploadingImage = signal(false);
  imagePreviewUrl = signal<string | null>(null);
  private imagePreviewBlobUrl: string | null = null;

  form = this.fb.nonNullable.group({
    nameEn: ['', Validators.required],
    descriptionEn: [''],
    nameUk: ['', Validators.required],
    descriptionUk: [''],
    imageKey: [''],
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
        imageKey: c.imageKey ?? '',
        parentId: c.parentId ?? '',
        isActive: c.isActive,
      });
    }
  }

  ngOnInit(): void {
    const c = this.data.category;
    const ik = c?.imageKey?.trim();
    if (ik && this.data.mode === 'edit') {
      this.loadSignedImagePreview(ik);
    }
  }

  ngOnDestroy(): void {
    this.revokeImageBlobPreview();
  }

  private loadSignedImagePreview(key: string): void {
    this.mediaService.getSignedUrl(key).subscribe({
      next: (r) => this.imagePreviewUrl.set(r.url),
      error: () => this.imagePreviewUrl.set(null),
    });
  }

  private revokeImageBlobPreview(): void {
    if (this.imagePreviewBlobUrl) {
      URL.revokeObjectURL(this.imagePreviewBlobUrl);
      this.imagePreviewBlobUrl = null;
    }
  }

  private setImageBlobPreview(objectUrl: string): void {
    this.revokeImageBlobPreview();
    this.imagePreviewBlobUrl = objectUrl;
    this.imagePreviewUrl.set(objectUrl);
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
    const emptyToNull = (s: string) => (s.trim() === '' ? null : s.trim());

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
          imageKey: emptyToNull(v.imageKey),
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
          imageKey: emptyToNull(v.imageKey),
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

  onImageClick(): void {
    document.getElementById('category-image-input')?.click();
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
          error: () => {
            this.isUploadingImage.set(false);
          },
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
