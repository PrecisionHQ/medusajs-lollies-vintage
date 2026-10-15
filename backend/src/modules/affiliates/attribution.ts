/**
 * Phase 4 (F2) — attribution math. Pure (no container), unit-testable.
 *
 * Redemptions: orders whose line-item adjustments carry the creator's
 * code (case-insensitive). Visits: hit rows counted per handle in the
 * window. Owed: revenue × commission_pct / 100. Rows are per
 * creator+currency (no FX); creators with nothing in range are omitted.
 */

export type CreatorInput = {
  id: string;
  handle: string;
  commission_pct?: number | null;
  code?: string | null;
  status?: string | null;
};

export type HitInput = {
  handle: string;
  created_at?: string | null;
};

export type OrderInput = {
  id: string;
  total?: number | null;
  currency_code?: string | null;
  created_at?: string | null;
  items?: { adjustments?: { code?: string | null }[] | null }[] | null;
};

export type CreatorStat = {
  creator_id: string;
  handle: string;
  visits: number;
  redemptions: number;
  currency: string;
  revenue_minor: number;
  owed_minor: number;
};

export function attributeStats(
  creators: CreatorInput[],
  hits: HitInput[],
  orders: OrderInput[],
  sinceIso: string
): CreatorStat[] {
  const since = new Date(sinceIso).getTime();
  const inWindow = (iso?: string | null) =>
    !!iso && new Date(iso).getTime() >= since;

  const visits = new Map<string, number>();
  for (const h of hits) {
    if (!inWindow(h.created_at)) continue;
    const key = h.handle.trim().toLowerCase();
    visits.set(key, (visits.get(key) ?? 0) + 1);
  }

  const byCode = new Map<string, CreatorInput>();
  for (const c of creators) {
    if (c.code) byCode.set(c.code.trim().toUpperCase(), c);
  }

  const perCreator = new Map<string, CreatorStat>();
  const statFor = (c: CreatorInput, currency: string): CreatorStat => {
    const key = `${c.id}|${currency}`;
    let row = perCreator.get(key);
    if (!row) {
      row = {
        creator_id: c.id,
        handle: c.handle,
        visits: visits.get(c.handle.trim().toLowerCase()) ?? 0,
        redemptions: 0,
        currency,
        revenue_minor: 0,
        owed_minor: 0,
      };
      perCreator.set(key, row);
    }
    return row;
  };

  for (const o of orders) {
    if (!inWindow(o.created_at)) continue;
    const codes = new Set(
      (o.items ?? []).flatMap((i) =>
        (i.adjustments ?? [])
          .map((a) => a.code?.trim().toUpperCase())
          .filter(Boolean)
      ) as string[]
    );
    if (!codes.size) continue;
    const currency = String(o.currency_code ?? "eur").toLowerCase();
    for (const code of codes) {
      const creator = byCode.get(code);
      if (!creator) continue;
      const row = statFor(creator, currency);
      row.redemptions += 1;
      row.revenue_minor += Number(o.total ?? 0);
      row.owed_minor += Math.round(
        (Number(o.total ?? 0) * Number(creator.commission_pct ?? 0)) / 100
      );
    }
  }

  // Creators with visits but no redemptions still show (visits > 0).
  for (const c of creators) {
    const v = visits.get(c.handle.trim().toLowerCase()) ?? 0;
    if (v > 0 && ![...perCreator.keys()].some((k) => k.startsWith(`${c.id}|`))) {
      perCreator.set(`${c.id}|eur`, {
        creator_id: c.id,
        handle: c.handle,
        visits: v,
        redemptions: 0,
        currency: "eur",
        revenue_minor: 0,
        owed_minor: 0,
      });
    }
  }

  return [...perCreator.values()].sort(
    (a, b) => b.revenue_minor - a.revenue_minor || b.visits - a.visits
  );
}
