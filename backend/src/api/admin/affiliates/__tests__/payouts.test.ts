import { describe, expect, it, vi } from "vitest";
import { GET as payoutsGET, POST as payoutsPOST } from "../payouts/route";
import { GET as statsGET } from "../stats/route";

const res = () => {
  const out: any = {};
  return {
    out,
    res: {
      status: (code: number) => {
        out.status = code;
        return { json: (b: any) => (out.body = b) };
      },
      json: (b: any) => (out.body = b),
    } as any,
  };
};

describe("affiliate payouts", () => {
  it("lists with handles joined", async () => {
    const { res: r, out } = res();
    await payoutsGET(
      {
        scope: {
          resolve: () => ({
            listAffiliatePayouts: vi.fn(async () => [
              { id: "p1", creator_id: "c1", amount_minor: 500, currency: "eur", note: "PayPal", created_at: "2026-10-01" },
            ]),
            listAffiliateCreators: vi.fn(async () => [{ id: "c1", handle: "adaeze" }]),
          }),
        },
      } as any,
      r
    );
    expect(out.body.payouts).toEqual([
      { id: "p1", creator_id: "c1", handle: "adaeze", amount_minor: 500, currency: "eur", note: "PayPal", created_at: "2026-10-01" },
    ]);
  });

  it("validates creator, amount, currency, note", async () => {
    const okScope = {
      resolve: () => ({
        listAffiliateCreators: vi.fn(async () => [{ id: "c1" }]),
        createAffiliatePayouts: vi.fn(async (a: any) => a),
      }),
    };
    const post = async (body: any) => {
      const { res: r, out } = res();
      await payoutsPOST({ body, scope: okScope, params: {} } as any, r);
      return out;
    };
    expect((await post({})).status).toBe(400);
    expect((await post({ creator_id: "c1", amount_minor: 0 })).status).toBe(400);
    expect((await post({ creator_id: "c1", amount_minor: 10.5 })).status).toBe(400);
    expect((await post({ creator_id: "c1", amount_minor: 500, currency: "EURO" })).status).toBe(400);
    const created = await post({ creator_id: "c1", amount_minor: 500, note: "PayPal x" });
    expect(created.status).toBe(201);
    const missing = await (async () => {
      const { res: r, out } = res();
      await payoutsPOST(
        {
          body: { creator_id: "ghost", amount_minor: 500 },
          params: {},
          scope: { resolve: () => ({ listAffiliateCreators: vi.fn(async () => []) }) },
        } as any,
        r
      );
      return out;
    })();
    expect(missing.status).toBe(404);
  });

  it("attaches lifetime paid per creator+currency on stats", async () => {
    const { res: r, out } = res();
    await statsGET(
      {
        query: { days: "30" },
        scope: {
          resolve: (key: string) => {
            if (key === "affiliate") {
              return {
                listAffiliateCreators: vi.fn(async () => [
                  { id: "c1", handle: "adaeze", commission_pct: 10, code: "ADAEZE10" },
                ]),
                listAffiliateHits: vi.fn(async () => []),
                listAffiliatePayouts: vi.fn(async () => [
                  { creator_id: "c1", amount_minor: 200, currency: "eur" },
                ]),
              };
            }
            return {
              listOrders: vi.fn(async () => [
                {
                  id: "o1",
                  total: 2000,
                  currency_code: "eur",
                  created_at: new Date().toISOString(),
                  items: [{ adjustments: [{ code: "adaeze10" }] }],
                },
              ]),
            };
          },
        },
      } as any,
      r
    );
    expect(out.body.rows).toHaveLength(1);
    expect(out.body.rows[0]).toMatchObject({ owed_minor: 200, paid_minor: 200 });
  });
});
