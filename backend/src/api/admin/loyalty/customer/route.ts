import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { liveBalance } from "../../../../modules/loyalty/helpers";

/**
 * PR-13 — One customer's loyalty account for the admin widget.
 * GET /admin/loyalty/customer?customer_id=… → balance (expiry-aware) + recent ledger.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = req.query.customer_id as string | undefined;
  if (!customerId) {
    res.status(400).json({ message: "customer_id is required." });
    return;
  }
  const loyalty = req.scope.resolve("loyalty") as any;
  const balance = await liveBalance(loyalty, customerId);
  const ledger = await loyalty.listLoyaltyLedgers(
    { customer_id: customerId },
    { take: 10, order: { created_at: "DESC" } }
  );
  res.json({
    balance,
    ledger: ledger.map((r: any) => ({
      delta: r.delta,
      reason: r.reason,
      order_id: r.order_id,
      created_at: r.created_at,
    })),
  });
};
