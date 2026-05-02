import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

const STORAGE_KEY = 'leveleo.defaultShippingAddressId';

/**
 * Дублювання «улюбленої» адреси в локальному сховищі узгоджено з POST /api/Address/{id}/default;
 * первинним джерелом є `AddressResponseDto.isDefault` із API після синхронізації.
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
