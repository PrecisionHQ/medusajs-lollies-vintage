import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Patch one creator: { status: "active" | "paused" } and/or { code } (the
 * personal promo code, minted via the promotions API then stored here).
 * DELETE removes the creator (promo codes it minted stay valid — retire
 * those on the dashboard promotions page if needed).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { status, code } = (req.body ?? {}) as {
    status?: string;
    code?: string | null;
  };
  const update: Record<string, unknown> = { id: req.params.id };
  if (status !== undefined) {
    if (status !== "active" && status !== "paused") {
      res.status(400).json({ message: 'status must be "active" or "paused".' });
      return;
    }
    update.status = status;
  }
  if (code !== undefined) {
    if (code !== null && (typeof code !== "string" || !code.trim() || code.trim().length > 64)) {
      res.status(400).json({ message: "code must be 1-64 chars or null." });
      return;
    }
    update.code = code === null ? null : code.trim().toUpperCase();
  }
  if (Object.keys(update).length === 1) {
    res.status(400).json({ message: "Nothing to update (status and/or code)." });
    return;
  }
  const affiliates = req.scope.resolve("affiliate") as any;
  const updatedRaw = await affiliates.updateAffiliateCreators(update);
  const updated = Array.isArray(updatedRaw) ? updatedRaw[0] : updatedRaw;
  if (!updated) {
    res.status(404).json({ message: "Creator not found." });
    return;
  }
  res.json({ creator: { id: updated.id, status: updated.status, code: updated.code } });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const affiliates = req.scope.resolve("affiliate") as any;
  await affiliates.deleteAffiliateCreators(req.params.id).catch(() => null);
  res.json({ deleted: true });
};
