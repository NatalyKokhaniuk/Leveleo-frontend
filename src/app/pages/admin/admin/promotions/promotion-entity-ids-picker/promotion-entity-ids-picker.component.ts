import { CommonModule } from '@angular/common';
import { Component, forwardRef, inject, Input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CategoryService } from '../../../../../features/categories/category.service';
import { ProductService } from '../../../../../features/products/product.service';
import { parseGuidCsv } from '../../../../../features/promotions/promotion-optional.util';

type PickerItem = { id: string; name: string };

@Component({
  selector: 'app-promotion-entity-ids-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './promotion-entity-ids-picker.component.html',
  styleUrl: './promotion-entity-ids-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PromotionEntityIdsPickerComponent),
      multi: true,
    },
  ],
})
export class PromotionEntityIdsPickerComponent implements ControlValueAccessor {
  @Input({ required: true }) kind: 'product' | 'category' = 'product';

  private products = inject(ProductService);
  private categories = inject(CategoryService);

  value = '';
  search = '';
  suggestions = signal<PickerItem[]>([]);
  selectedItems = signal<PickerItem[]>([]);
  loading = signal(false);
  disabled = false;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  get ids(): string[] {
    return parseGuidCsv(this.value);
  }

  writeValue(obj: string | null): void {
    this.value = obj ?? '';
    this.syncSelectedItemsFromValue();
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  private emit(v: string): void {
    this.value = v;
    this.onChange(v);
    this.onTouched();
    this.syncSelectedItemsFromValue();
  }

  onSearchInput(v: string): void {
    this.search = v;
    const q = v.trim();
    if (q.length < 2) {
      this.suggestions.set([]);
      return;
    }
    this.loading.set(true);
    const req =
      this.kind === 'product'
        ? this.products.search(q, 1, 8).pipe(
            map((payload: unknown) => {
              const items = ((payload as { items?: unknown[] } | null)?.items ?? []) as Array<{
                id: unknown;
                name?: unknown;
                slug?: unknown;
              }>;
              return items
                .map((x) => ({ id: String(x.id), name: String(x.name ?? x.slug ?? x.id) }))
                .filter((x) => !!x.id);
            }),
            catchError(() => of([] as PickerItem[])),
          )
        : this.categories.search(q).pipe(
            map((payload: unknown) => {
              const list = (payload ?? []) as Array<{ id: unknown; name?: unknown; slug?: unknown }>;
              return list
                .map((x) => ({ id: String(x.id), name: String(x.name ?? x.slug ?? x.id) }))
                .filter((x) => !!x.id);
            }),
            catchError(() => of([] as PickerItem[])),
          );
    req.subscribe((items) => {
      this.suggestions.set(items);
      this.loading.set(false);
    });
  }

  add(id: string): void {
    const picked = this.suggestions().find((s) => s.id === id);
    const ids = this.ids;
    if (ids.includes(id)) return;
    this.emit([...ids, id].join(', '));
    if (picked) {
      this.selectedItems.update((list) => {
        if (list.some((x) => x.id === picked.id)) return list;
        return [...list, picked];
      });
    }
  }

  remove(id: string): void {
    this.emit(this.ids.filter((x) => x !== id).join(', '));
    this.selectedItems.update((list) => list.filter((x) => x.id !== id));
  }

  private syncSelectedItemsFromValue(): void {
    const ids = this.ids;
    if (!ids.length) {
      this.selectedItems.set([]);
      return;
    }
    forkJoin(ids.map((id) => this.resolveItem(id))).subscribe((items) => {
      this.selectedItems.set(items);
    });
  }

  private resolveItem(id: string) {
    const existing = this.selectedItems().find((x) => x.id === id);
    if (existing) {
      return of(existing);
    }
    if (this.kind === 'product') {
      return this.products.getById(id).pipe(
        map((p) => ({ id: p.id, name: p.name || p.slug || p.id })),
        catchError(() => of({ id, name: id })),
      );
    }
    return this.categories.getById(id).pipe(
      map((c) => ({ id: c.id, name: c.name || c.slug || c.id })),
      catchError(() => of({ id, name: id })),
    );
  }
}
