import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Phone board (#16): one aggregated status payload so the mobile view
 * needs a single fetch on a slow connection. Today + 7-day orders and
 * revenue (grouped by currency, no FX), moderation queues (open
 * questions, pending reviews), every automation flow's on/off + sent
 * count, and the lowest-availability variants as stock alerts.
 *
 * Board+ (parity Phase F): 30-day daily revenue series, top products by
 * units, and the fulfillment-SLA list (unfulfilled >48h). Each section is
 * independently try/caught — the dashboard /phone page ignores the new
 * fields, and a failure here must never shrink the original payload.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const scope = req.scope;
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as any;
  const marketing = scope.resolve("marketing") as any;

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: orders }: { data: any[] } = await query
    .graph({
      entity: "order",
      fields: ["id", "total", "currency_code", "created_at"],
      filters: { created_at: { $gt: weekAgo } },
      pagination: { take: 2000 },
    })
    .catch(() => ({ data: [] }));

  const bucket = (since: string) => {
    const seen = (orders ?? []).filter((o) => o.created_at > since);
    const revenue = new Map<string, number>();
    for (const o of seen) {
      const cur = (o.currency_code ?? "eur").toLowerCase();
      revenue.set(cur, (revenue.get(cur) ?? 0) + (o.total ?? 0));
    }
    return {
      orders: seen.length,
      revenue: [...revenue.entries()].map(([currency, minor]) => ({
        currency,
        minor,
      })),
    };
  };

  // Moderation queues. Each module is optional (questions ships
  // separately): a missing module reads as zero, never a 500.
  let questionsOpen = 0;
  let reviewsPending = 0;
  try {
    const [, count] = await (scope.resolve("question") as any)
      .listAndCountQuestions({ status: "open" });
    questionsOpen = count ?? 0;
  } catch {
    questionsOpen = 0;
  }
  try {
    const [, count] = await (scope.resolve("review") as any)
      .listAndCountReviews({ status: "pending" });
    reviewsPending = count ?? 0;
  } catch {
    reviewsPending = 0;
  }

  const flowKeys = [
    "abandoned_cart",
    "review_request",
    "winback",
    "welcome",
    "price_drop",
    "cross_sell",
    "back_in_stock",
  ];
  const flows = [];
  for (const key of flowKeys) {
    try {
      const rows = await marketing.listFlowConfigs({ key });
      const enabled = rows.length ? rows[0].enabled !== false : true;
      flows.push({ key, enabled });
    } catch {
      flows.push({ key, enabled: true });
    }
  }

  // Stock alerts: lowest inventory first, one bounded read. Variant
  // titles ride along so the board is actionable without a second fetch.
  let lowStock: { variant_id: string; title: string; available: number }[] =
    [];
  try {
    const { data: variants }: { data: any[] } = await query.graph({
      entity: "product_variant",
      fields: ["id", "title", "inventory_quantity", "product.title"],
      pagination: { take: 200 },
    });
    lowStock = (variants ?? [])
      .map((v) => ({
        variant_id: String(v.id ?? ""),
        title: [v.product?.title, v.title].filter(Boolean).join(" / ") || String(v.id ?? ""),
        available: Number(v.inventory_quantity ?? 0),
      }))
      .filter((v) => v.available < 5)
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);
  } catch {
    lowStock = [];
  }

  res.json({
    today: bucket(dayAgo),
    week: bucket(weekAgo),
    questions_open: questionsOpen ?? 0,
    reviews_pending: reviewsPending ?? 0,
    flows,
    low_stock: lowStock,
    ...(await boardPlus(scope)),
  });
};

type BoardPlus = {
  revenue_30d: { day: string; currency: string; minor: number }[];
  top_products: { title: string; qty: number; currency: string; minor: number }[];
  sla: { order_id: string; display_id: number | null; email: string | null; age_hours: number }[];
};

/**
 * Board+ sections, awaited into the same response above. Self-contained
 * try/catch returns partial/empty on any failure so the core payload
 * always survives. Reads via the order module (relations beat query.graph
 * here: line items ride along in one bounded list call).
 */
export async function boardPlus(scope: any): Promise<BoardPlus> {
  const empty: BoardPlus = { revenue_30d: [], top_products: [], sla: [] };
  try {
    const orderModule = scope.resolve("order") as any;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const orders = await orderModule.listOrders(
      { created_at: { $gte: since } },
      { relations: ["items"], take: 3000, order: { created_at: "DESC" } }
    );
    if (!orders?.length) {
      return empty;
    }

    const byDay = new Map<string, number>();
    for (const o of orders) {
      const day = String(o.created_at ?? "").slice(0, 10);
      const cur = String(o.currency_code ?? "eur").toLowerCase();
      const key = `${day}|${cur}`;
      byDay.set(key, (byDay.get(key) ?? 0) + Number(o.total ?? 0));
    }
    const revenue_30d = [...byDay.entries()]
      .map(([key, minor]) => {
        const [day, currency] = key.split("|");
        return { day, currency, minor };
      })
      .sort((a, b) => (a.day < b.day ? -1 : 1));

    const byProduct = new Map<string, { title: string; qty: number; currency: string; minor: number }>();
    for (const o of orders) {
      const cur = String(o.currency_code ?? "eur").toLowerCase();
      for (const i of o.items ?? []) {
        const key = `${i.product_id ?? i.title}|${cur}`;
        const row = byProduct.get(key) ?? {
          title: String(i.title ?? i.product_title ?? "Unknown item"),
          qty: 0,
          currency: cur,
          minor: 0,
        };
        row.qty += Number(i.quantity ?? 0);
        row.minor += Number(i.quantity ?? 0) * Number(i.unit_price ?? 0);
        byProduct.set(key, row);
      }
    }
    const top_products = [...byProduct.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const cutoff = Date.now() - 48 * 3600 * 1000;
    const done = new Set(["fulfilled", "shipped", "delivered", "canceled", "archived", "completed", "refunded"]);
    const sla = (orders as any[])
      .filter(
        (o) =>
          !done.has(String(o.fulfillment_status ?? "")) &&
          !done.has(String(o.status ?? "")) &&
          new Date(o.created_at ?? 0).getTime() < cutoff
      )
      .map((o) => ({
        order_id: String(o.id),
        display_id: (o.display_id ?? null) as number | null,
        email: (o.email ?? null) as string | null,
        age_hours: Math.round((Date.now() - new Date(o.created_at ?? 0).getTime()) / 3600000),
      }))
      .sort((a, b) => b.age_hours - a.age_hours)
      .slice(0, 10);

    return { revenue_30d, top_products, sla };
  } catch {
    return empty;
  }
}
