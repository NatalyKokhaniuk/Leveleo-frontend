import { OrderListItemDto } from '../orders/order.types';
import { DailySalesReportDto, MonthlySalesReportDto } from './statistics.types';

const SALES_STATUSES = new Set(['shipped', 'completed']);

export function isSalesOrderStatus(status: unknown): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  if (SALES_STATUSES.has(s)) return true;
  // JsonStringEnumConverter (числові значення): Shipped=2, Completed=3 у ORDER_STATUS_VALUES
  return s === '2' || s === '3';
}

function orderRevenue(o: OrderListItemDto): number {
  const n = Number(o.totalPayable ?? o.totalAmount ?? o.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseUtcDate(iso: string | null | undefined): Date | null {
  const s = String(iso ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function aggregateMonthlySales(
  orders: OrderListItemDto[],
  year: number,
  monthNameFor: (month: number) => string,
): MonthlySalesReportDto[] {
  const map = new Map<number, { ordersCount: number; totalRevenue: number }>();
  for (const o of orders) {
    if (!isSalesOrderStatus(o.status)) continue;
    const d = parseUtcDate(o.createdAt);
    if (!d || d.getUTCFullYear() !== year) continue;
    const month = d.getUTCMonth() + 1;
    const cur = map.get(month) ?? { ordersCount: 0, totalRevenue: 0 };
    cur.ordersCount += 1;
    cur.totalRevenue += orderRevenue(o);
    map.set(month, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, v]) => ({
      year,
      month,
      monthName: monthNameFor(month),
      ordersCount: v.ordersCount,
      totalRevenue: v.totalRevenue,
      averageOrderValue: v.ordersCount > 0 ? v.totalRevenue / v.ordersCount : 0,
    }));
}

export function filterOrdersInIsoRange(
  orders: OrderListItemDto[],
  startIso: string,
  endIso: string,
): OrderListItemDto[] {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
  return orders.filter((o) => {
    const t = parseUtcDate(o.createdAt)?.getTime();
    return t != null && t >= startMs && t <= endMs;
  });
}

export function aggregateDailySales(orders: OrderListItemDto[]): DailySalesReportDto[] {
  const map = new Map<string, { ordersCount: number; totalRevenue: number }>();
  for (const o of orders) {
    if (!isSalesOrderStatus(o.status)) continue;
    const d = parseUtcDate(o.createdAt);
    if (!d) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const cur = map.get(key) ?? { ordersCount: 0, totalRevenue: 0 };
    cur.ordersCount += 1;
    cur.totalRevenue += orderRevenue(o);
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      ordersCount: v.ordersCount,
      totalRevenue: v.totalRevenue,
      averageOrderValue: v.ordersCount > 0 ? v.totalRevenue / v.ordersCount : 0,
    }));
}
