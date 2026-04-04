import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { AttributeGroupService } from '../../../../features/attribute-groups/attribute-group.service';
import { AttributeGroupResponseDto } from '../../../../features/attribute-groups/attribute-group.types';
import { ProductAttributeService } from '../../../../features/product-attributes/product-attribute.service';
import {
  AttributeType,
  normalizeAttributeType,
  ProductAttributeResponseDto,
} from '../../../../features/product-attributes/product-attribute.types';
import {
  ProductAttributeFormDialogComponent,
  ProductAttributeFormDialogData,
} from './product-attribute-form-dialog/product-attribute-form-dialog.component';
import { ProductAttributeDeleteDialogComponent } from './product-attribute-delete-dialog/product-attribute-delete-dialog.component';

export type ProductAttributeSortKey =
  | 'name'
  | 'slug'
  | 'type'
  | 'unit'
  | 'isFilterable'
  | 'isComparable';

@Component({
  selector: 'app-product-attributes',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './product-attributes.html',
})
export class ProductAttributesComponent {
  private productAttributeService = inject(ProductAttributeService);
  private attributeGroupService = inject(AttributeGroupService);
  private dialog = inject(MatDialog);

  attributes = signal<ProductAttributeResponseDto[]>([]);
  groups = signal<AttributeGroupResponseDto[]>([]);
  loading = signal(true);
  page = signal(1);
  readonly pageSize = 10;

  search = signal('');
  /** Порожній рядок — усі групи (як «Усі ролі» у користувачах). */
  filterGroupId = signal('');
  sortKey = signal<ProductAttributeSortKey | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  displayedColumns: string[] = [
    'name',
    'slug',
    'group',
    'type',
    'unit',
    'filterable',
    'comparable',
    'actions',
  ];

  groupById = computed(() => {
    const m = new Map<string, string>();
    for (const g of this.groups()) {
      m.set(g.id, g.name);
    }
    return m;
  });

  filteredAndSortedAttributes = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = [...this.attributes()];
    const groupFilter = this.filterGroupId().trim();
    if (groupFilter) {
      list = list.filter((a) => a.attributeGroupId === groupFilter);
    }

    const groupName = (gid: string | null | undefined) =>
      gid ? this.groupById().get(gid) ?? '' : '';

    if (term) {
      list = list.filter((a) => {
        const chunks: string[] = [
          a.name,
          a.slug,
          a.description ?? '',
          a.unit ?? '',
          String(a.isFilterable),
          String(a.isComparable),
          this.typeLabelKey(normalizeAttributeType(a.type)),
          groupName(a.attributeGroupId),
        ];
        for (const tr of a.translations ?? []) {
          chunks.push(tr.name, tr.description ?? '');
        }
        return chunks.join(' ').toLowerCase().includes(term);
      });
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    if (key) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (key === 'isFilterable' || key === 'isComparable') {
          cmp = Number(a[key]) - Number(b[key]);
        } else if (key === 'type') {
          cmp = normalizeAttributeType(a.type) - normalizeAttributeType(b.type);
        } else {
          const va = String(a[key as keyof ProductAttributeResponseDto] ?? '');
          const vb = String(b[key as keyof ProductAttributeResponseDto] ?? '');
          cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
        }
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  });

  paginatedAttributes = computed(() => {
    const all = this.filteredAndSortedAttributes();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAndSortedAttributes().length / this.pageSize)),
  );

  constructor() {
    this.loadAll();
  }

  loadAll() {
    this.loading.set(true);
    forkJoin({
      groups: this.attributeGroupService.getAll(),
      attributes: this.productAttributeService.getAll(),
    }).subscribe({
      next: ({ groups, attributes }) => {
        this.groups.set(groups);
        this.attributes.set(attributes);
        this.loading.set(false);
        this.clampPage();
      },
      error: () => this.loading.set(false),
    });
  }

  groupLabel(attributeGroupId: string | null | undefined): string {
    if (!attributeGroupId) {
      return '—';
    }
    return this.groupById().get(attributeGroupId) ?? '—';
  }

  typeLabelKey(type: AttributeType | string | number): string {
    const t = normalizeAttributeType(type);
    const map: Record<AttributeType, string> = {
      [AttributeType.String]: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_STRING',
      [AttributeType.Decimal]: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_DECIMAL',
      [AttributeType.Integer]: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_INTEGER',
      [AttributeType.Boolean]: 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_BOOLEAN',
    };
    return map[t] ?? 'ADMIN.PRODUCT_ATTRIBUTE.TYPE_STRING';
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  onFilterGroupChange(event: MatSelectChange<string>) {
    this.filterGroupId.set(event.value ?? '');
    this.page.set(1);
  }

  changeSort(key: ProductAttributeSortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIndicator(key: ProductAttributeSortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil(this.filteredAndSortedAttributes().length / this.pageSize));
    if (this.page() > total) {
      this.page.set(total);
    }
  }

  openCreate() {
    const ref = this.dialog.open(ProductAttributeFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '520px',
      maxHeight: '90vh',
      data: {
        mode: 'create',
        attribute: null,
        groups: this.groups(),
      } satisfies ProductAttributeFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadAll();
      }
    });
  }

  openEdit(row: ProductAttributeResponseDto) {
    const ref = this.dialog.open(ProductAttributeFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '520px',
      maxHeight: '90vh',
      data: {
        mode: 'edit',
        attribute: row,
        groups: this.groups(),
      } satisfies ProductAttributeFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadAll();
      }
    });
  }

  confirmDelete(row: ProductAttributeResponseDto) {
    const ref = this.dialog.open(ProductAttributeDeleteDialogComponent, {
      panelClass: 'auth-dialog',
      maxWidth: '400px',
      data: { id: row.id, name: row.name },
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.loadAll();
      }
    });
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  dash(value: string | null | undefined): string {
    return value?.trim() ? value : '—';
  }

  yesNo(v: boolean): string {
    return v ? 'ADMIN.CATEGORY.YES' : 'ADMIN.CATEGORY.NO';
  }
}
