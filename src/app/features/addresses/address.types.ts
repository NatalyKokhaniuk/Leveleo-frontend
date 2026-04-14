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
  /** Якщо бекенд додасть у відповідь — для редагування без повторного вводу ref. */
  cityRef?: string | null;
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
}

/** Тіло PUT /api/Address/{id} — фактично повне оновлення полів як у створенні. */
export type UpdateAddressDto = CreateAddressDto;
