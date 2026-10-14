import { describe, expect, it } from "vitest";
import { boardPlus } from "../summary/route";

const DAY = 24 * 3600 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const scopeWith = (orders: any[] | null) => ({
  resolve: (key: string) => {
    if (key === "order") {
      if (orders === null) throw new Error("order module down");
      return { listOrders: async () => orders };
    }
    throw new Error(`unresolvable: ${key}`);
  },
});

const order = (over: any) => ({
  id: "order_1",
  display_id: 7,
  email: "sam@example.com",
  total: 2000,
  currency_code: "eur",
  status: "pending",
  fulfillment_status: "not_fulfilled",
  created_at: ago(1),
  items: [{ product_id: "prod_a", title: "Silk dress", quantity: 2, unit_price: 1000 }],
  ...over,
});

describe("board+ summary sections", () => {
  it("buckets 30d revenue, ranks top products, flags >48h unfulfilled", async () => {
    const scope = scopeWith([
      order({}),
      order({
        id: "order_2",
        display_id: 8,
        total: 500,
        created_at: ago(3),
        fulfillment_status: "fulfilled",
        status: "completed",
        items: [{ product_id: "prod_b", title: "Wool scarf", quantity: 1, unit_price: 500 }],
      }),
      order({
        id: "order_3",
        display_id: 9,
        total: 3000,
        created_at: ago(5),
        items: [{ product_id: "prod_a", title: "Silk dress", quantity: 1, unit_price: 1000 }],
      }),
    ]);
    const res = await boardPlus(scope as any);
    expect(res.revenue_30d.length).toBe(3);
    expect(res.top_products[0]).toMatchObject({ title: "Silk dress", qty: 3 });
    // order_1 (unfulfilled, 24h) is not SLA; order_3 (unfulfilled, 5d) is.
    expect(res.sla.map((s) => s.order_id)).toEqual(["order_3"]);
    expect(res.sla[0].age_hours).toBeGreaterThanOrEqual(119);
  });

  it("returns empty sections when the order module fails", async () => {
    const res = await boardPlus(scopeWith(null) as any);
    expect(res).toEqual({ revenue_30d: [], top_products: [], sla: [] });
  });
});
