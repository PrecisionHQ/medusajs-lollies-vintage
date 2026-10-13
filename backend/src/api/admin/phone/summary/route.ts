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
  });
};
