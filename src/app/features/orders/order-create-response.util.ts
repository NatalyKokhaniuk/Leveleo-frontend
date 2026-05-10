import { normalizeShoppingCartDto } from '../shopping-cart/shopping-cart-normalize.util';
import type { CreateOrderResultDto } from './order.types';

/**
 * Відповідь POST /api/Orders: об’єднує обгортки `result`/`Result`/`value`/`Value` з коренем
 * і нормалізує кошик — інакше не відпрацьовує {@link extractLiqPayCheckoutParams}.
 */
export function normalizeCreateOrderResultDto(raw: unknown): CreateOrderResultDto {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  let o = raw as Record<string, unknown>;
  const wrap = o['result'] ?? o['Result'] ?? o['value'] ?? o['Value'];
  if (wrap && typeof wrap === 'object' && !Array.isArray(wrap)) {
    o = { ...o, ...(wrap as Record<string, unknown>) };
  }
  const cartRaw = o['shoppingCart'] ?? o['ShoppingCart'];
  const shoppingCart =
    cartRaw != null && typeof cartRaw === 'object'
      ? normalizeShoppingCartDto(cartRaw)
      : (cartRaw as CreateOrderResultDto['shoppingCart']) ?? undefined;

  return {
    ...(o as unknown as CreateOrderResultDto),
    shoppingCart,
  };
}
