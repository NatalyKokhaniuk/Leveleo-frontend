/** localStorage: рядки гостевого кошика до логіну / після logout. */
export const GUEST_CART_STORAGE_KEY = 'leveleo_guest_cart';

export interface GuestCartLine {
  productId: string;
  quantity: number;
}

export function readGuestCart(): GuestCartLine[] {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) {
      return [];
    }
    const out: GuestCartLine[] = [];
    for (const row of arr) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const productId = String((row as GuestCartLine).productId ?? '').trim();
      const quantity = Math.max(0, Math.trunc(Number((row as GuestCartLine).quantity) || 0));
      if (!productId || quantity <= 0) {
        continue;
      }
      out.push({ productId, quantity });
    }
    return out;
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestCartLine[]): void {
  try {
    const normalized = lines
      .map((l) => ({
        productId: String(l.productId ?? '').trim(),
        quantity: Math.max(0, Math.trunc(Number(l.quantity) || 0)),
      }))
      .filter((l) => l.productId && l.quantity > 0);
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    
  }
}

export function clearGuestCartStorage(): void {
  try {
    localStorage.removeItem(GUEST_CART_STORAGE_KEY);
  } catch {
    
  }
}

export function guestCartToQtyMap(lines: GuestCartLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) {
    const id = l.productId.trim();
    if (!id) {
      continue;
    }
    m.set(id, (m.get(id) ?? 0) + l.quantity);
  }
  return m;
}

export function qtyMapToGuestCart(m: Map<string, number>): GuestCartLine[] {
  return [...m.entries()]
    .filter(([id, q]) => id.trim() && q > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}
