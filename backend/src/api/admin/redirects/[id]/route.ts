import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { normalizeRedirectPath } from "../../../../modules/redirects/utils";

/**
 * PR-15 — Redirect delete + CSV import.
 * DELETE /admin/redirects/:id removes one row.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const redirects = req.scope.resolve("redirect") as any;
  await redirects.deleteRedirects([req.params.id]);
  res.json({ deleted: true });
};
