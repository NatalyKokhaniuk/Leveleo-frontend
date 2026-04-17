import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AddressResponseDto, CreateAddressDto, DeliveryType, UpdateAddressDto } from './address.types';

const DELIVERY_TYPE_API: Record<DeliveryType, string> = {
  [DeliveryType.Warehouse]: 'Warehouse',
  [DeliveryType.Doors]: 'Doors',
  [DeliveryType.Postomat]: 'Postomat',
};

/** Бекенд очікує рядок enum (JsonStringEnumConverter), не число. */
function serializeAddressBody(dto: CreateAddressDto | UpdateAddressDto): Record<string, unknown> {
  return {
    ...dto,
    deliveryType: DELIVERY_TYPE_API[dto.deliveryType] ?? 'Warehouse',
  };
}

function asAddressList(data: unknown): AddressResponseDto[] {
  if (Array.isArray(data)) return data as AddressResponseDto[];
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as AddressResponseDto[];
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private api = inject(ApiService);
  private readonly base = '/Address';

  getMyAddresses(): Observable<AddressResponseDto[]> {
    return this.api.get<unknown>(`${this.base}/myaddresses`).pipe(map(asAddressList));
  }

  getById(id: string): Observable<AddressResponseDto> {
    return this.api.get<AddressResponseDto>(`${this.base}/${id}`);
  }

  create(dto: CreateAddressDto): Observable<AddressResponseDto> {
    return this.api.post<AddressResponseDto>(`${this.base}`, serializeAddressBody(dto));
  }

  /**
   * PUT /api/Address/{id}. На бекенді — UpdateAddressDto з Optional.
   * Відправляємо повний набір полів як у CreateAddressDto; якщо десеріалізація Optional інша — узгодьте з бекендом.
   */
  update(id: string, dto: UpdateAddressDto): Observable<AddressResponseDto> {
    return this.api.put<AddressResponseDto>(`${this.base}/${id}`, serializeAddressBody(dto));
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete(`${this.base}/${id}`);
  }

  setDefault(id: string): Observable<AddressResponseDto> {
    return this.api.post<AddressResponseDto>(`${this.base}/${id}/default`, {});
  }
}
