import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';
import { AttributeGroupService } from '../../../../features/attribute-groups/attribute-group.service';
import { AttributeGroupResponseDto } from '../../../../features/attribute-groups/attribute-group.types';
import {
  AttributeGroupFormDialogComponent,
  AttributeGroupFormDialogData,
} from './attribute-group-form-dialog/attribute-group-form-dialog.component';
import { AttributeGroupDeleteDialogComponent } from './attribute-group-delete-dialog/attribute-group-delete-dialog.component';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';

export type AttributeGroupSortKey = 'name' | 'slug' | 'description';

@Component({
  selector: 'app-attribute-groups',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './attribute-groups.html',
})
export class AttributeGroupsComponent {
  private attributeGroupService = inject(AttributeGroupService);
  private dialog = inject(MatDialog);

  groups = signal<AttributeGroupResponseDto[]>([]);
  loading = signal(true);
  page = signal(1);
  readonly pageSize = 10;

  search = signal('');
  sortKey = signal<AttributeGroupSortKey | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  displayedColumns: string[] = ['name', 'slug', 'description', 'actions'];

  filteredAndSortedGroups = computed(() => {
    const term = this.search().trim().toLowerCase();
    let list = [...this.groups()];

    if (term) {
      list = list.filter((g) => {
        const chunks: string[] = [g.name, g.slug, g.description ?? ''];
        for (const tr of g.translations ?? []) {
          chunks.push(tr.name, tr.description ?? '');
        }
        return chunks.join(' ').toLowerCase().includes(term);
      });
    }

    const key = this.sortKey();
    const dir = this.sortDir();
    if (key) {
      list = [...list].sort((a, b) => {
        const va = String(a[key] ?? '');
        const vb = String(b[key] ?? '');
        const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
        return dir === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  });

  paginatedGroups = computed(() => {
    const all = this.filteredAndSortedGroups();
    const start = (this.page() - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAndSortedGroups().length / this.pageSize)),
  );

  constructor() {
    this.loadGroups();
  }

  loadGroups() {
    this.loading.set(true);
    this.attributeGroupService.getAll().subscribe({
      next: (list) => {
        this.groups.set(list);
        this.loading.set(false);
        this.clampPage();
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    this.page.set(1);
  }

  changeSort(key: AttributeGroupSortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIndicator(key: AttributeGroupSortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil(this.filteredAndSortedGroups().length / this.pageSize));
    if (this.page() > total) {
      this.page.set(total);
    }
  }

  openCreate() {
    const ref = this.dialog.open(AttributeGroupFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      maxHeight: '90vh',
      data: {
        mode: 'create',
        group: null,
      } satisfies AttributeGroupFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadGroups();
      }
    });
  }

  openEdit(row: AttributeGroupResponseDto) {
    const ref = this.dialog.open(AttributeGroupFormDialogComponent, {
      panelClass: 'auth-dialog',
      width: '100%',
      maxWidth: '480px',
      maxHeight: '90vh',
      data: {
        mode: 'edit',
        group: row,
      } satisfies AttributeGroupFormDialogData,
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.loadGroups();
      }
    });
  }

  confirmDelete(row: AttributeGroupResponseDto) {
    const ref = this.dialog.open(AttributeGroupDeleteDialogComponent, {
      panelClass: 'auth-dialog',
      maxWidth: '400px',
      data: { id: row.id, name: row.name },
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.loadGroups();
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
}
