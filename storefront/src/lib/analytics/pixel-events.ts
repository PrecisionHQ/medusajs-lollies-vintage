/**
 * Pure ad-pixel event mapping (no imports — safe to unit-test in node).
 *
 * Maps our first-party funnel events (the same names TrackView fires at
 * PostHog) onto Meta (fbq) and TikTok (ttq) standard events. Unknown
 * events map to nothing: pixels stay silent rather than invent data.
 */

export type PixelCall = {
  network: "meta" | "tiktok";
  /** "page" renders as fbq("track","PageView") / ttq.page(). */
  method: "track" | "page";
  name: string;
  params?: Record<string, unknown>;
  options?: Record<string, unknown>;
};

const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/** Minor units (as Medusa totals come) -> major units for pixel values. */
export function majorUnits(amountMinor: unknown, currency?: unknown): number | undefined {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) {
    return undefined;
  }
  const code = typeof currency === "string" ? currency.toUpperCase() : "";
  if (ZERO_DECIMAL.has(code)) {
    return amountMinor;
  }
  return Math.round(amountMinor) / 100;
}

type Props = Record<string, unknown>;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

export function mapToPixelEvents(event: string, props: Props = {}): PixelCall[] {
  switch (event) {
    case "store_viewed":
      return [
        { network: "meta", method: "track", name: "PageView" },
        { network: "tiktok", method: "page", name: "PageView" },
      ];

    case "product_viewed": {
      const id = str(props.product_id);
      if (!id) return [];
      return [
        {
          network: "meta",
          method: "track",
          name: "ViewContent",
          params: {
            content_ids: [id],
            content_type: "product",
            ...(str(props.handle) ? { content_name: props.handle } : {}),
          },
        },
        {
          network: "tiktok",
          method: "track",
          name: "ViewContent",
          params: { content_id: id },
        },
      ];
    }

    case "collection_viewed": {
      const id = str(props.collection_id);
      if (!id) return [];
      const params = {
        content_ids: [id],
        ...(str(props.handle) ? { content_category: props.handle } : {}),
      };
      return [
        { network: "meta", method: "track", name: "ViewContent", params },
        { network: "tiktok", method: "track", name: "ViewContent", params },
      ];
    }

    case "search_performed": {
      const query = str(props.query);
      if (!query) return [];
      return [
        {
          network: "meta",
          method: "track",
          name: "Search",
          params: { search_string: query },
        },
        {
          network: "tiktok",
          method: "track",
          name: "Search",
          params: { query },
        },
      ];
    }

    case "cart_viewed":
      return [
        { network: "meta", method: "track", name: "ViewCart" },
        { network: "tiktok", method: "track", name: "ViewCart" },
      ];

    case "checkout_started":
      return [
        { network: "meta", method: "track", name: "InitiateCheckout" },
        { network: "tiktok", method: "track", name: "InitiateCheckout" },
      ];

    case "order_placed": {
      const orderId = str(props.order_id);
      const value = majorUnits(props.revenue, props.currency);
      const currency =
        typeof props.currency === "string" ? props.currency : undefined;
      const params: Record<string, unknown> = {
        ...(value !== undefined ? { value } : {}),
        ...(currency ? { currency } : {}),
        ...(orderId ? { order_id: orderId } : {}),
      };
      // eventID/order id shared with the server Conversions API call so
      // Meta/TikTok dedupe browser against server.
      const options = orderId
        ? { eventID: orderId, event_id: orderId }
        : undefined;
      return [
        { network: "meta", method: "track", name: "Purchase", params, options },
        {
          network: "tiktok",
          method: "track",
          name: "CompletePayment",
          params,
          options,
        },
      ];
    }

    default:
      return [];
  }
}
