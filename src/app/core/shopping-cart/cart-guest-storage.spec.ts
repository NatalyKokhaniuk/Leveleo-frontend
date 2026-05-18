import {
  clearGuestCartStorage,
  GUEST_CART_STORAGE_KEY,
  guestCartToQtyMap,
  qtyMapToGuestCart,
  readGuestCart,
  writeGuestCart,
} from './cart-guest-storage';

describe('cart-guest-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writeGuestCart and readGuestCart round-trip', () => {
    writeGuestCart([
      { productId: 'a', quantity: 2 },
      { productId: '', quantity: 1 },
      { productId: 'b', quantity: 0 },
    ]);
    expect(readGuestCart()).toEqual([{ productId: 'a', quantity: 2 }]);
  });

  it('guestCartToQtyMap aggregates duplicate ids', () => {
    const m = guestCartToQtyMap([
      { productId: 'a', quantity: 1 },
      { productId: 'a', quantity: 2 },
    ]);
    expect(m.get('a')).toBe(3);
  });

  it('qtyMapToGuestCart filters zero quantities', () => {
    const lines = qtyMapToGuestCart(
      new Map([
        ['a', 2],
        ['b', 0],
      ]),
    );
    expect(lines).toEqual([{ productId: 'a', quantity: 2 }]);
  });

  it('clearGuestCartStorage removes key', () => {
    writeGuestCart([{ productId: 'x', quantity: 1 }]);
    clearGuestCartStorage();
    expect(localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBeNull();
  });
});
