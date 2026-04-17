import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

const STORAGE_KEY = 'leveleo.defaultShippingAddressId';

/**
 * Поки бекенд не віддає прапорець «default» у AddressResponseDto, зберігаємо id обраної
 * «основної» адреси в localStorage і паралельно викликаємо POST /api/Address/{id}/default (AddressService.setDefault).
 */
@Injectable({ providedIn: 'root' })
export class DefaultAddressPreferenceService {
  private platformId = inject(PLATFORM_ID);

  getPreferredId(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    try {
      const v = localStorage.getItem(STORAGE_KEY)?.trim();
      return v && v.length > 0 ? v : null;
    } catch {
      return null;
    }
  }

  setPreferredId(id: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* quota / private mode */
    }
  }

  clearPreferred(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* */
    }
  }
}
