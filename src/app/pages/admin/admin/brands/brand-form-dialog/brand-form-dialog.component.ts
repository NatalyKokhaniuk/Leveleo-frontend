import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MediaService } from '../../../../../core/services/media.service';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BrandService } from '../../../../../features/brands/brand.service';
import {
  BrandResponseDto,
  CreateBrandTranslationDto,
} from '../../../../../features/brands/brand.types';

export interface BrandFormDialogData {
  mode: 'create' | 'edit';
  brand: BrandResponseDto | null;
}

@Component({
  selector: 'app-brand-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './brand-form-dialog.component.html',
  styleUrl: './brand-form-dialog.component.scss',
})
export class BrandFormDialogComponent implements OnInit, OnDestroy {
  data = inject<BrandFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private brandService = inject(BrandService);
  private dialogRef = inject(MatDialogRef<BrandFormDialogComponent, boolean>);
  private mediaService = inject(MediaService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  saving = signal(false);
  error = signal<string | null>(null);
  isUploadingLogo = signal(false);
  /** Превʼю: blob URL під час вибору файлу або pre-signed URL з MediaService.getSignedUrl. */
  logoPreviewUrl = signal<string | null>(null);

  /** Лише для blob: URL — скасувати при заміні / видаленні / закритті діалогу. */
  private logoPreviewBlobUrl: string | null = null;

  form = this.fb.nonNullable.group({
    nameEn: ['', Validators.required],
    descriptionEn: [''],
    nameUk: ['', Validators.required],
    descriptionUk: [''],
    logoKey: [''],
    metaTitle: [''],
    metaDescription: [''],
  });

  constructor() {
    const b = this.data.brand;
    if (b && this.data.mode === 'edit') {
      const tr = (code: string) =>
        b.translations?.find((t) => t.languageCode.toLowerCase() === code.toLowerCase());
      const uk = tr('uk');
      this.form.patchValue({
        nameEn: b.name,
        descriptionEn: b.description ?? '',
        nameUk: uk?.name ?? '',
        descriptionUk: uk?.description ?? '',
        logoKey: b.logoKey ?? '',
        metaTitle: b.metaTitle ?? '',
        metaDescription: b.metaDescription ?? '',
      });
    }
  }

  ngOnInit(): void {
    const b = this.data.brand;
    const lk = b?.logoKey?.trim();
    if (lk && this.data.mode === 'edit') {
      this.loadSignedLogoPreview(lk);
    }
  }

  private loadSignedLogoPreview(key: string): void {
    this.mediaService.getSignedUrl(key).subscribe({
      next: (r) => this.logoPreviewUrl.set(r.url),
      error: () => this.logoPreviewUrl.set(null),
    });
  }

  ngOnDestroy(): void {
    this.revokeLogoBlobPreview();
  }

  private revokeLogoBlobPreview(): void {
    if (this.logoPreviewBlobUrl) {
      URL.revokeObjectURL(this.logoPreviewBlobUrl);
      this.logoPreviewBlobUrl = null;
    }
  }

  private setLogoBlobPreview(objectUrl: string): void {
    this.revokeLogoBlobPreview();
    this.logoPreviewBlobUrl = objectUrl;
    this.logoPreviewUrl.set(objectUrl);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();

    const enDto: CreateBrandTranslationDto = {
      languageCode: 'en',
      name: v.nameEn,
      description: v.descriptionEn || null,
    };
    const ukDto: CreateBrandTranslationDto = {
      languageCode: 'uk',
      name: v.nameUk,
      description: v.descriptionUk || null,
    };

    const emptyToNull = (s: string) => (s.trim() === '' ? null : s.trim());

    if (this.data.mode === 'create') {
      this.brandService
        .create({
          name: v.nameEn,
          description: v.descriptionEn || null,
          logoKey: emptyToNull(v.logoKey),
          metaTitle: emptyToNull(v.metaTitle),
          metaDescription: emptyToNull(v.metaDescription),
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
      const id = this.data.brand!.id;
      const existing = this.data.brand!.translations ?? [];
      this.brandService
        .update(id, {
          name: v.nameEn,
          description: v.descriptionEn || null,
          logoKey: emptyToNull(v.logoKey),
          metaTitle: emptyToNull(v.metaTitle),
          metaDescription: emptyToNull(v.metaDescription),
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
    brandId: string,
    existing: BrandResponseDto['translations'],
    dto: CreateBrandTranslationDto,
  ): Observable<void> {
    const has = existing.some(
      (t) => t.languageCode.toLowerCase() === dto.languageCode.toLowerCase(),
    );
    if (has) {
      return this.brandService.updateTranslation(brandId, dto);
    }
    return this.brandService.addTranslation(brandId, dto);
  }

  cancel() {
    this.dialogRef.close(false);
  }

  onLogoClick(): void {
    document.getElementById('brand-logo-input')?.click();
  }

  onLogoSelected(event: Event): void {
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

    const previousKey = this.form.get('logoKey')?.value?.trim() || '';

    this.setLogoBlobPreview(URL.createObjectURL(file));

    this.isUploadingLogo.set(true);
    this.mediaService.upload(file).subscribe({
      next: (res) => {
        if (previousKey && previousKey !== res.key) {
          this.mediaService.delete(previousKey).subscribe();
        }
        this.form.patchValue({ logoKey: res.key });
        this.mediaService.getSignedUrl(res.key).subscribe({
          next: (signed) => {
            this.revokeLogoBlobPreview();
            this.logoPreviewUrl.set(signed.url);
            this.isUploadingLogo.set(false);
          },
          error: () => {
            this.isUploadingLogo.set(false);
          },
        });
      },
      error: () => {
        this.isUploadingLogo.set(false);
        this.revokeLogoBlobPreview();
        this.logoPreviewUrl.set(null);
        this.snack.open(this.translate.instant('PROFILE.AVATAR_UPLOAD_ERROR'), 'OK', {
          duration: 3000,
        });
      },
    });
  }

  removeLogo(): void {
    const key = this.form.get('logoKey')?.value?.trim();
    if (key) {
      this.mediaService.delete(key).subscribe();
    }
    this.form.patchValue({ logoKey: '' });
    this.revokeLogoBlobPreview();
    this.logoPreviewUrl.set(null);
  }

  hasLogoKey(): boolean {
    return !!this.form.get('logoKey')?.value?.trim();
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
