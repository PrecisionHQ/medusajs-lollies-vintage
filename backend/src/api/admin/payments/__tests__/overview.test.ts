import { describe, expect, it, vi } from "vitest";
import { GET } from "../overview/route";

const payment = (over: any) => ({
  id: "pay_1",
  provider_id: "stripe",
  amount: 2000,
  authorized_amount: 2000,
  captured_amount: 2000,
  refunded_amount: 0,
  currency_code: "eur",
  captured_at: "2026-10-10T00:00:00.000Z",
  created_at: "2026-10-10T00:00:00.000Z",
  payment_collection: { order_id: "order_1" },
  ...over,
});

const scopeWith = (payments: any[]) => {
  const res: any = { status: 200, body: null };
  return {
    res,
    req: {
      scope: {
        resolve: (key: string) => {
          if (key === "payment") {
            return { listPayments: vi.fn(async () => payments) };
          }
          if (key === "order") {
            return {
              listOrders: vi.fn(async () => [
                { id: "order_1", display_id: 7, email: "sam@example.com" },
              ]),
            };
          }
          throw new Error(`unresolvable: ${key}`);
        },
      },
    } as any,
    resObj: {
      json: (body: any) => {
        res.body = body;
      },
    } as any,
  };
};

describe("payments overview", () => {
  it("groups by provider, joins order display, flags stuck", async () => {
    const { req, resObj, res } = scopeWith([
      payment({}),
      payment({
        id: "pay_2",
        provider_id: "manual",
        captured_amount: 0,
        captured_at: null,
        created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        payment_collection: {},
      }),
    ]);
    await GET(req, resObj);
    expect(res.body.providers.find((p: any) => p.id === "stripe").tx).toBe(1);
    expect(res.body.transactions[0]).toMatchObject({ order_display: 7, email: "sam@example.com" });
    expect(res.body.stuck.map((t: any) => t.id)).toEqual(["pay_2"]);
  });

  it("degrades instead of throwing when modules fail", async () => {
    const res: any = { body: null };
    await GET(
      {
        scope: {
          resolve: () => {
            throw new Error("down");
          },
        },
      } as any,
      { json: (b: any) => (res.body = b) } as any
    );
    expect(res.body.degraded).toBe(true);
    expect(res.body.transactions).toEqual([]);
  });
});
