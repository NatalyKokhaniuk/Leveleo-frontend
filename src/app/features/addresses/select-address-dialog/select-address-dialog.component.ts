import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DefaultAddressPreferenceService } from '../../../core/services/default-address-preference.service';
import { AddressDeleteDialogComponent } from '../address-delete-dialog/address-delete-dialog.component';
import {
  AddressFormDialogComponent,
  AddressFormDialogData,
  AddressRecipientSnapshot,
} from '../address-form-dialog/address-form-dialog.component';
import { AddressService } from '../address.service';
import {
  AddressResponseDto,
  DeliveryType,
  filterAddressesByDeliveryType,
  reorderAddressListPreferredFirst,
} from '../address.types';

export interface SelectAddressDialogData {
  /** Поточна адреса кошика (підсвітити в списку). */
  selectedId?: string | null;
  /** Id з localStorage — основна адреса; якщо підходить під fixedDeliveryType, обирається автоматично. */
  preferredDefaultId?: string | null;
  /** Режим оформлення замовлення: у формі адреси лише НП-поля. */
  addressFieldsOnly?: boolean;
  fixedDeliveryType?: DeliveryType;
  recipientFromCheckout?: AddressRecipientSnapshot;
}

@Component({
  selector: 'app-select-address-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './select-address-dialog.component.html',
  styleUrl: './select-address-dialog.component.scss',
})
export class SelectAddressDialogComponent implements OnInit {
  private addressApi = inject(AddressService);
  private preference = inject(DefaultAddressPreferenceService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  ref = inject(MatDialogRef<SelectAddressDialogComponent, AddressResponseDto | undefined>);
  data = inject<SelectAddressDialogData>(MAT_DIALOG_DATA);

  loading = signal(true);
  loadError = signal(false);
  addresses = signal<AddressResponseDto[]>([]);
  searchText = signal('');
  pickedId = signal<string | null>(this.data.selectedId ?? null);
  /** Для іконки «основна» після зміни без перезавантаження діалогу. */
  preferredIdUi = signal<string | null>(null);
  /** Коротка анімація рядка після «зробити за замовчуванням». */
  highlightDefaultId = signal<string | null>(null);

  /**
   * Адреси, що відповідають обраному на checkout типу доставки (Warehouse / Postomat / Doors).
   * Якщо fixedDeliveryType не задано — усі адреси (наприклад, загальний вибір у профілі).
   * Адреса за замовчуванням — зверху.
   */
  matchingForDeliveryType = computed(() => {
    const raw = filterAddressesByDeliveryType(this.addresses(), this.data.fixedDeliveryType);
    return reorderAddressListPreferredFirst(raw, this.preferredIdUi());
  });

  filtered = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const base = this.matchingForDeliveryType();
    if (!q) {
      return base;
    }
    const narrowed = base.filter((a) => {
      const hay = [
        a.formattedAddress,
        a.firstName,
        a.lastName,
        a.phoneNumber,
        a.cityName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    return reorderAddressListPreferredFirst(narrowed, this.preferredIdUi());
  });

  /** Підказка, коли список порожній після фільтрації та пошуку. */
  listEmptyHint = computed((): 'search' | 'delivery' | 'profile-empty' | null => {
    if (this.filtered().length > 0) {
      return null;
    }
    const q = this.searchText().trim();
    const matchCount = this.matchingForDeliveryType().length;
    const allCount = this.addresses().length;
    const fixed = this.data.fixedDeliveryType;

    /* Спочатку: для обраного типу доставки немає жодної збереженої адреси */
    if (fixed !== undefined && fixed !== null && matchCount === 0 && allCount > 0) {
      return 'delivery';
    }
    /* Є адреси потрібного типу, але пошук нічого не знайшов */
    if (q && matchCount > 0) {
      return 'search';
    }
    return 'profile-empty';
  });

  ngOnInit(): void {
    this.preferredIdUi.set(this.preference.getPreferredId());
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.addressApi.getMyAddresses().subscribe({
      next: (list) => {
        const stored = this.preference.getPreferredId()?.trim();
        const fromServer = list.find((x) => x.isDefault === true)?.id?.trim();
        const uiPref = stored || fromServer || null;
        this.preferredIdUi.set(uiPref);
        this.addresses.set(reorderAddressListPreferredFirst(list, uiPref));
        this.loading.set(false);
        const forDelivery = this.matchingForDeliveryType();
        let sel = this.pickedId();
        if (sel && !forDelivery.some((a) => a.id === sel)) {
          sel = null;
        }
        if (!sel) {
          const pref = (
            this.data.preferredDefaultId?.trim() ||
            this.preference.getPreferredId() ||
            ''
          ).trim();
          if (pref && forDelivery.some((a) => a.id === pref)) {
            sel = pref;
          } else if (forDelivery.length === 1) {
            sel = forDelivery[0].id;
          }
        }
        this.pickedId.set(sel);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  openCreate(): void {
    const dref = this.dialog.open(AddressFormDialogComponent, {
      width: 'min(560px, 100vw)',
      data: {
        addressFieldsOnly: this.data.addressFieldsOnly,
        fixedDeliveryType: this.data.fixedDeliveryType,
        recipientFromCheckout: this.data.recipientFromCheckout,
      } satisfies AddressFormDialogData,
    });
    dref.afterClosed().subscribe((created) => {
      if (created) {
        this.addresses.update((prev) => [created, ...prev]);
        this.pickedId.set(created.id);
      }
    });
  }

  openEdit(a: AddressResponseDto, ev: Event): void {
    ev.stopPropagation();
    const dref = this.dialog.open(AddressFormDialogComponent, {
      width: 'min(560px, 100vw)',
      data: {
        address: a,
        addressFieldsOnly: this.data.addressFieldsOnly,
        fixedDeliveryType: this.data.fixedDeliveryType,
        recipientFromCheckout: this.data.recipientFromCheckout,
      } satisfies AddressFormDialogData,
    });
    dref.afterClosed().subscribe((updated) => {
      if (updated) {
        this.addresses.update((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        if (this.pickedId() === updated.id) {
          /* ok */
        }
      }
    });
  }

  confirmDelete(a: AddressResponseDto, ev: Event): void {
    ev.stopPropagation();
    const ref = this.dialog.open(AddressDeleteDialogComponent, {
      width: 'min(440px, 100vw)',
      data: { label: a.formattedAddress },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.addressApi.delete(a.id).subscribe({
        next: () => {
          this.addresses.update((prev) => prev.filter((x) => x.id !== a.id));
          if (this.pickedId() === a.id) {
            this.pickedId.set(null);
          }
          if (this.preference.getPreferredId() === a.id) {
            this.preference.clearPreferred();
            this.preferredIdUi.set(null);
          }
          this.snack.open(this.translate.instant('ADDRESS.DELETED'), 'OK', { duration: 2500 });
        },
        error: () => {
          this.snack.open(this.translate.instant('ADDRESS.DELETE_ERROR'), 'OK', { duration: 4000 });
        },
      });
    });
  }

  isPreferredRow(a: AddressResponseDto): boolean {
    if (a.isDefault === true) return true;
    const id = this.preferredIdUi();
    return id != null && id === a.id;
  }

  setAsDefault(a: AddressResponseDto, ev: Event): void {
    ev.stopPropagation();
    this.addressApi.setDefault(a.id).subscribe({
      next: (updated) => {
        this.preference.setPreferredId(a.id);
        this.preferredIdUi.set(a.id);
        this.addresses.update((prev) => {
          const next = prev.map((x) => ({ ...x, isDefault: x.id === updated.id ? true : false }));
          return reorderAddressListPreferredFirst(next, a.id);
        });
        this.highlightDefaultId.set(a.id);
        window.setTimeout(() => this.highlightDefaultId.set(null), 900);
        this.snack.open(this.translate.instant('ADDRESS.DEFAULT_SET'), 'OK', { duration: 2800 });
      },
      error: () => {
        this.snack.open(this.translate.instant('ADDRESS.DEFAULT_SET_ERROR'), 'OK', { duration: 4000 });
      },
    });
  }

  confirm(): void {
    const id = this.pickedId();
    const addr = this.filtered().find((x) => x.id === id);
    this.ref.close(addr);
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}
