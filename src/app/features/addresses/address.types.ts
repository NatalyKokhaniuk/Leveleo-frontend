/** Відповідає LeveLEO.Features.Shipping.Models.DeliveryType */
export enum DeliveryType {
  Warehouse = 0,
  Doors = 1,
  Postomat = 2,
}

/** GET /api/Address — AddressResponseDto */
export interface AddressResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  deliveryType: DeliveryType;
  formattedAddress: string;
  cityName: string | null;
  warehouseDescription: string | null;
  street: string | null;
  house: string | null;
  flat: string | null;
  additionalInfo: string | null;
  /** Основна адреса користувача (поле БД IsDefault). */
  isDefault?: boolean;
  /** Якщо бекенд додасть у відповідь — для редагування без повторного вводу ref. */
  cityRef?: string | null;
  /** Ref населеного пункту НП для `GET …/settlements/{ref}/branches|postomats`. */
  settlementRef?: string | null;
  warehouseRef?: string | null;
  streetRef?: string | null;
  postomatRef?: string | null;
  postomatDescription?: string | null;
}

/** POST /api/Address — CreateAddressDto */
export interface CreateAddressDto {
  firstName: string;
  lastName: string;
  middleName: string;
  phoneNumber: string;
  deliveryType: DeliveryType;
  cityRef: string;
  cityName: string | null;
  /** Назва/опис відділення (без ref). */
  warehouseDescription?: string | null;
  warehouseRef: string | null;
  streetRef: string | null;
  street: string | null;
  house: string | null;
  flat: string | null;
  floor: string | null;
  additionalInfo: string | null;
  /** Якщо бекенд підтримує поштомат. */
  postomatRef?: string | null;
  postomatDescription?: string | null;
  /** Явно позначити як основну (разом із POST …/address/{id}/default). */
  setAsPrimary?: boolean;
}

/** Тіло PUT /api/Address/{id} — фактично повне оновлення полів як у створенні. */
export type UpdateAddressDto = CreateAddressDto;

/**
 * Залишає лише адреси з тим самим `deliveryType`, що й обраний спосіб доставки на checkout.
 * Warehouse — відділення НП, Postomat — поштомат, Doors — кур'єр.
 * Якщо `deliveryType` не передано — повертає весь список (без фільтра).
 */
export function filterAddressesByDeliveryType(
  addresses: AddressResponseDto[],
  deliveryType: DeliveryType | null | undefined,
): AddressResponseDto[] {
  if (deliveryType === undefined || deliveryType === null) {
    return addresses;
  }
  return addresses.filter((a) => a.deliveryType === deliveryType);
}

/** Адресу за замовчуванням — на початок списку (localStorage або `isDefault` із API). */
export function reorderAddressListPreferredFirst(
  addresses: AddressResponseDto[],
  preferredId: string | null | undefined,
): AddressResponseDto[] {
  const pid = preferredId?.trim();
  const list = [...addresses];
  const fallbackDefault = list.find((a) => a.isDefault === true)?.id ?? null;
  const target =
    pid && list.some((a) => a.id === pid)
      ? pid
      : fallbackDefault;
  if (!target) return list;
  const idx = list.findIndex((a) => a.id === target);
  if (idx <= 0) return list;
  const next = [...list];
  const [row] = next.splice(idx, 1);
  return [row, ...next];
}
