import { describe, expect, it } from "vitest";
import { attributeStats } from "../attribution";

const ago = (days: number) => new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
const SINCE = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

const ada = { id: "c1", handle: "adaeze", commission_pct: 10, code: "ADAEZE10" };

const orderWith = (code: string | null, total = 2000) => ({
  id: `order_${code ?? "none"}`,
  total,
  currency_code: "eur",
  created_at: ago(1),
  items: code ? [{ adjustments: [{ code }] }] : [{}],
});

describe("affiliate attribution", () => {
  it("joins code redemptions to revenue and owed (case-insensitive)", async () => {
    const rows = attributeStats(
      [ada],
      [
        { handle: "adaeze", created_at: ago(2) },
        { handle: "Adaeze", created_at: ago(3) },
        { handle: "adaeze", created_at: ago(60) },
      ],
      [orderWith("adaeze10"), orderWith("ADAEZE10", 3000), orderWith(null)],
      SINCE
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      handle: "adaeze",
      visits: 2,
      redemptions: 2,
      revenue_minor: 5000,
      owed_minor: 500,
    });
  });

  it("ignores unknown codes and splits currencies", () => {
    const rows = attributeStats(
      [ada, { id: "c2", handle: "bob", commission_pct: 20, code: null }],
      [{ handle: "bob", created_at: ago(1) }],
      [
        { ...orderWith("STRANGER5"), id: "o1" },
        { ...orderWith("ADAEZE10", 1000), id: "o2", currency_code: "usd" },
      ],
      SINCE
    );
    const usd = rows.find((r) => r.currency === "usd");
    expect(usd).toMatchObject({ redemptions: 1, revenue_minor: 1000, owed_minor: 100 });
    const bob = rows.find((r) => r.handle === "bob");
    expect(bob).toMatchObject({ visits: 1, redemptions: 0, revenue_minor: 0 });
  });
});
