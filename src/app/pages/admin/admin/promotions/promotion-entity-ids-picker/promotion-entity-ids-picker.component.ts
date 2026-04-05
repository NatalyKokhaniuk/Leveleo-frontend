import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin, Observable, of } from 'rxjs';
import {
  catchError as rxCatchError,
  debounceTime,
  distinctUntilChanged,
  map as rxMap,
  switchMap,
} from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CategoryService } from '../../../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../../../features/categories/category.types';
import { ProductService } from '../../../../../features/products/product.service';
import { ProductResponseDto } from '../../../../../features/products/product.types';
import { parseGuidCsv } from '../../../../../features/promotions/promotion-optional.util';

export type PromotionEntityIdsKind = 'product' | 'category';

type EntityRow = ProductResponseDto | CategoryResponseDto;

@Component({
  selector: 'app-promotion-entity-ids-picker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    TranslateModule,
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
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);

  /** Товар або категорія — різні API пошуку та підписи. */
  kind = input.required<PromotionEntityIdsKind>();

  searchCtrl = new FormControl<string>('', { nonNullable: true });
  advancedCsv = new FormControl<string>('', { nonNullable: true });

  items = signal<{ id: string; name: string }[]>([]);
  searchOptions = signal<(ProductResponseDto | CategoryResponseDto)[]>([]);
  searchLoading = signal(false);
  advancedOpen = signal(false);

  filteredOptions = computed(() => {
    const sel = new Set(this.items().map((i) => i.id));
    return this.searchOptions().filter((o) => !sel.has(o.id));
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  disabled = false;

  constructor() {
    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.searchOptions.set([]);
          if (typeof q !== 'string' || q.trim().length < 2) {
            this.searchLoading.set(false);
            return of([] as EntityRow[]);
          }
          this.searchLoading.set(true);
          const term = q.trim();
          const termForApi = term.toLocaleLowerCase('uk');
          const req$: Observable<EntityRow[]> =
            this.kind() === 'product'
              ? this.productService.search(termForApi, 1, 20).pipe(rxMap((r) => r.items))
              : this.categoryService.search(termForApi);
          return new Observable<EntityRow[]>((subscriber) => {
            const sub = req$.subscribe({
              next: (list: EntityRow[]) => {
                this.searchLoading.set(false);
                subscriber.next(list);
                subscriber.complete();
              },
              error: () => {
                this.searchLoading.set(false);
                subscriber.next([]);
                subscriber.complete();
              },
            });
            return () => sub.unsubscribe();
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.searchOptions.set(list ?? []));
  }

  displayEntity(o: ProductResponseDto | CategoryResponseDto): string {
    if (this.kind() === 'product') {
      return (o as ProductResponseDto).name;
    }
    const c = o as CategoryResponseDto;
    return c.fullPath ? `${c.name} (${c.fullPath})` : c.name;
  }

  writeValue(value: string | null): void {
    const csv = value ?? '';
    const ids = [...new Set(parseGuidCsv(csv))];
    if (ids.length === 0) {
      this.items.set([]);
      return;
    }
    this.items.set(ids.map((id) => ({ id, name: '…' })));
    this.loadLabelsForIds(ids);
  }

  private loadLabelsForIds(ids: string[]): void {
    const k = this.kind();
    forkJoin(
      ids.map((id) =>
        k === 'product'
          ? this.productService.getById(id).pipe(
              rxCatchError(() => of({ id, name: id, slug: '' } as ProductResponseDto)),
            )
          : this.categoryService.getById(id).pipe(
              rxCatchError(() =>
                of({
                  id,
                  name: id,
                  slug: '',
                  isActive: true,
                  fullPath: '',
                  translations: [],
                } as CategoryResponseDto),
              ),
            ),
      ),
    ).subscribe((rows) => {
      this.items.set(
        ids.map((id, i) => {
          const r = rows[i];
          if (k === 'product') {
            const p = r as ProductResponseDto;
            return { id, name: p.name ?? id };
          }
          const c = r as CategoryResponseDto;
          const name = c.fullPath ? `${c.name} · ${c.fullPath}` : c.name;
          return { id, name: name || id };
        }),
      );
    });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.searchCtrl.disable({ emitEvent: false });
      this.advancedCsv.disable({ emitEvent: false });
    } else {
      this.searchCtrl.enable({ emitEvent: false });
      this.advancedCsv.enable({ emitEvent: false });
    }
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const opt = event.option.value as ProductResponseDto | CategoryResponseDto;
    this.addEntity(opt);
    this.searchCtrl.setValue('', { emitEvent: false });
    this.searchOptions.set([]);
  }

  private addEntity(o: ProductResponseDto | CategoryResponseDto): void {
    const id = o.id;
    if (this.items().some((i) => i.id === id)) {
      return;
    }
    const name = this.displayEntity(o);
    this.items.update((arr) => [...arr, { id, name }]);
    this.emit();
    this.onTouched();
  }

  remove(id: string): void {
    this.items.update((arr) => arr.filter((i) => i.id !== id));
    this.emit();
    this.onTouched();
  }

  private emit(): void {
    const csv = this.items()
      .map((i) => i.id)
      .join(', ');
    this.onChange(csv);
  }

  toggleAdvanced(): void {
    const next = !this.advancedOpen();
    this.advancedOpen.set(next);
    if (next) {
      this.advancedCsv.setValue(this.items().map((i) => i.id).join(', '));
    }
  }

  applyAdvancedCsv(): void {
    const text = this.advancedCsv.value ?? '';
    const ids = [...new Set(parseGuidCsv(text))];
    if (ids.length === 0) {
      this.items.set([]);
      this.emit();
      this.onTouched();
      return;
    }
    this.items.set(ids.map((id) => ({ id, name: '…' })));
    this.loadLabelsForIds(ids);
    this.emit();
    this.onTouched();
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
