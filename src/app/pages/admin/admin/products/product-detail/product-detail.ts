import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { MediaService } from '../../../../../core/services/media.service';
import { BrandService } from '../../../../../features/brands/brand.service';
import { BrandResponseDto } from '../../../../../features/brands/brand.types';
import { CategoryService } from '../../../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../../../features/categories/category.types';
import { ProductAttributeValueService } from '../../../../../features/product-attribute-values/product-attribute-value.service';
import { ProductAttributeValueResponseDto } from '../../../../../features/product-attribute-values/product-attribute-value.types';
import { ProductAttributeService } from '../../../../../features/product-attributes/product-attribute.service';
import { ProductAttributeResponseDto } from '../../../../../features/product-attributes/product-attribute.types';
import { ProductMediaService } from '../../../../../features/products/product-media.service';
import { ProductService } from '../../../../../features/products/product.service';
import {
  CreateProductDto,
  ProductImageDto,
  ProductResponseDto,
  ProductVideoDto,
} from '../../../../../features/products/product.types';
import { HorizontalDragScrollDirective } from '../../../../../shared/directives/horizontal-drag-scroll.directive';
import { MediaImageThumbComponent } from '../../shared/media-image-thumb/media-image-thumb.component';
import {
  ProductAttributeValueDialogComponent,
  ProductAttributeValueDialogData,
} from '../product-attribute-value-dialog/product-attribute-value-dialog.component';
import { ProductDeleteDialogComponent } from '../product-delete-dialog/product-delete-dialog.component';

@Component({
  selector: 'app-admin-product-detail',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MediaImageThumbComponent,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class AdminProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private productMedia = inject(ProductMediaService);
  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);
  private attributeService = inject(ProductAttributeService);
  private attributeValueService = inject(ProductAttributeValueService);
  private mediaService = inject(MediaService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  loading = signal(true);
  saving = signal(false);
  isNew = signal(true);
  product = signal<ProductResponseDto | null>(null);
  images = signal<ProductImageDto[]>([]);
  videos = signal<ProductVideoDto[]>([]);
  attributeValues = signal<ProductAttributeValueResponseDto[]>([]);

  categories = signal<CategoryResponseDto[]>([]);
  brands = signal<BrandResponseDto[]>([]);
  allAttributes = signal<ProductAttributeResponseDto[]>([]);

  mainImagePreview = signal<string | null>(null);
  private mainBlobUrl: string | null = null;
  isUploadingMain = signal(false);

  stockDelta = signal(0);
  stockAbsolute = signal('');

  form = this.fb.nonNullable.group({
    nameEn: ['', Validators.required],
    descriptionEn: [''],
    nameUk: ['', Validators.required],
    descriptionUk: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    categoryId: ['', Validators.required],
    brandId: ['', Validators.required],
    mainImageKey: [''],
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  ngOnInit(): void {
    forkJoin({
      cats: this.categoryService.getAll(),
      brands: this.brandService.getAll(),
      attrs: this.attributeService.getAll(),
    }).subscribe({
      next: ({ cats, brands: br, attrs }) => {
        this.categories.set([...cats].sort((a, b) => a.fullPath.localeCompare(b.fullPath)));
        this.brands.set([...br].sort((a, b) => a.name.localeCompare(b.name)));
        this.allAttributes.set(attrs);
      },
      error: () => {},
    });

    this.route.paramMap
      .pipe(
        map((p) => p.get('productId')),
        takeUntil(this.destroy$),
      )
      .subscribe((id) => {
        if (!id) return;
        if (id === 'new') {
          this.isNew.set(true);
          this.product.set(null);
          this.images.set([]);
          this.videos.set([]);
          this.attributeValues.set([]);
          this.form.reset({
            nameEn: '',
            descriptionEn: '',
            nameUk: '',
            descriptionUk: '',
            price: 0,
            categoryId: '',
            brandId: '',
            mainImageKey: '',
            stockQuantity: 0,
            isActive: true,
          });
          this.clearMainPreview();
          this.loading.set(false);
        } else {
          this.isNew.set(false);
          this.loadProduct(id);
        }
      });
  }

  ngOnDestroy(): void {
    this.revokeMainBlob();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private revokeMainBlob(): void {
    if (this.mainBlobUrl) {
      URL.revokeObjectURL(this.mainBlobUrl);
      this.mainBlobUrl = null;
    }
  }

  private clearMainPreview(): void {
    this.revokeMainBlob();
    this.mainImagePreview.set(null);
  }

  private loadProduct(id: string): void {
    this.loading.set(true);
    forkJoin({
      product: this.productService.getById(id),
      images: this.productMedia.getImages(id),
      videos: this.productMedia.getVideos(id),
      values: this.attributeValueService.getByProductId(id),
    }).subscribe({
      next: ({ product: p, images: im, videos: vd, values: av }) => {
        this.product.set(p);
        this.images.set(im);
        this.videos.set(vd);
        this.attributeValues.set([...av]);
        const trUk = p.translations?.find((t) => t.languageCode.toLowerCase() === 'uk');
        this.form.patchValue({
          nameEn: p.name,
          descriptionEn: p.description ?? '',
          nameUk: trUk?.name ?? '',
          descriptionUk: trUk?.description ?? '',
          price: p.price,
          categoryId: p.categoryId,
          brandId: p.brandId,
          mainImageKey: p.mainImageKey ?? '',
          stockQuantity: p.stockQuantity,
          isActive: p.isActive,
        });
        this.stockAbsolute.set(String(p.stockQuantity));
        this.clearMainPreview();
        const mk = p.mainImageKey?.trim();
        if (mk) {
          this.mediaService.getSignedUrl(mk).subscribe({
            next: (r) => this.mainImagePreview.set(r.url),
            error: () => this.mainImagePreview.set(null),
          });
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.LOAD_ERROR'), 'OK', { duration: 5000 });
        this.router.navigate(['/admin/products']);
      },
    });
  }

  attrLabel(id: string): string {
    return this.allAttributes().find((a) => a.id === id)?.name ?? id;
  }

  displayValue(row: ProductAttributeValueResponseDto): string {
    if (row.stringValue != null && String(row.stringValue).trim() !== '') return row.stringValue;
    if (row.decimalValue != null) return String(row.decimalValue);
    if (row.intValue != null) return String(row.intValue);
    if (row.boolValue != null) return row.boolValue ? '✓' : '—';

    const tr = row.translations;
    if (tr?.length) {
      const lang = (this.translate.currentLang || 'uk').toLowerCase().split('-')[0];
      const match = tr.find((t) => t.languageCode.toLowerCase().split('-')[0] === lang && t.value?.trim());
      if (match) return match.value;
      const uk = tr.find((t) => t.languageCode.toLowerCase().startsWith('uk') && t.value?.trim());
      if (uk) return uk.value;
      const en = tr.find((t) => t.languageCode.toLowerCase().startsWith('en') && t.value?.trim());
      if (en) return en.value;
      const any = tr.find((t) => t.value?.trim());
      if (any) return any.value;
    }

    return '—';
  }

  pickMainImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.isUploadingMain.set(true);
    this.mediaService.upload(file).subscribe({
      next: (res) => {
        this.form.patchValue({ mainImageKey: res.key });
        this.clearMainPreview();
        this.mainBlobUrl = URL.createObjectURL(file);
        this.mainImagePreview.set(this.mainBlobUrl);
        this.isUploadingMain.set(false);
      },
      error: () => {
        this.isUploadingMain.set(false);
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.UPLOAD_ERROR'), 'OK', { duration: 5000 });
      },
    });
  }

  clearMainKey(): void {
    this.form.patchValue({ mainImageKey: '' });
    this.clearMainPreview();
  }

  uploadGalleryImage(event: Event): void {
    const id = this.product()?.id;
    if (!id) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.mediaService.upload(file).subscribe({
      next: (res) => {
        this.productMedia.addImage(id, res.key).subscribe({
          next: (img) => this.images.update((list) => [...list, img].sort((a, b) => a.sortOrder - b.sortOrder)),
          error: () =>
            this.snack.open(this.translate.instant('ADMIN.PRODUCT.MEDIA_ADD_ERROR'), 'OK', { duration: 5000 }),
        });
      },
      error: () =>
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.UPLOAD_ERROR'), 'OK', { duration: 5000 }),
    });
  }

  removeGalleryImage(img: ProductImageDto): void {
    const pid = this.product()?.id;
    if (!pid) return;
    this.productMedia.deleteImage(pid, img.id).subscribe({
      next: () => this.images.update((list) => list.filter((i) => i.id !== img.id)),
      error: () =>
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.MEDIA_DELETE_ERROR'), 'OK', { duration: 5000 }),
    });
  }

  uploadVideo(event: Event): void {
    const id = this.product()?.id;
    if (!id) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.mediaService.upload(file).subscribe({
      next: (res) => {
        this.productMedia.addVideo(id, res.key).subscribe({
          next: (v) => this.videos.update((list) => [...list, v].sort((a, b) => a.sortOrder - b.sortOrder)),
          error: () =>
            this.snack.open(this.translate.instant('ADMIN.PRODUCT.MEDIA_ADD_ERROR'), 'OK', { duration: 5000 }),
        });
      },
      error: () =>
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.UPLOAD_ERROR'), 'OK', { duration: 5000 }),
    });
  }

  removeVideo(v: ProductVideoDto): void {
    const pid = this.product()?.id;
    if (!pid) return;
    this.productMedia.deleteVideo(pid, v.id).subscribe({
      next: () => this.videos.update((list) => list.filter((x) => x.id !== v.id)),
      error: () =>
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.MEDIA_DELETE_ERROR'), 'OK', { duration: 5000 }),
    });
  }

  openAddAttributeValue(): void {
    const pid = this.product()?.id;
    if (!pid) return;
    const ref = this.dialog.open(ProductAttributeValueDialogComponent, {
      width: 'min(520px, 100vw)',
      data: {
        mode: 'create',
        productId: pid,
        attributes: this.allAttributes(),
        existing: null,
      } satisfies ProductAttributeValueDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) this.reloadAttributeValues(pid);
    });
  }

  openEditAttributeValue(row: ProductAttributeValueResponseDto): void {
    const pid = this.product()?.id;
    if (!pid) return;
    const ref = this.dialog.open(ProductAttributeValueDialogComponent, {
      width: 'min(520px, 100vw)',
      data: {
        mode: 'edit',
        productId: pid,
        attributes: this.allAttributes(),
        existing: row,
      } satisfies ProductAttributeValueDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) this.reloadAttributeValues(pid);
    });
  }

  private reloadAttributeValues(productId: string): void {
    this.attributeValueService.getByProductId(productId).subscribe({
      next: (list) => this.attributeValues.set([...list]),
    });
  }

  deleteAttributeValue(row: ProductAttributeValueResponseDto): void {
    this.attributeValueService.delete(row.id).subscribe({
      next: () => this.attributeValues.update((list) => list.filter((x) => x.id !== row.id)),
      error: () =>
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.ATTR_VALUE_DELETE_ERROR'), 'OK', {
          duration: 5000,
        }),
    });
  }

  applyStockDelta(): void {
    if (!this.product()) return;
    const d = this.stockDelta();
    if (!Number.isFinite(d) || d === 0) {
      this.snack.open(this.translate.instant('ADMIN.PRODUCT.STOCK_NO_CHANGE'), 'OK', { duration: 2500 });
      return;
    }
    this.patchStockByDelta(d);
  }

  applyStockAbsolute(): void {
    const p = this.product();
    if (!p) return;
    const n = parseInt(this.stockAbsolute().trim(), 10);
    if (!Number.isFinite(n) || n < 0) {
      this.snack.open(this.translate.instant('ADMIN.PRODUCT.STOCK_INVALID'), 'OK', { duration: 4000 });
      return;
    }
    const delta = n - p.stockQuantity;
    this.patchStockByDelta(delta);
  }

  /** Зміна залишку: PUT /products/{id} з новою кількістю = поточна + дельта (окремого inventory-ендпойнта немає). */
  private patchStockByDelta(delta: number): void {
    const p = this.product();
    const id = p?.id;
    if (!id || delta === 0) {
      if (delta === 0) {
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.STOCK_NO_CHANGE'), 'OK', { duration: 2500 });
      }
      return;
    }
    const next = Math.max(0, p.stockQuantity + delta);
    this.saving.set(true);
    this.productService.update(id, { stockQuantity: next }).subscribe({
      next: (updated) => {
        this.product.set(updated);
        this.form.patchValue({ stockQuantity: updated.stockQuantity });
        this.stockAbsolute.set(String(updated.stockQuantity));
        this.stockDelta.set(0);
        this.saving.set(false);
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.STOCK_UPDATED'), 'OK', { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open(this.translate.instant('ADMIN.PRODUCT.STOCK_ADJUST_ERROR'), 'OK', { duration: 6000 });
      },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();

    const translations = [
      { languageCode: 'uk', name: v.nameUk, description: v.descriptionUk || null },
    ];

    if (this.isNew()) {
      const dto: CreateProductDto = {
        name: v.nameEn,
        description: v.descriptionEn || null,
        price: v.price,
        categoryId: v.categoryId,
        brandId: v.brandId,
        mainImageKey: v.mainImageKey?.trim() || null,
        stockQuantity: v.stockQuantity,
        isActive: v.isActive,
        translations,
      };
      this.saving.set(true);
      this.productService.create(dto).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.CREATED'), 'OK', { duration: 4000 });
          this.router.navigate(['/admin/products', created.id], { replaceUrl: true });
        },
        error: () => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.SAVE_ERROR'), 'OK', { duration: 5000 });
        },
      });
      return;
    }

    const id = this.product()!.id;
    this.saving.set(true);
    this.productService
      .update(id, {
        name: v.nameEn,
        description: v.descriptionEn || null,
        price: v.price,
        categoryId: v.categoryId,
        brandId: v.brandId,
        mainImageKey: v.mainImageKey?.trim() || null,
        stockQuantity: v.stockQuantity,
        isActive: v.isActive,
        translations,
      })
      .subscribe({
        next: (updated) => {
          this.product.set(updated);
          this.saving.set(false);
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.SAVED'), 'OK', { duration: 4000 });
        },
        error: () => {
          this.saving.set(false);
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.SAVE_ERROR'), 'OK', { duration: 5000 });
        },
      });
  }

  onStockDeltaInput(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    this.stockDelta.set(Number.isFinite(v) ? v : 0);
  }

  onStockAbsoluteInput(event: Event): void {
    this.stockAbsolute.set((event.target as HTMLInputElement).value);
  }

  deleteProduct(): void {
    const p = this.product();
    if (!p) return;
    const ref = this.dialog.open(ProductDeleteDialogComponent, {
      data: { name: p.name },
      width: 'min(440px, 100vw)',
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.productService.delete(p.id).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.DELETED'), 'OK', { duration: 4000 });
          this.router.navigate(['/admin/products']);
        },
        error: () =>
          this.snack.open(this.translate.instant('ADMIN.PRODUCT.DELETE_ERROR'), 'OK', { duration: 5000 }),
      });
    });
  }
}
