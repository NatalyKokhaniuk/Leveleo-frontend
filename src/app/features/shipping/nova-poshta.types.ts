/** Елемент списку населених пунктів (Нова Пошта / бекенд-проксі). */
export interface NpSettlementOption {
  /** Ref населеного пункту для пошуку вулиць. */
  ref: string;
  /** Ref міста доставки (`deliveryCity`) для пошуку відділень/поштоматів і `POST /api/Address.cityRef`. */
  deliveryCityRef?: string | null;
  /** Повна назва для відображення. */
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

/** Рядок довідника НП (узгоджено з `SettlementDirectoryDto` на бекенді). */
export interface NpSettlementDirectoryDto {
  ref: string;
  description: string;
  /** Опційні поля регіону — для відображення у списку. */
  area?: string | null;
  region?: string | null;
}

/** Відділення / поштомат (`WarehouseDto` на бекенді). */
export interface NpWarehouseDto {
  ref: string;
  name?: string | null;
  description?: string | null;
  shortAddress?: string | null;
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
