import { describe, expect, it, vi } from "vitest";
import { GET } from "../roas/route";

const ago = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

const scopeWith = (spend: any[], orders: any[]) => ({
  resolve: (key: string) => {
    if (key === "marketing") {
      return { listMarketingAdSpends: vi.fn(async () => spend) };
    }
    if (key === "order") {
      return { listOrders: vi.fn(async () => orders) };
    }
    throw new Error(`unresolvable: ${key}`);
  },
});

const run = async (scope: any) => {
  let body: any = null;
  await GET({ scope, query: { days: "30" } } as any, { json: (b: any) => (body = b) } as any);
  return body;
};

describe("roas aggregator", () => {
  it("joins spend to attributed revenue with roas math", async () => {
    const scope = scopeWith(
      [
        { source: "tiktok", currency: "eur", amount_minor: 10000, spend_date: ago(2).slice(0, 10) },
        { source: "meta", currency: "eur", amount_minor: 5000, spend_date: ago(2).slice(0, 10) },
      ],
      [
        { total: 30000, currency_code: "eur", metadata: { attribution: { utm_source: "tiktok" } }, created_at: ago(1) },
        { total: 10000, currency_code: "eur", metadata: { attribution: { utm_source: "TikTok" } }, created_at: ago(1) },
        { total: 5000, currency_code: "eur", metadata: {}, created_at: ago(1) },
      ]
    );
    const body = await run(scope);
    const tiktok = body.rows.find((r: any) => r.source === "tiktok");
    expect(tiktok).toMatchObject({ spend_minor: 10000, revenue_minor: 40000, orders: 2, roas: 4 });
    const meta = body.rows.find((r: any) => r.source === "meta");
    expect(meta).toMatchObject({ spend_minor: 5000, revenue_minor: 0, roas: 0 });
    expect(body.unattributed).toEqual([{ currency: "eur", revenue_minor: 5000, orders: 1 }]);
  });

  it("returns null roas for organic sources and degrades on failure", async () => {
    const scope = scopeWith(
      [],
      [{ total: 1000, currency_code: "eur", metadata: { attribution: { utm_source: "newsletter" } }, created_at: ago(1) }]
    );
    const body = await run(scope);
    expect(body.rows[0]).toMatchObject({ source: "newsletter", roas: null });
    const bad = await run({ resolve: () => { throw new Error("down"); } } as any);
    expect(bad.degraded).toBe(true);
  });
});
