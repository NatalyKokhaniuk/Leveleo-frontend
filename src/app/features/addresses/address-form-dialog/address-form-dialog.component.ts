import {
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NovaPoshtaService } from '../../shipping/nova-poshta.service';
import { NpSettlementOption } from '../../shipping/nova-poshta.types';
import { AddressService } from '../address.service';
import {
  AddressResponseDto,
  CreateAddressDto,
  DeliveryType,
} from '../address.types';

export interface AddressFormDialogData {
  /** Якщо задано — режим редагування. */
  address?: AddressResponseDto | null;
}

@Component({
  selector: 'app-address-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './address-form-dialog.component.html',
})
export class AddressFormDialogComponent implements OnInit {
  @ViewChild('cityTrigger') cityTrigger?: MatAutocompleteTrigger;

  private fb = inject(FormBuilder);
  private addressApi = inject(AddressService);
  private auth = inject(AuthService);
  private np = inject(NovaPoshtaService);
  private destroyRef = inject(DestroyRef);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  ref = inject(MatDialogRef<AddressFormDialogComponent, AddressResponseDto | undefined>);
  data = inject<AddressFormDialogData>(MAT_DIALOG_DATA);

  readonly DeliveryType = DeliveryType;

  busy = false;

  /** Повний довідник НП (`/NovaPoshta/settlements`), підвантажується після фокусу на полі. */
  settlementDirectory = signal<NpSettlementOption[]>([]);
  /** Локальний довідник з уже збережених адрес (додається до повного). */
  savedCityOptions = signal<NpSettlementOption[]>([]);
  /** Текст у полі — миттєве оновлення для клієнтського фільтра. */
  citySearchText = signal('');
  /** Щоб не показувати тисячі пунктів до першого фокусу на полі. */
  cityFieldEverFocused = signal(false);
  /**
   * Порожній рядок після фокусу — усі пункти з довідника (+ збережені адреси);
   * якщо є введення — лише ті, що містять підрядок (без урахування регістру).
   */
  displayedCityOptions = computed(() => {
    const q = this.citySearchText().trim().toLowerCase();
    const raw = mergeCityOptions(this.savedCityOptions(), this.settlementDirectory());
    if (!q && !this.cityFieldEverFocused()) return [];
    if (!q) return raw;
    return raw.filter((o) => o.description.toLowerCase().includes(q));
  });
  directoryLoading = signal(false);

  constructor() {
    effect(() => {
      const opts = this.displayedCityOptions();
      const loading = this.directoryLoading();
      if (loading || opts.length === 0) return;
      untracked(() => queueMicrotask(() => this.cityTrigger?.openPanel()));
    });
  }

  /** Останній вибір зі списку (щоб скинути ref при ручній зміні тексту). */
  private lastPicked: NpSettlementOption | null = null;

  /** mat-select інколи дає рядок — порівнюємо через число. */
  isDeliveryType(dt: DeliveryType): boolean {
    return Number(this.form.get('deliveryType')?.value) === dt;
  }

  form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    middleName: [''],
    phoneNumber: ['', Validators.required],
    deliveryType: [DeliveryType.Warehouse as DeliveryType],
    /** Пошук і відображення назви; ref заповнюється з випадаючого списку. */
    citySearch: [
      '',
      [
        (ctrl: AbstractControl): ValidationErrors | null => {
          const ref = ctrl.parent?.get('cityRef')?.value;
          return typeof ref === 'string' && ref.trim() ? null : { settlementRequired: true };
        },
      ],
    ],
    cityRef: ['', Validators.required],
    cityName: [''],
    warehouseRef: [''],
    streetRef: [''],
    street: [''],
    house: [''],
    flat: [''],
    floor: [''],
    postomatRef: [''],
    postomatDescription: [''],
    additionalInfo: [''],
  });

  ngOnInit(): void {
    const citySearchCtrl = this.form.get('citySearch');
    this.citySearchText.set(String(citySearchCtrl?.value ?? ''));

    // Fallback-джерело міст: унікальні cityName з Address/myaddresses.
    this.addressApi.getMyAddresses().subscribe({
      next: (list) => {
        const byRef = new Map<string, NpSettlementOption>();
        for (const a of list) {
          const cityName = String(a.cityName ?? '').trim();
          if (!cityName) continue;
          const ref = String(a.cityRef ?? cityName).trim();
          if (!ref) continue;
          if (!byRef.has(ref)) {
            byRef.set(ref, { ref, description: cityName });
          }
        }
        const local = Array.from(byRef.values());
        this.savedCityOptions.set(local);
      },
      error: () => {
        this.savedCityOptions.set([]);
      },
    });

    citySearchCtrl?.valueChanges
      .pipe(
        tap((q) => {
          this.citySearchText.set(String(q ?? ''));
          const t = String(q ?? '').trim();
          if (!this.lastPicked) return;
          if (t === '' || t !== this.lastPicked.description.trim()) {
            this.form.patchValue({ cityRef: '', cityName: '' }, { emitEvent: false });
            this.lastPicked = null;
            this.form.get('citySearch')?.updateValueAndValidity({ emitEvent: false });
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    const a = this.data.address;
    if (a) {
      const cityName = a.cityName ?? '';
      this.lastPicked =
        a.cityRef && cityName ? { ref: a.cityRef, description: cityName } : null;
      this.form.patchValue(
        {
          firstName: a.firstName,
          lastName: a.lastName,
          middleName: a.middleName ?? '',
          phoneNumber: a.phoneNumber,
          deliveryType: a.deliveryType,
          citySearch: cityName,
          cityRef: a.cityRef ?? '',
          cityName,
          warehouseRef: a.warehouseRef ?? '',
          streetRef: a.streetRef ?? '',
          street: a.street ?? '',
          house: a.house ?? '',
          flat: a.flat ?? '',
          postomatRef: a.postomatRef ?? '',
          postomatDescription: a.postomatDescription ?? '',
          additionalInfo: a.additionalInfo ?? '',
        },
        { emitEvent: false },
      );
      this.citySearchText.set(cityName);
      this.cityFieldEverFocused.set(true);
      this.loadSettlementDirectoryFromApi();
    } else {
      this.applyCreateDefaultsFromProfileAndSavedAddresses();
    }
    this.form.get('deliveryType')?.valueChanges.subscribe(() => this.applyTypeValidators());
    this.applyTypeValidators();
  }

  /** Клік / фокус на «Населений пункт» — відкрити повний довідник (з кешу або з бекенду). */
  onCityFieldActivate(): void {
    this.cityFieldEverFocused.set(true);
    if (this.settlementDirectory().length > 0) {
      queueMicrotask(() => this.cityTrigger?.openPanel());
      return;
    }
    this.loadSettlementDirectoryFromApi();
  }

  private loadSettlementDirectoryFromApi(): void {
    if (this.directoryLoading()) return;
    this.directoryLoading.set(true);
    this.np
      .loadAllSettlementsDirectory()
      .pipe(
        finalize(() => this.directoryLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (all) => {
          this.settlementDirectory.set(all);
          queueMicrotask(() => this.cityTrigger?.openPanel());
        },
      });
  }

  /**
   * Нове замовлення: ім'я / прізвище / телефон з поточного користувача (UserResponseDto у auth);
   * по батькові — з першої збереженої адреси, де воно заповнене.
   */
  private applyCreateDefaultsFromProfileAndSavedAddresses(): void {
    const u = this.auth.currentUser();
    if (u) {
      const patch: {
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
      } = {};
      if (u.firstName?.trim()) patch.firstName = u.firstName.trim();
      if (u.lastName?.trim()) patch.lastName = u.lastName.trim();
      if (u.phoneNumber?.trim()) patch.phoneNumber = u.phoneNumber.trim();
      if (Object.keys(patch).length > 0) {
        this.form.patchValue(patch, { emitEvent: false });
      }
    }

    this.addressApi.getMyAddresses().subscribe({
      next: (list) => {
        const withMiddle = list.find((x) => (x.middleName ?? '').trim().length > 0);
        const m = withMiddle?.middleName?.trim();
        if (m) {
          this.form.patchValue({ middleName: m }, { emitEvent: false });
        }
      },
      error: () => {
        /* ігноруємо — форма лишається з полями з профілю */
      },
    });
  }

  onCityPicked(ref: string): void {
    const merged = mergeCityOptions(this.savedCityOptions(), this.settlementDirectory());
    const opt =
      this.displayedCityOptions().find((o) => o.ref === ref) ?? merged.find((o) => o.ref === ref);
    if (!opt) return;
    this.lastPicked = opt;
    this.form.patchValue(
      {
        cityRef: opt.ref,
        cityName: opt.description,
        citySearch: opt.description,
      },
      { emitEvent: false },
    );
    this.form.get('citySearch')?.updateValueAndValidity({ emitEvent: false });
  }

  private applyTypeValidators(): void {
    const raw = this.form.get('deliveryType')?.value;
    let t = Number(raw);
    if (Number.isNaN(t)) {
      t = DeliveryType.Warehouse;
    }
    const wRef = this.form.get('warehouseRef');
    const str = this.form.get('street');
    const h = this.form.get('house');
    const pr = this.form.get('postomatRef');
    const pd = this.form.get('postomatDescription');

    wRef?.clearValidators();
    str?.clearValidators();
    h?.clearValidators();
    pr?.clearValidators();
    pd?.clearValidators();

    if (t === DeliveryType.Warehouse) {
      wRef?.setValidators([Validators.required]);
    } else if (t === DeliveryType.Doors) {
      str?.setValidators([Validators.required]);
      h?.setValidators([Validators.required]);
    } else if (t === DeliveryType.Postomat) {
      pr?.setValidators([Validators.required]);
      pd?.setValidators([Validators.required]);
    }

    wRef?.updateValueAndValidity({ emitEvent: false });
    str?.updateValueAndValidity({ emitEvent: false });
    h?.updateValueAndValidity({ emitEvent: false });
    pr?.updateValueAndValidity({ emitEvent: false });
    pd?.updateValueAndValidity({ emitEvent: false });
  }

  submit(): void {
    if (this.form.invalid || this.busy) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const deliveryType = Number(v.deliveryType) as DeliveryType;
    const dto: CreateAddressDto = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      middleName: (v.middleName ?? '').trim(),
      phoneNumber: v.phoneNumber.trim(),
      deliveryType,
      cityRef: v.cityRef.trim(),
      cityName: v.cityName?.trim() || null,
      warehouseRef: null,
      streetRef: v.streetRef?.trim() || null,
      street: v.street?.trim() || null,
      house: v.house?.trim() || null,
      flat: v.flat?.trim() || null,
      floor: v.floor?.trim() || null,
      additionalInfo: v.additionalInfo?.trim() || null,
      postomatRef: null,
      postomatDescription: null,
    };

    if (deliveryType === DeliveryType.Warehouse) {
      dto.warehouseRef = v.warehouseRef.trim();
    } else if (deliveryType === DeliveryType.Postomat) {
      dto.postomatRef = v.postomatRef.trim();
      dto.postomatDescription = v.postomatDescription.trim();
      dto.warehouseRef = v.postomatRef.trim();
    }

    this.busy = true;
    const existing = this.data.address;
    const req = existing
      ? this.addressApi.update(existing.id, dto)
      : this.addressApi.create(dto);

    req.subscribe({
      next: (res) => {
        this.busy = false;
        this.ref.close(res);
      },
      error: (err) => {
        this.busy = false;
        const code = err?.error?.errorCode ?? err?.error?.ErrorCode;
        const msg =
          code && this.translate.instant(code) !== code
            ? this.translate.instant(code)
            : this.translate.instant('ADDRESS.SAVE_ERROR');
        this.snack.open(msg, 'OK', { duration: 4000 });
      },
    });
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}

function mergeCityOptions(
  fromSaved: NpSettlementOption[],
  fromApi: NpSettlementOption[],
): NpSettlementOption[] {
  const out = new Map<string, NpSettlementOption>();
  for (const x of [...fromSaved, ...fromApi]) {
    const ref = String(x.ref ?? '').trim();
    const description = String(x.description ?? '').trim();
    if (!ref || !description) continue;
    if (!out.has(ref)) {
      out.set(ref, { ref, description });
    }
  }
  return Array.from(out.values());
}
