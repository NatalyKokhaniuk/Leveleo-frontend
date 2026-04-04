import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AttributeGroupService } from '../../../../../features/attribute-groups/attribute-group.service';
import {
  AttributeGroupResponseDto,
  CreateAttributeGroupTranslationDto,
} from '../../../../../features/attribute-groups/attribute-group.types';

export interface AttributeGroupFormDialogData {
  mode: 'create' | 'edit';
  group: AttributeGroupResponseDto | null;
}

@Component({
  selector: 'app-attribute-group-form-dialog',
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
  templateUrl: './attribute-group-form-dialog.component.html',
  styleUrl: './attribute-group-form-dialog.component.scss',
})
export class AttributeGroupFormDialogComponent {
  data = inject<AttributeGroupFormDialogData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private attributeGroupService = inject(AttributeGroupService);
  private dialogRef = inject(MatDialogRef<AttributeGroupFormDialogComponent, boolean>);

  saving = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nameEn: ['', Validators.required],
    descriptionEn: [''],
    nameUk: ['', Validators.required],
    descriptionUk: [''],
  });

  constructor() {
    const g = this.data.group;
    if (g && this.data.mode === 'edit') {
      const tr = (code: string) =>
        g.translations?.find((t) => t.languageCode.toLowerCase() === code.toLowerCase());
      const uk = tr('uk');
      this.form.patchValue({
        nameEn: g.name,
        descriptionEn: g.description ?? '',
        nameUk: uk?.name ?? '',
        descriptionUk: uk?.description ?? '',
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

    const enDto: CreateAttributeGroupTranslationDto = {
      languageCode: 'en',
      name: v.nameEn,
      description: v.descriptionEn || null,
    };
    const ukDto: CreateAttributeGroupTranslationDto = {
      languageCode: 'uk',
      name: v.nameUk,
      description: v.descriptionUk || null,
    };

    if (this.data.mode === 'create') {
      this.attributeGroupService
        .create({
          name: v.nameEn,
          description: v.descriptionEn || null,
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
      const id = this.data.group!.id;
      const existing = this.data.group!.translations ?? [];
      this.attributeGroupService
        .update(id, {
          name: v.nameEn,
          description: v.descriptionEn || null,
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
    groupId: string,
    existing: AttributeGroupResponseDto['translations'],
    dto: CreateAttributeGroupTranslationDto,
  ): Observable<void> {
    const has = existing.some(
      (t) => t.languageCode.toLowerCase() === dto.languageCode.toLowerCase(),
    );
    if (has) {
      return this.attributeGroupService.updateTranslation(groupId, dto);
    }
    return this.attributeGroupService.addTranslation(groupId, dto);
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
