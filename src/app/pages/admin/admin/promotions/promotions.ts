import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { HorizontalDragScrollDirective } from '../../../../shared/directives/horizontal-drag-scroll.directive';
import { PromotionService } from '../../../../features/promotions/promotion.service';
import { DiscountType, PromotionLevel, PromotionResponseDto } from '../../../../features/promotions/promotion.types';
import {
  PromotionDeleteDialogComponent,
  PromotionDeleteDialogData,
} from './promotion-delete-dialog/promotion-delete-dialog.component';
import {
  PromotionFormDialogComponent,
  PromotionFormDialogData,
} from './promotion-form-dialog/promotion-form-dialog.component';

type PromotionSortKey =
  | 'name'
  | 'slug'
  | 'level'
  | 'discountType'
  | 'discountValue'
  | 'startDate'
  | 'endDate'
  | 'isActive'
  | 'isCoupon';

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TranslateModule,
    MatButtonModule,
    MatDialogModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    HorizontalDragScrollDirective,
  ],
  templateUrl: './promotions.html',
  styleUrl: './promotions.scss',
})
export class AdminPromotionsComponent {
  private api = inject(PromotionService);
  private dialog = inject(MatDialog);

  promotions = signal<PromotionResponseDto[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  page = signal(1);
  readonly pageSize = 10;

  search = signal('');
  levelFilter = signal<'all' | PromotionLevel>('all');
  discountTypeFilter = signal<'all' | DiscountType>('all');
  couponFilter = signal<'all' | 'yes' | 'no'>('all');
  activeFilter = signal<'all' | 'yes' | 'no'>('all');
  sortKey = signal<PromotionSortKey>('startDate');
  sortDir = signal<'asc' | 'desc'>('desc');

  readonly PromotionLevel = PromotionLevel;
  readonly DiscountType = DiscountType;

  displayedColumns = [
    'name',
    'slug',
    'level',
    'discountType',
    'discountValue',
    'startDate',
    'endDate',
    'isActive',
    'isCoupon',
    'isPersonal',
    'couponCode',
    'maxUsages',
    'actions',
  ];

  private discountTypeLabel(v: PromotionResponseDto): number {
    return v.discountType ?? -1;
  }

  filteredAndSorted = computed(() => {
    const term = this.search().trim().toLowerCase();
    const lf = this.levelFilter();
    const df = this.discountTypeFilter();
    const cf = this.couponFilter();
    const af = this.activeFilter();
    const key = this.sortKey();
    const dir = this.sortDir();

    let list = [...this.promotions()].filter((p) => !!p);

    if (term) {
      list = list.filter((p) => {
        const chunks = [
          p.name ?? '',
          p.slug ?? '',
          p.description ?? '',
          p.couponCode ?? '',
          ...(p.translations ?? []).map((t) => `${t.name ?? ''} ${t.description ?? ''}`),
        ];
        return chunks.join(' ').toLowerCase().includes(term);
      });
    }
    if (lf !== 'all') {
      list = list.filter((p) => Number(p.level) === Number(lf));
    }
    if (df !== 'all') {
      list = list.filter((p) => Number(p.discountType ?? -1) === Number(df));
    }
    if (cf !== 'all') {
      list = list.filter((p) => (cf === 'yes' ? !!p.isCoupon : !p.isCoupon));
    }
    if (af !== 'all') {
      list = list.filter((p) => (af === 'yes' ? !!p.isActive : !p.isActive));
    }

    list.sort((a, b) => {
      let va: string | number | boolean = '';
      let vb: string | number | boolean = '';
      switch (key) {
        case 'name':
          va = (a.name ?? '').toLowerCase();
          vb = (b.name ?? '').toLowerCase();
          break;
        case 'slug':
          va = (a.slug ?? '').toLowerCase();
          vb = (b.slug ?? '').toLowerCase();
          break;
        case 'level':
          va = Number(a.level);
          vb = Number(b.level);
          break;
        case 'discountType':
          va = this.discountTypeLabel(a);
          vb = this.discountTypeLabel(b);
          break;
        case 'discountValue':
          va = Number(a.discountValue ?? -1);
          vb = Number(b.discountValue ?? -1);
          break;
        case 'startDate':
          va = new Date(a.startDate).getTime();
          vb = new Date(b.startDate).getTime();
          break;
        case 'endDate':
          va = new Date(a.endDate).getTime();
          vb = new Date(b.endDate).getTime();
          break;
        case 'isActive':
          va = !!a.isActive;
          vb = !!b.isActive;
          break;
        case 'isCoupon':
          va = !!a.isCoupon;
          vb = !!b.isCoupon;
          break;
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredAndSorted().length / this.pageSize)));
  paginated = computed(() => {
    const p = Math.min(this.page(), this.totalPages());
    const start = (p - 1) * this.pageSize;
    return this.filteredAndSorted().slice(start, start + this.pageSize);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .getAll()
      .pipe(
        switchMapListToFull(this.api),
        catchError(() => {
          this.loadError.set('ADMIN.PROMOTION.LOAD_ERROR');
          return of([] as PromotionResponseDto[]);
        }),
      )
      .subscribe((rows) => {
        this.promotions.set(rows);
        this.page.set(1);
        this.loading.set(false);
      });
  }

  openCreate(): void {
    const data: PromotionFormDialogData = { mode: 'create', promotion: null };
    this.dialog
      .open(PromotionFormDialogComponent, { width: 'min(920px, 96vw)', data })
      .afterClosed()
      .subscribe((ok) => ok && this.load());
  }

  openEdit(promotion: PromotionResponseDto): void {
    const data: PromotionFormDialogData = { mode: 'edit', promotion };
    this.dialog
      .open(PromotionFormDialogComponent, { width: 'min(920px, 96vw)', data })
      .afterClosed()
      .subscribe((ok) => ok && this.load());
  }

  confirmDelete(promotion: PromotionResponseDto): void {
    const data: PromotionDeleteDialogData = { id: promotion.id, name: promotion.name ?? promotion.slug };
    this.dialog
      .open(PromotionDeleteDialogComponent, { width: 'min(560px, 92vw)', data })
      .afterClosed()
      .subscribe((ok) => ok && this.load());
  }

  onSearch(v: Event): void {
    this.search.set((v.target as HTMLInputElement).value ?? '');
    this.page.set(1);
  }

  setLevel(v: 'all' | PromotionLevel): void {
    this.levelFilter.set(v);
    this.page.set(1);
  }
  setDiscountType(v: 'all' | DiscountType): void {
    this.discountTypeFilter.set(v);
    this.page.set(1);
  }
  setCoupon(v: 'all' | 'yes' | 'no'): void {
    this.couponFilter.set(v);
    this.page.set(1);
  }
  setActive(v: 'all' | 'yes' | 'no'): void {
    this.activeFilter.set(v);
    this.page.set(1);
  }

  changeSort(k: PromotionSortKey): void {
    if (this.sortKey() === k) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(k);
    this.sortDir.set('asc');
  }

  sortIndicator(k: PromotionSortKey): string {
    if (this.sortKey() !== k) return '';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  prev(): void {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }
  next(): void {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }
}

function switchMapListToFull(api: PromotionService) {
  return (source: Observable<PromotionResponseDto[]>) =>
    source.pipe(
      switchMap((list) => {
        if (!list.length) return of([]);
        return forkJoin(
          list.map((p) =>
            api.getById(p.id).pipe(
              catchError(() => of(p)),
            ),
          ),
        ).pipe(
          map((full) => full as PromotionResponseDto[]),
        );
      }),
    );
}
