import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryService } from '../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../features/categories/category.types';
import { AttributeGroupService } from '../../../features/attribute-groups/attribute-group.service';
import { AttributeGroupResponseDto } from '../../../features/attribute-groups/attribute-group.types';
import { ProductAttributeService } from '../../../features/product-attributes/product-attribute.service';
import { ProductAttributeResponseDto } from '../../../features/product-attributes/product-attribute.types';
import { normalizeUiLang } from '../../../features/products/product-display-i18n';
import {
  HomeCategoryNodeComponent,
  CategoryTreeNode,
} from '../home-category-node/home-category-node.component';

export interface AttributeGroupBlock {
  group: AttributeGroupResponseDto;
  attributes: ProductAttributeResponseDto[];
}

function buildCategoryTree(flat: CategoryResponseDto[]): CategoryTreeNode[] {
  const active = flat.filter((c) => c.isActive);
  const byParent = new Map<string | null, CategoryResponseDto[]>();
  for (const c of active) {
    const raw = c.parentId != null ? String(c.parentId).trim() : '';
    const p = raw === '' ? null : raw;
    if (!byParent.has(p)) {
      byParent.set(p, []);
    }
    byParent.get(p)!.push(c);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  const build = (parentId: string | null): CategoryTreeNode[] =>
    (byParent.get(parentId) ?? []).map((category) => ({
      category,
      children: build(category.id),
    }));
  return build(null);
}

@Component({
  selector: 'app-home-catalog-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    MatIconModule,
    MatProgressSpinnerModule,
    HomeCategoryNodeComponent,
  ],
  templateUrl: './home-catalog-sidebar.component.html',
  styleUrl: './home-catalog-sidebar.component.scss',
})
export class HomeCatalogSidebarComponent implements OnInit {
  private categoryService = inject(CategoryService);
  private attributeGroupService = inject(AttributeGroupService);
  private productAttributeService = inject(ProductAttributeService);
  private translate = inject(TranslateService);

  loading = signal(true);
  loadError = signal(false);
  categoryRoots = signal<CategoryTreeNode[]>([]);
  attributeBlocks = signal<AttributeGroupBlock[]>([]);
  lang = signal(this.translate.currentLang || 'uk');

  /** Ліва панель згорнута (лише lg+). */
  collapsed = signal(false);

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });

    forkJoin({
      categories: this.categoryService.getAll().pipe(catchError(() => of([] as CategoryResponseDto[]))),
      groups: this.attributeGroupService.getAll().pipe(
        catchError(() => of([] as AttributeGroupResponseDto[])),
      ),
      attrs: this.productAttributeService.getAll().pipe(
        catchError(() => of([] as ProductAttributeResponseDto[])),
      ),
    }).subscribe({
      next: ({ categories, groups, attrs }) => {
        this.categoryRoots.set(buildCategoryTree(categories));
        const byGroup = new Map<string, ProductAttributeResponseDto[]>();
        for (const a of attrs) {
          const gid = a.attributeGroupId?.trim() ?? '';
          if (!gid) {
            continue;
          }
          if (!byGroup.has(gid)) {
            byGroup.set(gid, []);
          }
          byGroup.get(gid)!.push(a);
        }
        for (const arr of byGroup.values()) {
          arr.sort((a, b) => a.name.localeCompare(b.name));
        }
        const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));
        const blocks: AttributeGroupBlock[] = sortedGroups.map((group) => ({
          group,
          attributes: byGroup.get(group.id) ?? [],
        }));
        this.attributeBlocks.set(blocks);
        this.loading.set(false);
        this.loadError.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  groupLabel(g: AttributeGroupResponseDto): string {
    const code = normalizeUiLang(this.lang());
    const tr = g.translations?.find((t) => t.languageCode?.toLowerCase().startsWith(code));
    return tr?.name?.trim() || g.name;
  }

  attrLabel(a: ProductAttributeResponseDto): string {
    const code = normalizeUiLang(this.lang());
    const tr = a.translations?.find((t) => t.languageCode?.toLowerCase().startsWith(code));
    return tr?.name?.trim() || a.name;
  }
}
