import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export type Severity = "critical" | "warning" | "info";

export type AttentionSection = {
  key: string;
  severity: Severity;
  count: number;
  items: Record<string, unknown>[];
  app_tab: string | null;
  admin_route: string | null;
  degraded?: boolean;
};

const DAY = 24 * 3600 * 1000;

async function section<T>(
  key: string,
  severity: Severity,
  app_tab: string | null,
  admin_route: string | null,
  build: () => Promise<{ count: number; items: T[] }>
): Promise<AttentionSection> {
  try {
    const { count, items } = await build();
    return { key, severity, count, items: items as Record<string, unknown>[], app_tab, admin_route };
  } catch {
    return { key, severity, count: 0, items: [], app_tab, admin_route, degraded: true };
  }
}

/**
 * Attention hub sections, shared by the HTTP route and the digest job
 * (which must not HTTP-call the server from inside it). Same contract as
 * the route: every section independently try/caught, every read bounded,
 * money grouped per currency with no FX.
 */
export async function buildAttention(scope: any): Promise<AttentionSection[]> {
  // The container itself can fail (tests, partial boots) — degrade the
  // query-backed sections instead of throwing out of the builder.
  let query: any = null;
  try {
    query = scope.resolve(ContainerRegistrationKeys.QUERY) as any;
  } catch {
    query = null;
  }

  const jobs = await section("jobs", "warning", null, null, async () => {
    const ops = scope.resolve("ops") as any;
    const rows = await ops.listOpsHeartbeats({});
    const stale = (rows ?? []).filter((r: any) => {
      const ok = new Date(r.last_ok_at ?? 0).getTime();
      const err = r.last_error ? new Date(r.updated_at ?? 0).getTime() : 0;
      return err > ok || Date.now() - ok > 25 * 3600 * 1000;
    });
    return {
      count: stale.length,
      items: stale.slice(0, 10).map((r: any) => ({
        name: r.name,
        last_error: r.last_error,
      })),
    };
  });

  const approvals = await section("approvals", "warning", "moderate", "/moderation", async () => {
    let questions = 0;
    let reviews = 0;
    try {
      [, questions] = await (scope.resolve("question") as any).listAndCountQuestions({ status: "open" });
    } catch { /* optional module reads as zero */ }
    try {
      [, reviews] = await (scope.resolve("review") as any).listAndCountReviews({ status: "pending" });
    } catch { /* optional module reads as zero */ }
    return {
      count: (questions ?? 0) + (reviews ?? 0),
      items: [
        ...(questions ? [{ kind: "questions", count: questions }] : []),
        ...(reviews ? [{ kind: "reviews", count: reviews }] : []),
      ],
    };
  });

  const sla = await section("sla", "critical", "orders", "/orders", async () => {
    const orderModule = scope.resolve("order") as any;
    const orders = await orderModule.listOrders(
      { created_at: { $gte: new Date(Date.now() - 14 * DAY) } },
      { take: 500, order: { created_at: "ASC" } }
    );
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const done = new Set(["fulfilled", "shipped", "delivered", "canceled", "archived", "completed", "refunded"]);
    const rows = (orders ?? [])
      .filter(
        (o: any) =>
          !done.has(String(o.fulfillment_status ?? "")) &&
          !done.has(String(o.status ?? "")) &&
          new Date(o.created_at ?? 0).getTime() < cutoff
      )
      .slice(0, 10)
      .map((o: any) => ({
        order_id: String(o.id),
        display_id: o.display_id ?? null,
        email: o.email ?? null,
        age_hours: Math.round((Date.now() - new Date(o.created_at ?? 0).getTime()) / 3600000),
      }));
    return { count: rows.length, items: rows };
  });

  const payments = await section("payments", "warning", "orders", "/orders", async () => {
    // Only the genuinely stuck state: authorized-but-uncaptured older than
    // a day. Plain "awaiting" is normal (manual payment until a provider
    // is configured) and must not page the owner.
    const orderModule = scope.resolve("order") as any;
    const orders = await orderModule.listOrders(
      { payment_status: "authorized", created_at: { $lt: new Date(Date.now() - DAY) } },
      { take: 50, order: { created_at: "ASC" } }
    ).catch(() => []);
    const rows = (orders ?? []).slice(0, 10).map((o: any) => ({
      order_id: String(o.id),
      display_id: o.display_id ?? null,
      total: o.total ?? null,
      currency: o.currency_code ?? null,
    }));
    return { count: rows.length, items: rows };
  });

  const flows_off = await section("flows_off", "warning", "flows", "/flows", async () => {
    const marketing = scope.resolve("marketing") as any;
    const configs = await marketing.listFlowConfigs({});
    const rows = (configs ?? [])
      .filter((c: any) => c.enabled === false)
      .map((c: any) => ({
        key: c.key,
        days_off: Math.floor((Date.now() - new Date(c.updated_at ?? 0).getTime()) / DAY),
      }));
    return { count: rows.length, items: rows.slice(0, 12) };
  });

  const stock = await section("stock", "warning", "catalog", null, async () => {
    const { data: variants }: { data: any[] } = await query.graph({
      entity: "product_variant",
      fields: ["id", "title", "inventory_quantity", "product.title"],
      pagination: { take: 200 },
    });
    const rows = (variants ?? [])
      .map((v: any) => ({
        variant_id: String(v.id ?? ""),
        title: [v.product?.title, v.title].filter(Boolean).join(" / ") || String(v.id ?? ""),
        available: Number(v.inventory_quantity ?? 0),
      }))
      .filter((v) => v.available < 5)
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);
    return { count: rows.length, items: rows };
  });

  const campaigns = await section("campaigns", "warning", "flows", "/campaigns", async () => {
    const marketing = scope.resolve("marketing") as any;
    const list = await marketing.listMarketingCampaigns({}, { order: { created_at: "DESC" }, take: 50 });
    const failed: Record<string, unknown>[] = [];
    const stale: Record<string, unknown>[] = [];
    for (const c of list ?? []) {
      try {
        const sends = await marketing.listMarketingCampaignSends(
          { campaign_id: c.id },
          { select: ["status", "created_at"], take: 1000 }
        );
        const recentFails = (sends ?? []).filter(
          (s: any) => s.status === "failed" && new Date(s.created_at ?? 0).getTime() > Date.now() - 7 * DAY
        );
        if (recentFails.length) {
          failed.push({ campaign_id: c.id, subject: c.subject ?? null, failed: recentFails.length });
        }
      } catch { /* send-log gaps read as zero */ }
      if (c.status === "draft" && new Date(c.created_at ?? 0).getTime() < Date.now() - 14 * DAY) {
        stale.push({ campaign_id: c.id, subject: c.subject ?? null });
      }
    }
    return { count: failed.length + stale.length, items: [...failed, ...stale].slice(0, 10) };
  });

  const back_in_stock = await section("back_in_stock", "info", null, null, async () => {
    const marketing = scope.resolve("marketing") as any;
    const subs = await marketing.listStockSubscriptions({}, { take: 500 });
    const waiting = (subs ?? []).filter(
      (s: any) => !s.notified_at && new Date(s.created_at ?? 0).getTime() < Date.now() - 7 * DAY
    );
    return { count: waiting.length, items: [] };
  });

  const sections = [sla, payments, jobs, approvals, flows_off, stock, campaigns, back_in_stock];
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  sections.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);
  return sections.filter((s) => s.count > 0 || s.degraded);
}
