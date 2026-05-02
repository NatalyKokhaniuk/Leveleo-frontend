/**
 * Населений пункт у списках НП від бекенду.
 *
 * `/NovaPoshta/cities/search`: `CityAutocompleteResponseDto` — ключ ідентифікатора лише **`settlementRef`**;
 * текст для option — **`displayLabel`** (на бекенді: `present` або fallback на `mainDescription`).
 * `/NovaPoshta/settlements`: у рядках довідника приходить **`ref`** того ж смислу, що й `settlementRef` у пошуку міст.
 */
export interface NpSettlementOption {
  /** Settlement ref (`ref` / `settlementRef`) — для пошуку **вулиць** (`…/streets/search`). Не підставляти в branches/postomats, якщо є `deliveryCityRef`. */
  ref: string;
  /**
   * Місто доставки НП з поля **`deliveryCity`** (або `deliveryCityRef`) у відповіді міста.
   * Для **`/settlements/{ref}/branches`** та **`/postomats`** у шлях підставляють саме його, а не settlement **`ref`**.
   */
  deliveryCityRef?: string | null;
  /** Рядок для `mat-option` / підказки — за наявності збігається з `displayLabel` із API. */
  description: string;
}

/** Вулиця в населеному пункті (`/settlements/{settlementRef}/streets/search`). */
export interface NpStreetDto {
  settlementRef: string;
  settlementStreetRef: string;
  present: string;
  streetsType?: string | null;
  streetsTypeDescription?: string | null;
}

/** Сторінка довідника населених пунктів: `GET /NovaPoshta/settlements`. */
export interface NpSettlementsPageDto {
  page: number;
  pageSize: number;
  items: NpSettlementDirectoryDto[];
  hasMore: boolean;
}

/** `SettlementDirectoryDto` — `GET /NovaPoshta/settlements`. */
export interface NpSettlementDirectoryDto {
  ref: string;
  description: string;
  descriptionRu?: string | null;
  area?: string | null;
  areaDescription?: string | null;
  region?: string | null;
  regionsDescription?: string | null;
  settlementType?: string | null;
  warehouse?: string | null;
  index?: string | null;
}

/** Відділення / поштомат (`WarehouseDto` на бекенді). */
export interface NpWarehouseDto {
  /** Уніфіковано з warehouseRef у WarehouseAutocompleteResponseDto (внутрішньо — ref для mat-option). */
  ref: string;
  name?: string | null;
  description?: string | null;
  shortAddress?: string | null;
  /** Номер відділення / поштомату з НП. */
  number?: string | null;
  typeOfWarehouse?: string | null;
  typeOfWarehouseRef?: string | null;
}

/** Тип точки на мапі НП — `DeliveryPointDto` на бекенді. */
export type DeliveryPointKind = 'Branch' | 'Postomat';

/** Єдина модель точки для мапи: `GET .../delivery-points`. */
export interface DeliveryPointDto {
  ref: string;
  type: DeliveryPointKind;
  name: string;
  shortAddress: string;
  cityRef: string;
  lat: number;
  lng: number;
}

/** Query до `GET .../settlements/{settlementRef}/delivery-points`. */
export interface DeliveryPointsQueryParams {
  type?: 'branch' | 'postomat' | 'all';
  bbox?: string;
  near?: string;
  radius?: number;
}
