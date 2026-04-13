/** Елемент списку населених пунктів (Нова Пошта / бекенд-проксі). */
export interface NpSettlementOption {
  /** Ref населеного пункту в API НП (cityRef у адресі). */
  ref: string;
  /** Повна назва для відображення. */
  description: string;
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
  description?: string | null;
  shortAddress?: string | null;
  typeOfWarehouse?: string | null;
  typeOfWarehouseRef?: string | null;
}
