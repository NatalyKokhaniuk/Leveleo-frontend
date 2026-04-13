import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import {
  NpSettlementDirectoryDto,
  NpSettlementOption,
  NpSettlementsPageDto,
  NpWarehouseDto,
} from './nova-poshta.types';

/**
 * Клієнт до `NovaPoshtaController` на бекенді (`/api/NovaPoshta/...`, Bearer JWT).
 *
 * Ендпоінти:
 * - `GET .../cities/search?query=&limit=` — автокомпліт міст;
 * - `GET .../settlements?page=&find=` — довідник з пагінацією;
 * - `GET .../settlements/{ref}/postomats` — поштомати;
 * - `GET .../settlements/{ref}/branches` — відділення (не поштомати).
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
      catchError((err) => {
        console.warn('[NovaPoshta] searchCities failed', url, err);
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

  /** Усі поштомати для обраного населеного пункту (`settlementRef` = `CityRef`). */
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

  /** Відділення (не поштомати) для населеного пункту. */
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

function extractSettlementArrays(data: unknown, depth = 0): unknown[] {
  if (depth > 6 || data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return [];

  const o = data as Record<string, unknown>;
  const keys = [
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
  const ref = String(
    r['ref'] ??
      r['Ref'] ??
      r['SettlementRef'] ??
      r['settlementRef'] ??
      r['AddressRef'] ??
      r['CityRef'] ??
      r['cityRef'] ??
      '',
  ).trim();
  const description = String(
    r['description'] ??
      r['Description'] ??
      r['Present'] ??
      r['present'] ??
      r['MainDescription'] ??
      r['mainDescription'] ??
      r['deliveryCity'] ??
      r['DeliveryCity'] ??
      r['name'] ??
      r['Name'] ??
      '',
  ).trim();
  if (ref && description) {
    return { ref, description };
  }
  return null;
}

function normalizeWarehouses(data: unknown): NpWarehouseDto[] {
  const raw = flattenAddressRows(extractSettlementArrays(data));
  const out: NpWarehouseDto[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const ref = String(r['ref'] ?? r['Ref'] ?? '').trim();
    if (!ref) continue;
    out.push({
      ref,
      description: str(r['description'] ?? r['Description']),
      shortAddress: str(r['shortAddress'] ?? r['ShortAddress']),
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
