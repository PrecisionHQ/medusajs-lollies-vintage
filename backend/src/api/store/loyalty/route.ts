import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSettings, liveBalance } from "../../../modules/loyalty/helpers";

/**
 * PR-13 — Shopper loyalty endpoints (all authed).
 * GET /store/loyalty → { balance, threshold, burn_value, burn_currency, ledger[] }.
 * Burn lives at POST /store/loyalty/redeem (separate route file).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to view loyalty points." });
    return;
  }
  const loyalty = req.scope.resolve("loyalty") as any;
  const settings = await getSettings(loyalty);
  const balance = await liveBalance(loyalty, customerId);
  const ledger = await loyalty.listLoyaltyLedgers(
    { customer_id: customerId },
    { take: 50, order: { created_at: "DESC" } }
  );
  res.json({
    balance,
    burn_threshold: settings.burn_threshold,
    burn_value_minor: settings.burn_value_minor,
    burn_currency: settings.burn_currency,
    ledger: ledger.map((r: any) => ({
      delta: r.delta,
      reason: r.reason,
      order_id: r.order_id,
      expires_at: r.expires_at,
      created_at: r.created_at,
    })),
  });
};
