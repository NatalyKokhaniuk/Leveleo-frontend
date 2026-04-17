import { CreateOrderResultDto } from './order.types';

const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

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

/**
 * Після POST /api/Orders (201): витягує пару полів для HTML-форми LiqPay checkout (data + signature).
 * Підтримує: окремі поля в DTO, JSON у `payload`, комбінацію base64 `data` у `payload` + `signature` окремо.
 */
export function extractLiqPayCheckoutParams(res: CreateOrderResultDto): { data: string; signature: string } | null {
  const r = res as unknown as Record<string, unknown>;
  const topData = pickString(r['data'] ?? r['Data']);
  const topSig = pickString(r['signature'] ?? r['Signature']);

  const payloadRaw = res.payload ?? r['Payload'];
  const fromPayload = parsePayloadObject(payloadRaw);

  const dataFromPayload = fromPayload
    ? pickString(fromPayload['data'] ?? fromPayload['Data'])
    : null;
  const sigFromPayload = fromPayload
    ? pickString(fromPayload['signature'] ?? fromPayload['Signature'])
    : null;

  /** Сирий рядок (наприклад base64 `data`), якщо це не JSON-об'єкт у `payload`. */
  const dataOnlyString =
    typeof payloadRaw === 'string' && payloadRaw.trim() && fromPayload === null
      ? payloadRaw.trim()
      : null;

  const data = topData ?? dataFromPayload ?? dataOnlyString ?? null;
  const signature = topSig ?? sigFromPayload ?? null;

  if (data && signature) {
    return { data, signature };
  }
  return null;
}

/** POST на https://www.liqpay.ua/api/3/checkout з полями data та signature. */
export function submitLiqPayCheckoutForm(data: string, signature: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = LIQPAY_CHECKOUT_URL;
  form.style.display = 'none';

  const dataInput = document.createElement('input');
  dataInput.name = 'data';
  dataInput.value = data;
  form.appendChild(dataInput);

  const signInput = document.createElement('input');
  signInput.name = 'signature';
  signInput.value = signature;
  form.appendChild(signInput);

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
