import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { attributeStats } from "../../../../modules/affiliates/attribution";

const DAY = 24 * 3600 * 1000;

/**
 * Phase 4 (F2) — attribution board data. Per creator+currency: visits
 * (hit log, advisory), redemptions (orders carrying the creator's code in
 * line-item adjustments, authoritative), revenue, commission owed. Bounded
 * reads (200 creators, 2000 hits, 1000 orders); fail-open degraded
 * contract like every other aggregator.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const scope = req.scope;
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    const since = new Date(Date.now() - days * DAY);
    const affiliates = scope.resolve("affiliate") as any;
    const orderModule = scope.resolve("order") as any;

    const [creators, hits, orders] = await Promise.all([
      affiliates
        .listAffiliateCreators({}, { take: 200, order: { created_at: "DESC" } })
        .catch(() => []),
      affiliates
        .listAffiliateHits({ created_at: { $gte: since } }, { take: 2000 })
        .catch(() => []),
      orderModule
        .listOrders(
          { created_at: { $gte: since } },
          { relations: ["items.adjustments"], take: 1000 }
        )
        .catch(() => []),
    ]);

    res.json({
      generated_at: new Date().toISOString(),
      days,
      rows: attributeStats(creators ?? [], hits ?? [], orders ?? [], since.toISOString()),
    });
  } catch {
    res.json({ generated_at: new Date().toISOString(), days: 0, rows: [], degraded: true });
  }
};
