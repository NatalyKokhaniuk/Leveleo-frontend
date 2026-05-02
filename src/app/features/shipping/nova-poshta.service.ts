import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import {
  DeliveryPointDto,
  DeliveryPointsQueryParams,
  DeliveryPointKind,
  NpSettlementDirectoryDto,
  NpSettlementOption,
  NpSettlementsPageDto,
  NpStreetDto,
  NpWarehouseDto,
} from './nova-poshta.types';

/**
 * Клієнт до `NovaPoshtaController` на бекенді (`/api/NovaPoshta/...`) — контролер під **[Authorize]**.
 *
 * **Порожній список міст на UI:** у DevTools подивіться саме **HTTP-статус** `GET …/api/NovaPoshta/cities/search`:
 * - **401** — немає або прострочений JWT; глобальний інтерцептор додає `Authorization: Bearer …` лише якщо в `AuthService` є access token (зазвичай після логіну).
 * - **200** і `[]` у тілі — логіка/відповідь НП на бекенді (див. fallback `getSettlements` у `SearchCitiesAsync`).
 *
 * **Локальна розробка:** `proxy.conf.json` має проксувати `/api` на хост ASP.NET (типово `http://localhost:8080`). Підставте свій порт/хост, якщо відрізняється.
 *
 * Ендпоінти:
 * - `GET .../cities/search?query=&limit=` — автокомпліт міст;
 * - `GET .../settlements?page=&find=` — довідник з пагінацією;
 * - `GET .../settlements/{ref}/postomats` — поштомати;
 * - `GET .../settlements/{ref}/branches` — відділення (не поштомати);
 * - `GET .../settlements/{ref}/delivery-points` — універсальний список точок для мапи.
 */
@Injectable({ providedIn: 'root' })
export class NovaPoshtaService {
  private api = inject(ApiService);

  private readonly base = '/NovaPoshta';
  private readonly defaultSearchLimit = 20;
  /** Захист від нескінченного циклу, якщо `hasMore` некоректний. */
  private readonly maxSettlementPages = 500;
  /** Кеш повного довідника в межах сесії (щоб не тягнути тисячі записів при кожному відкритті форми). */
  private fullSettlementsCache: NpSettlementOption[] | null = null;

  /**
   * Онлайн-пошук міст (`searchSettlements` на стороні НП).
   */
  searchCities(query: string, limit = this.defaultSearchLimit): Observable<NpSettlementOption[]> {
    const q = query.trim();
    if (q.length < 1) {
      return of([]);
    }
    const encQ = encodeURIComponent(q);
    const url = `${this.base}/cities/search?query=${encQ}&limit=${encodeURIComponent(String(limit))}`;
    return this.api.get<unknown>(url).pipe(
      map((data) => dedupeByRef(normalizeSettlements(data))),
      catchError((err: { status?: number }) => {
        const st = err?.status;
        console.warn('[NovaPoshta] searchCities failed', st != null ? `(HTTP ${st})` : '', url, err);
        return of([]);
      }),
    );
  }

  /**
   * Сторінка повного довідника населених пунктів (до ~150 записів на сторінку).
   */
  getSettlementsPage(page: number, find = ''): Observable<NpSettlementsPageDto> {
    const encPage = encodeURIComponent(String(Math.max(1, page)));
    const encFind = encodeURIComponent(find.trim());
    const url = `${this.base}/settlements?page=${encPage}&find=${encFind}`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeSettlementsPage(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] getSettlementsPage failed', url, err);
        return of(emptySettlementsPage());
      }),
    );
  }

  /**
   * Усі сторінки довідника `settlements?page=&find=` (порожній find — повний довідник).
   * Результат кешується до перезавантаження сторінки; передайте `forceRefresh` після оновлення НП на бекенді.
   */
  loadAllSettlementsDirectory(forceRefresh = false): Observable<NpSettlementOption[]> {
    if (!forceRefresh && this.fullSettlementsCache !== null) {
      return of(this.fullSettlementsCache);
    }
    const fetchAccumulated = (
      page: number,
      acc: NpSettlementOption[],
    ): Observable<NpSettlementOption[]> => {
      if (page > this.maxSettlementPages) {
        console.warn('[NovaPoshta] loadAllSettlementsDirectory: max pages limit');
        return of(dedupeByRef(acc));
      }
      return this.getSettlementsPage(page, '').pipe(
        switchMap((dto) => {
          const batch = dto.items.map((i) => ({ ref: i.ref, description: i.description }));
          const next = dedupeByRef([...acc, ...batch]);
          if (dto.hasMore) {
            return fetchAccumulated(page + 1, next);
          }
          return of(next);
        }),
      );
    };
    return fetchAccumulated(1, []).pipe(
      tap((all) => {
        if (all.length > 0) {
          this.fullSettlementsCache = all;
        }
      }),
      catchError((err) => {
        console.warn('[NovaPoshta] loadAllSettlementsDirectory failed', err);
        return of([]);
      }),
    );
  }

  /** Скидання кешу довідника (наприклад після виходу з облікового запису). */
  clearSettlementsDirectoryCache(): void {
    this.fullSettlementsCache = null;
  }

  /**
   * @param settlementRef Ref **міста доставки** (`deliveryCity` з відповіді `/cities/search`, на формі — `cityRef`), не settlement `ref`.
   */
  getPostomatsBySettlement(settlementRef: string): Observable<NpWarehouseDto[]> {
    const ref = settlementRef.trim();
    if (!ref) return of([]);
    const url = `${this.base}/settlements/${encodeURIComponent(ref)}/postomats`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeWarehouses(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] getPostomatsBySettlement failed', url, err);
        return of([]);
      }),
    );
  }

  /** @param settlementRef Див. `getPostomatsBySettlement`. */
  searchPostomatsBySettlement(settlementRef: string, findByString: string): Observable<NpWarehouseDto[]> {
    const ref = settlementRef.trim();
    if (!ref) return of([]);
    const find = findByString.trim();
    const q = find ? `?findByString=${encodeURIComponent(find)}` : '';
    const url = `${this.base}/settlements/${encodeURIComponent(ref)}/postomats${q}`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeWarehouses(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] searchPostomatsBySettlement failed', url, err);
        return of([]);
      }),
    );
  }

  /** @param settlementRef Див. `getPostomatsBySettlement`. */
  getBranchesBySettlement(settlementRef: string): Observable<NpWarehouseDto[]> {
    const ref = settlementRef.trim();
    if (!ref) return of([]);
    const url = `${this.base}/settlements/${encodeURIComponent(ref)}/branches`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeWarehouses(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] getBranchesBySettlement failed', url, err);
        return of([]);
      }),
    );
  }

  /** @param settlementRef Див. `getPostomatsBySettlement`. */
  searchBranchesBySettlement(settlementRef: string, findByString: string): Observable<NpWarehouseDto[]> {
    const ref = settlementRef.trim();
    if (!ref) return of([]);
    const find = findByString.trim();
    const q = find ? `?findByString=${encodeURIComponent(find)}` : '';
    const url = `${this.base}/settlements/${encodeURIComponent(ref)}/branches${q}`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeWarehouses(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] searchBranchesBySettlement failed', url, err);
        return of([]);
      }),
    );
  }

  /** @param settlementRef Ref населеного пункту з поля **`ref`** (на формі `settlementRef`), не `deliveryCity`. */
  searchStreetsBySettlement(settlementRef: string, query: string): Observable<NpStreetDto[]> {
    const ref = settlementRef.trim();
    const q = query.trim();
    if (!ref || q.length < 1) return of([]);
    const url = `${this.base}/settlements/${encodeURIComponent(ref)}/streets/search?query=${encodeURIComponent(q)}`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeStreets(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] searchStreetsBySettlement failed', url, err);
        return of([]);
      }),
    );
  }

  /**
   * Точки для мапи: `GET .../settlements/{settlementRef}/delivery-points`.
   * Параметри: type, bbox, near, radius — як у контракту бекенду.
   */
  getDeliveryPoints(
    settlementRef: string,
    params: DeliveryPointsQueryParams = {},
  ): Observable<DeliveryPointDto[]> {
    const ref = settlementRef.trim();
    if (!ref) return of([]);
    const qs: string[] = [];
    if (params.type) qs.push(`type=${encodeURIComponent(params.type)}`);
    if (params.bbox) qs.push(`bbox=${encodeURIComponent(params.bbox)}`);
    if (params.near) qs.push(`near=${encodeURIComponent(params.near)}`);
    if (params.radius != null && Number.isFinite(params.radius)) {
      qs.push(`radius=${encodeURIComponent(String(params.radius))}`);
    }
    const q = qs.length ? `?${qs.join('&')}` : '';
    const url = `${this.base}/settlements/${encodeURIComponent(ref)}/delivery-points${q}`;
    return this.api.get<unknown>(url).pipe(
      map((data) => normalizeDeliveryPoints(data)),
      catchError((err) => {
        console.warn('[NovaPoshta] getDeliveryPoints failed', url, err);
        return of([]);
      }),
    );
  }
}

function emptySettlementsPage(): NpSettlementsPageDto {
  return { page: 1, pageSize: 0, items: [], hasMore: false };
}

function normalizeSettlementsPage(data: unknown): NpSettlementsPageDto {
  if (!data || typeof data !== 'object') {
    return emptySettlementsPage();
  }
  const o = data as Record<string, unknown>;
  const page = num(o['page'] ?? o['Page'], 1);
  const pageSize = num(o['pageSize'] ?? o['PageSize'], 0);
  const hasMore = bool(o['hasMore'] ?? o['HasMore'], false);
  const rawItems = extractSettlementArrays(data);
  const items: NpSettlementDirectoryDto[] = [];
  for (const x of rawItems) {
    const opt = rowToSettlementOption(x);
    if (!opt) continue;
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    items.push({
      ...opt,
      area: str(r['area'] ?? r['Area']),
      region: str(r['region'] ?? r['Region']),
    });
  }
  return {
    page,
    pageSize,
    hasMore,
    items,
  };
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function dedupeByRef(items: NpSettlementOption[]): NpSettlementOption[] {
  const seen = new Set<string>();
  const out: NpSettlementOption[] = [];
  for (const x of items) {
    if (seen.has(x.ref)) continue;
    seen.add(x.ref);
    out.push(x);
  }
  return out;
}

function isLikelyCityAutocompleteRow(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const id =
    r['settlementRef'] ??
    r['SettlementRef'] ??
    r['ref'] ??
    r['Ref'] ??
    r['cityRef'] ??
    r['CityRef'] ??
    r['deliveryCityRef'] ??
    r['DeliveryCityRef'];
  return typeof id === 'string' && id.trim().length > 0;
}

function extractSettlementArrays(data: unknown, depth = 0): unknown[] {
  if (depth > 6 || data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return [];

  const o = data as Record<string, unknown>;
  const keys = [
    /** EF Core / System.Text.Json */
    '$values',
    'data',
    'Data',
    'items',
    'Items',
    'result',
    'Result',
    'value',
    'Value',
    'settlements',
    'Settlements',
    'addresses',
    'Addresses',
    'cities',
    'Cities',
    /** CityAutocompleteResponseDto / обгортки бекенду */
    'suggestions',
    'Suggestions',
    'citySuggestions',
    'CitySuggestions',
    'deliveryPoints',
    'DeliveryPoints',
    'points',
    'Points',
  ];

  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  for (const k of keys) {
    const v = o[k];
    if (v && typeof v === 'object') {
      const nested = extractSettlementArrays(v, depth + 1);
      if (nested.length > 0) return nested;
    }
  }

  /** Будь-який масив «схожий на міста» якщо ключі DTO відрізняються від відомих. */
  if (depth < 6) {
    for (const v of Object.values(o)) {
      if (!Array.isArray(v) || v.length === 0) continue;
      if (isLikelyCityAutocompleteRow(v[0])) {
        return v;
      }
    }
  }

  return [];
}

function flattenAddressRows(raw: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const inner = r['Addresses'] ?? r['addresses'];
    if (Array.isArray(inner) && inner.length > 0) {
      out.push(...inner);
    } else {
      out.push(x);
    }
  }
  return out;
}

function normalizeSettlements(data: unknown): NpSettlementOption[] {
  const raw = flattenAddressRows(extractSettlementArrays(data));
  const out: NpSettlementOption[] = [];
  for (const x of raw) {
    const opt = rowToSettlementOption(x);
    if (opt) out.push(opt);
  }
  return out;
}

function rowToSettlementOption(x: unknown): NpSettlementOption | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  /**
   * `GET .../cities/search`: лише **settlementRef** (camelCase від `SettlementRef`).
   * `GET .../settlements`: рядки довідника — **`ref`**.
   */
  const ref = String(
    r['settlementRef'] ??
      r['SettlementRef'] ??
      r['ref'] ??
      r['Ref'] ??
      r['AddressRef'] ??
      r['CityRef'] ??
      r['cityRef'] ??
      r['deliveryCityRef'] ??
      r['DeliveryCityRef'] ??
      '',
  ).trim();
  if (!ref) return null;
  let description = String(
    r['displayLabel'] ??
      r['DisplayLabel'] ??
      r['present'] ??
      r['Present'] ??
      r['description'] ??
      r['Description'] ??
      r['MainDescription'] ??
      r['mainDescription'] ??
      r['label'] ??
      r['Label'] ??
      r['name'] ??
      r['Name'] ??
      '',
  ).trim();
  const hint = String(r['warehouseCountHint'] ?? r['WarehouseCountHint'] ?? '').trim();
  if (hint && !description.toLowerCase().includes(hint.toLowerCase())) {
    description = description ? `${description} (${hint})` : hint;
  }
  if (!description) {
    description = ref;
  }
  /** Місто доставки НП (`deliveryCity` у JSON) — для branches/postomats; не змішувати з текстом option. */
  const deliveryCityRef =
    String(
      r['deliveryCityRef'] ??
        r['DeliveryCityRef'] ??
        r['deliveryCity'] ??
        r['DeliveryCity'] ??
        '',
    ).trim() || null;
  return { ref, description, deliveryCityRef };
}

function normalizeStreets(data: unknown): NpStreetDto[] {
  const raw = extractSettlementArrays(data);
  const out: NpStreetDto[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const settlementRef = String(r['settlementRef'] ?? r['SettlementRef'] ?? '').trim();
    const settlementStreetRef = String(r['settlementStreetRef'] ?? r['SettlementStreetRef'] ?? '').trim();
    const present = String(r['present'] ?? r['Present'] ?? '').trim();
    if (!settlementRef || !settlementStreetRef || !present) continue;
    out.push({
      settlementRef,
      settlementStreetRef,
      present,
      streetsType: str(r['streetsType'] ?? r['StreetsType']),
      streetsTypeDescription: str(r['streetsTypeDescription'] ?? r['StreetsTypeDescription']),
    });
  }
  return out;
}

function normalizeDeliveryPoints(data: unknown): DeliveryPointDto[] {
  const raw = extractSettlementArrays(data);
  const out: DeliveryPointDto[] = [];
  for (const x of raw) {
    const p = rowToDeliveryPoint(x);
    if (p) out.push(p);
  }
  return out;
}

function rowToDeliveryPoint(x: unknown): DeliveryPointDto | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const ref = String(r['ref'] ?? r['Ref'] ?? '').trim();
  if (!ref) return null;
  const typeRaw = String(r['type'] ?? r['Type'] ?? 'Branch')
    .trim()
    .toLowerCase();
  const type: DeliveryPointKind = typeRaw === 'postomat' ? 'Postomat' : 'Branch';
  const name =
    String(r['name'] ?? r['Name'] ?? r['description'] ?? r['Description'] ?? '').trim() || ref;
  const shortAddress = String(
    r['shortAddress'] ?? r['ShortAddress'] ?? r['name'] ?? r['Name'] ?? name,
  ).trim();
  const cityRef = String(r['cityRef'] ?? r['CityRef'] ?? '').trim();
  const lat = num(r['lat'] ?? r['Lat'], 0);
  const lng = num(r['lng'] ?? r['Lng'] ?? r['lon'] ?? r['Lon'], 0);
  return { ref, type, name, shortAddress, cityRef, lat, lng };
}

function normalizeWarehouses(data: unknown): NpWarehouseDto[] {
  const raw = flattenAddressRows(extractSettlementArrays(data));
  const out: NpWarehouseDto[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const ref = String(
      r['warehouseRef'] ?? r['WarehouseRef'] ?? r['ref'] ?? r['Ref'] ?? '',
    ).trim();
    if (!ref) continue;
    out.push({
      ref,
      name: str(r['name'] ?? r['Name']),
      description: str(r['description'] ?? r['Description']),
      shortAddress: str(r['shortAddress'] ?? r['ShortAddress']),
      number: str(r['number'] ?? r['Number']),
      typeOfWarehouse: str(r['typeOfWarehouse'] ?? r['TypeOfWarehouse']),
      typeOfWarehouseRef: str(r['typeOfWarehouseRef'] ?? r['TypeOfWarehouseRef']),
    });
  }
  return out;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
