import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * PR-14 — KPI summary, computed from Medusa order data (no new keys needed).
 * GET /admin/analytics/summary?days=30 returns revenue + orders + AOV grouped
 * by currency (no FX conversion — mixing currencies would lie), plus top-10
 * products by quantity and the restock signals (sell-through velocity is
 * derived client-side from these + inventory, per the PR-PLAN restock rule).
 *
 * Sessions/conversion and search no-result rate stay in PostHog (PR-05
 * events); the dashboard page shows them as "connect PostHog" cards until
 * the project keys land, rather than inventing numbers here.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders }: { data: any[] } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "total",
      "currency_code",
      "created_at",
      "items.product_id",
      "items.product_title",
      "items.quantity",
      "items.unit_price",
    ],
    filters: { created_at: { $gt: since } },
    pagination: { take: 2000 },
  });

  const byCurrency = new Map<string, { revenue: number; orders: number }>();
  const byProduct = new Map<
    string,
    { product_id: string; title: string; qty: number; revenue: number }
  >();

  for (const o of orders ?? []) {
    const cur = (o.currency_code ?? "eur").toLowerCase();
    const bucket = byCurrency.get(cur) ?? { revenue: 0, orders: 0 };
    bucket.revenue += o.total ?? 0;
    bucket.orders += 1;
    byCurrency.set(cur, bucket);
    for (const i of o.items ?? []) {
      const key = i.product_id ?? i.product_title ?? "unknown";
      const row = byProduct.get(key) ?? {
        product_id: i.product_id,
        title: i.product_title ?? key,
        qty: 0,
        revenue: 0,
      };
      row.qty += i.quantity ?? 0;
      row.revenue += (i.unit_price ?? 0) * (i.quantity ?? 0);
      byProduct.set(key, row);
    }
  }

  const currencies = [...byCurrency.entries()].map(([currency, b]) => ({
    currency,
    revenue_minor: b.revenue,
    orders: b.orders,
    aov_minor: b.orders ? Math.round(b.revenue / b.orders) : 0,
  }));
  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  res.json({
    days,
    order_count: (orders ?? []).length,
    currencies,
    top_products: topProducts,
  });
};
