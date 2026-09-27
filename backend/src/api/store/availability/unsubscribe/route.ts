import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * PR-06 — Delete a stock alert via its emailed token (unauthenticated;
 * the 64-hex random token is unguessable and single-purpose).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { id, token } = (req.body ?? {}) as { id?: string; token?: string };

  if (!id || !token || token.length !== 64) {
    res.status(400).json({ message: "Invalid unsubscribe link." });
    return;
  }
  const rows = await marketing.listStockSubscriptions({ id });
  const sub = rows[0] as any;
  if (!sub || sub.token !== token) {
    res.status(400).json({ message: "Invalid unsubscribe link." });
    return;
  }
  await marketing.deleteStockSubscriptions([id]);
  res.json({ unsubscribed: true });
};
