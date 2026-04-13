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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AddressDeleteDialogComponent } from '../address-delete-dialog/address-delete-dialog.component';
import {
  AddressFormDialogComponent,
  AddressFormDialogData,
} from '../address-form-dialog/address-form-dialog.component';
import { AddressService } from '../address.service';
import { AddressResponseDto } from '../address.types';

export interface SelectAddressDialogData {
  /** Поточна адреса кошика (підсвітити в списку). */
  selectedId?: string | null;
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
    TranslateModule,
  ],
  templateUrl: './select-address-dialog.component.html',
})
export class SelectAddressDialogComponent implements OnInit {
  private addressApi = inject(AddressService);
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

  filtered = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const list = this.addresses();
    if (!q) return list;
    return list.filter((a) => {
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
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.addressApi.getMyAddresses().subscribe({
      next: (list) => {
        this.addresses.set(list);
        this.loading.set(false);
        if (!this.pickedId() && list.length === 1) {
          this.pickedId.set(list[0].id);
        }
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
      data: {} satisfies AddressFormDialogData,
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
      data: { address: a } satisfies AddressFormDialogData,
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
          this.snack.open(this.translate.instant('ADDRESS.DELETED'), 'OK', { duration: 2500 });
        },
        error: () => {
          this.snack.open(this.translate.instant('ADDRESS.DELETE_ERROR'), 'OK', { duration: 4000 });
        },
      });
    });
  }

  confirm(): void {
    const id = this.pickedId();
    const addr = this.addresses().find((x) => x.id === id);
    this.ref.close(addr);
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}
