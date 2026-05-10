import { CreateOrderResultDto } from './order.types';

/**
 * Hosted Checkout API v3: лише офіційна відправка `data` + `signature`
 * методом POST (форма або еквівалент у віджеті LiqPay). Не використовувати
 * самостійний GET на URL виду `/uk/checkout/checkout_…` — часто дає 403.
 */
export const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') {
    return null;
  }
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function parsePayloadObject(payload: unknown): Record<string, unknown> | null {
  if (payload == null) {
    return null;
  }
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  if (typeof payload !== 'string') {
    return null;
  }
  const s = payload.trim();
  if (!s) {
    return null;
  }
  try {
    const parsed = JSON.parse(s) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* не JSON — наприклад сирий base64 для data */
  }
  return null;
}

const NESTED_LIQPAY_KEYS = [
  'checkout',
  'Checkout',
  'liqPay',
  'LiqPay',
  'liqpay',
  'payment',
  'Payment',
  'liqPayCheckout',
  'LiqPayCheckout',
] as const;

function collectCheckoutObjects(root: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();

  const add = (o: Record<string, unknown> | null | undefined): void => {
    if (!o || seen.has(o)) {
      return;
    }
    seen.add(o);
    out.push(o);
  };

  add(root);

  const payloadRaw = root['payload'] ?? root['Payload'];
  add(parsePayloadObject(payloadRaw));

  for (const k of NESTED_LIQPAY_KEYS) {
    const v = root[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      add(v as Record<string, unknown>);
    }
  }

  return out;
}

function pickPairFrom(obj: Record<string, unknown>): { data: string; signature: string } | null {
  const data = pickString(obj['data'] ?? obj['Data']);
  const signature = pickString(obj['signature'] ?? obj['Signature']);
  if (data && signature) {
    return { data, signature };
  }
  return null;
}

/** Деякі бекенди загортають 201 у `result` / `value` — злиття для пошуку data+signature. */
function mergeOrderResultWrapper(root: Record<string, unknown>): Record<string, unknown> {
  const wrap = root['result'] ?? root['Result'] ?? root['value'] ?? root['Value'];
  if (wrap && typeof wrap === 'object' && !Array.isArray(wrap)) {
    return { ...root, ...(wrap as Record<string, unknown>) };
  }
  return root;
}

/**
 * Після POST /api/Orders (201): пара для HTML-форми LiqPay (`POST` на {@link LIQPAY_CHECKOUT_URL}).
 * Підтримка: корінь, вкладені `payment`/`checkout`/… , JSON у `payload`, PascalCase, сирий base64 у `payload` + `signature` на корені.
 */
export function extractLiqPayCheckoutParams(res: CreateOrderResultDto): { data: string; signature: string } | null {
  const r = mergeOrderResultWrapper(res as unknown as Record<string, unknown>);

  for (const obj of collectCheckoutObjects(r)) {
    const pair = pickPairFrom(obj);
    if (pair) {
      return pair;
    }
  }

  const payloadRaw = (res as CreateOrderResultDto).payload ?? r['Payload'];
  const fromPayload = parsePayloadObject(payloadRaw);
  const dataOnlyString =
    typeof payloadRaw === 'string' && payloadRaw.trim() && fromPayload === null
      ? payloadRaw.trim()
      : null;
  const topSig = pickString(r['signature'] ?? r['Signature']);

  if (dataOnlyString && topSig) {
    return { data: dataOnlyString, signature: topSig };
  }

  return null;
}

/** `application/x-www-form-urlencoded` POST на LiqPay з полями `data` та `signature`. */
export function submitLiqPayCheckoutForm(data: string, signature: string): void {
  const d = typeof data === 'string' ? data.trim() : '';
  const sig = typeof signature === 'string' ? signature.trim() : '';
  if (!d || !sig) {
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = LIQPAY_CHECKOUT_URL;
  form.target = '_self';
  form.acceptCharset = 'UTF-8';
  form.setAttribute('autocomplete', 'off');
  form.style.display = 'none';

  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'data';
  dataInput.value = d;
  form.appendChild(dataInput);

  const signInput = document.createElement('input');
  signInput.type = 'hidden';
  signInput.name = 'signature';
  signInput.value = sig;
  form.appendChild(signInput);

  document.body.appendChild(form);
  form.submit();
  window.setTimeout(() => form.remove(), 0);
}
