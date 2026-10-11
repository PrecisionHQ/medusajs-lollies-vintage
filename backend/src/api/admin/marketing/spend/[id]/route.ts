import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/** Ads v1 — Delete one spend row (fat-finger correction). */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    res.status(400).json({ message: "spend id is required." });
    return;
  }
  const marketing = req.scope.resolve("marketing") as any;
  await marketing.deleteMarketingAdSpends([id]);
  res.json({ deleted: true });
};
