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
function serializeAddressBody(
  dto: CreateAddressDto | UpdateAddressDto,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...dto,
    deliveryType: DELIVERY_TYPE_API[dto.deliveryType] ?? 'Warehouse',
  };
  if (mode === 'update') {
    delete body['setAsPrimary'];
  } else if (body['setAsPrimary'] !== true) {
    delete body['setAsPrimary'];
  }
  return body;
}

function asAddressList(data: unknown): AddressResponseDto[] {
  if (Array.isArray(data)) return data.map(normalizeAddressResponse).filter((x): x is AddressResponseDto => !!x);
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items.map(normalizeAddressResponse).filter((x): x is AddressResponseDto => !!x);
    }
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
    return this.api.get<unknown>(`${this.base}/${id}`).pipe(
      map((raw) => normalizeAddressResponse(raw) ?? ({} as AddressResponseDto)),
    );
  }

  create(dto: CreateAddressDto): Observable<AddressResponseDto> {
    return this.api
      .post<unknown>(`${this.base}`, serializeAddressBody(dto, 'create'))
      .pipe(map((raw) => normalizeAddressResponse(raw) ?? ({} as AddressResponseDto)));
  }

  /**
   * PUT /api/Address/{id}. На бекенді — UpdateAddressDto з Optional.
   * Відправляємо повний набір полів як у CreateAddressDto; якщо десеріалізація Optional інша — узгодьте з бекендом.
   */
  update(id: string, dto: UpdateAddressDto): Observable<AddressResponseDto> {
    return this.api
      .put<unknown>(`${this.base}/${id}`, serializeAddressBody(dto, 'update'))
      .pipe(map((raw) => normalizeAddressResponse(raw) ?? ({} as AddressResponseDto)));
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete(`${this.base}/${id}`);
  }

  setDefault(id: string): Observable<AddressResponseDto> {
    return this.api
      .post<unknown>(`${this.base}/${id}/default`, {})
      .pipe(map((raw) => normalizeAddressResponse(raw) ?? ({} as AddressResponseDto)));
  }
}

function normalizeAddressResponse(raw: unknown): AddressResponseDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o['id'] ?? o['Id'] ?? '').trim();
  if (!id) return null;
  const isDefaultRaw = o['isDefault'] ?? o['IsDefault'];
  const isDefault = typeof isDefaultRaw === 'boolean' ? isDefaultRaw : undefined;
  return {
    id,
    firstName: String(o['firstName'] ?? o['FirstName'] ?? ''),
    lastName: String(o['lastName'] ?? o['LastName'] ?? ''),
    middleName: String(o['middleName'] ?? o['MiddleName'] ?? ''),
    phoneNumber: String(o['phoneNumber'] ?? o['PhoneNumber'] ?? ''),
    deliveryType: parseDeliveryType(o['deliveryType'] ?? o['DeliveryType']),
    formattedAddress: String(o['formattedAddress'] ?? o['FormattedAddress'] ?? ''),
    cityName: strOrNull(o['cityName'] ?? o['CityName']),
    warehouseDescription: strOrNull(o['warehouseDescription'] ?? o['WarehouseDescription']),
    street: strOrNull(o['street'] ?? o['Street']),
    house: strOrNull(o['house'] ?? o['House']),
    flat: strOrNull(o['flat'] ?? o['Flat']),
    additionalInfo: strOrNull(o['additionalInfo'] ?? o['AdditionalInfo']),
    ...(isDefault !== undefined ? { isDefault } : {}),
    cityRef: strOrNull(o['cityRef'] ?? o['CityRef']),
    settlementRef: strOrNull(o['settlementRef'] ?? o['SettlementRef']),
    warehouseRef: strOrNull(o['warehouseRef'] ?? o['WarehouseRef']),
    streetRef: strOrNull(o['streetRef'] ?? o['StreetRef']),
    postomatRef: strOrNull(o['postomatRef'] ?? o['PostomatRef']),
    postomatDescription: strOrNull(o['postomatDescription'] ?? o['PostomatDescription']),
  };
}

function parseDeliveryType(v: unknown): DeliveryType {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'doors' || s === '1') return DeliveryType.Doors;
  if (s === 'postomat' || s === '2') return DeliveryType.Postomat;
  return DeliveryType.Warehouse;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
