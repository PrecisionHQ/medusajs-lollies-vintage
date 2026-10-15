import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * Phase 4 (F2) — referral hit beacon. Store route (publishable key), no
 * PII: records { handle } when the handle belongs to a creator. Always
 * answers ok:true (even for unknown handles — the handle list is public
 * by nature of referral links, and a 404 would just add failure modes to
 * a fire-and-forget beacon). Failures resolve to ok:true as well: the
 * storefront fires this without awaiting, and visits are advisory —
 * payouts key on redemptions, never on this table.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { handle } = (req.body ?? {}) as { handle?: string };
    const clean = typeof handle === "string" ? handle.trim().toLowerCase() : "";
    if (clean && clean.length <= 40) {
      const affiliates = req.scope.resolve("affiliate") as any;
      const existing = await affiliates
        .listAffiliateCreators({ handle: clean }, { take: 1 })
        .catch(() => []);
      if (existing?.length) {
        await affiliates.createAffiliateHits({ handle: clean }).catch(() => null);
      }
    }
  } catch {
    // Beacon. Never fail the shopper's request.
  }
  res.json({ ok: true });
};
