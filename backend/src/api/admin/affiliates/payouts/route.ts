import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Phase 4 (F3) — manual payout ledger. GET lists newest-first (with
 * creator handles joined); POST records { creator_id, amount_minor,
 * currency?, note? }. Amounts enter as integer minor units — the UIs
 * convert from major. No delete: a mistaken payout is corrected with an
 * offsetting row and a note, so the ledger stays append-only and auditable.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const affiliates = req.scope.resolve("affiliate") as any;
  const [payouts, creators] = await Promise.all([
    affiliates.listAffiliatePayouts({}, { order: { created_at: "DESC" }, take: 200 }),
    affiliates.listAffiliateCreators({}, { take: 200 }).catch(() => []),
  ]);
  const byId = new Map((creators ?? []).map((c: any) => [c.id, c.handle]));
  res.json({
    payouts: (payouts ?? []).map((p: any) => ({
      id: p.id,
      creator_id: p.creator_id,
      handle: byId.get(p.creator_id) ?? null,
      amount_minor: p.amount_minor,
      currency: p.currency,
      note: p.note,
      created_at: p.created_at,
    })),
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { creator_id, amount_minor, currency, note } = (req.body ?? {}) as {
    creator_id?: string;
    amount_minor?: number;
    currency?: string;
    note?: string | null;
  };
  if (typeof creator_id !== "string" || !creator_id) {
    res.status(400).json({ message: "creator_id is required." });
    return;
  }
  if (!Number.isInteger(amount_minor) || (amount_minor as number) <= 0) {
    res.status(400).json({ message: "amount_minor must be a positive integer (minor units)." });
    return;
  }
  const cur = typeof currency === "string" && currency.trim() ? currency.trim().toLowerCase() : "eur";
  if (!/^[a-z]{3}$/.test(cur)) {
    res.status(400).json({ message: "currency must be a 3-letter code." });
    return;
  }
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 280)) {
    res.status(400).json({ message: "note must be ≤280 chars." });
    return;
  }
  const affiliates = req.scope.resolve("affiliate") as any;
  const existing = await affiliates.listAffiliateCreators({ id: creator_id }, { take: 1 }).catch(() => []);
  if (!existing?.length) {
    res.status(404).json({ message: "Creator not found." });
    return;
  }
  const createdRaw = await affiliates.createAffiliatePayouts({
    creator_id,
    amount_minor,
    currency: cur,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  const created = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;
  res.status(201).json({ payout: { id: created.id } });
};
