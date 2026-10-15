import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

const DAY = 24 * 3600 * 1000;

type Row = {
  source: string;
  currency: string;
  spend_minor: number;
  revenue_minor: number;
  orders: number;
  /** revenue / spend, null when nothing spent (organic) or no revenue yet. */
  roas: number | null;
};

/**
 * Phase 3 (C3) — ROAS per channel. Joins the ad-spend ledger (by source)
 * to attributed order revenue (cart stamp in metadata.attribution, C1).
 * Match key is lowercase source on both sides; unattributed revenue gets
 * its own bucket rather than inflating a channel. Fail-open and bounded
 * like every other aggregator; money grouped per currency, no FX.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const scope = req.scope;
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    const since = new Date(Date.now() - days * DAY);
    const marketing = scope.resolve("marketing") as any;
    const orderModule = scope.resolve("order") as any;

    const spendRows =
      (await marketing
        .listMarketingAdSpends({ spend_date: { $gte: since.toISOString().slice(0, 10) } }, { take: 2000 })
        .catch(() => [])) ?? [];

    const orders =
      (await orderModule
        .listOrders({ created_at: { $gte: since } }, { take: 3000 })
        .catch(() => [])) ?? [];

    const spend = new Map<string, number>();
    for (const s of spendRows) {
      const key = `${String(s.source ?? "").toLowerCase()}|${String(s.currency ?? "eur").toLowerCase()}`;
      spend.set(key, (spend.get(key) ?? 0) + Number(s.amount_minor ?? 0));
    }

    const revenue = new Map<string, { minor: number; orders: number }>();
    const unattributed = new Map<string, { minor: number; orders: number }>();
    for (const o of orders) {
      const src = (o.metadata as any)?.attribution?.utm_source;
      const cur = String(o.currency_code ?? "eur").toLowerCase();
      const bucket = src
        ? revenue
        : unattributed;
      const key = src ? `${String(src).toLowerCase()}|${cur}` : cur;
      const row = bucket.get(key) ?? { minor: 0, orders: 0 };
      row.minor += Number(o.total ?? 0);
      row.orders += 1;
      bucket.set(key, row);
    }

    const keys = new Set([...spend.keys(), ...revenue.keys()]);
    const rows: Row[] = [...keys]
      .map((key) => {
        const [source, currency] = key.split("|");
        const spend_minor = spend.get(key) ?? 0;
        const rev = revenue.get(key) ?? { minor: 0, orders: 0 };
        return {
          source,
          currency,
          spend_minor,
          revenue_minor: rev.minor,
          orders: rev.orders,
          roas: spend_minor > 0 ? rev.minor / spend_minor : null,
        };
      })
      .sort((a, b) => b.revenue_minor - a.revenue_minor || b.spend_minor - a.spend_minor);

    res.json({
      generated_at: new Date().toISOString(),
      days,
      rows,
      unattributed: [...unattributed.entries()].map(([currency, r]) => ({
        currency,
        revenue_minor: r.minor,
        orders: r.orders,
      })),
    });
  } catch {
    res.json({ generated_at: new Date().toISOString(), days: 0, rows: [], unattributed: [], degraded: true });
  }
};
