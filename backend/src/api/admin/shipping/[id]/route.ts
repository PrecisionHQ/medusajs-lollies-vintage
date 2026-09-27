import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { deleteShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";

/**
 * PR-12 — Delete a shipping band (option). Disabling is delete + recreate;
 * an option mid-checkout fails closed (checkout re-lists options).
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await deleteShippingOptionsWorkflow(req.scope).run({
    input: { ids: [req.params.id] },
  });
  res.json({ deleted: true });
};
