import { createHash } from "node:crypto";

/**
 * P6 — Meta Conversions API helpers (pure + dependency-free, safe to
 * unit-test in node). The browser pixel fires Purchase with event_id =
 * order id; this sender mirrors the same event server-side with the same
 * id so Meta dedupes the pair.
 */

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function toMajorUnits(amountMinor: unknown, currency?: unknown): number | undefined {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) {
    return undefined;
  }
  const code = typeof currency === "string" ? currency.toUpperCase() : "";
  if (ZERO_DECIMAL.has(code)) {
    return amountMinor;
  }
  return Math.round(amountMinor) / 100;
}

export function sha256Lower(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type CapiOrder = {
  id: string;
  email?: string | null;
  /** Minor units; accepts anything (Medusa BigNumberValue shapes included). */
  total?: unknown;
  currency_code?: string | null;
  items?: { variant_id?: string | null; quantity?: number | null }[];
};

function toMinorNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (value && typeof value === "object") {
    for (const key of ["value", "numeric", "amount"]) {
      const n = Number((value as Record<string, unknown>)[key]);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    const n = Number(String(value));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function buildPurchasePayload(order: CapiOrder, testEventCode?: string) {
  const value = toMajorUnits(toMinorNumber(order.total), order.currency_code);
  const user_data: Record<string, string[]> = {};
  if (order.email && order.email.includes("@")) {
    user_data.em = [sha256Lower(order.email)];
  }
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: order.id,
        action_source: "website",
        user_data,
        custom_data: {
          ...(value !== undefined ? { value } : {}),
          ...(order.currency_code ? { currency: order.currency_code } : {}),
          order_id: order.id,
          contents: (order.items || [])
            .filter((i) => i.variant_id)
            .map((i) => ({ id: i.variant_id, quantity: i.quantity ?? 1 })),
        },
      },
    ],
  };
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }
  return payload;
}

/** POST one event batch. Resolves false (never throws) on any failure. */
export async function sendCapiEvents(
  pixelId: string,
  token: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      return false;
    }
    const body = (await res.json().catch(() => ({}))) as {
      events_received?: number;
    };
    return (body.events_received ?? 0) > 0;
  } catch {
    return false;
  }
}
