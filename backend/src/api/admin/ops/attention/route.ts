import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { buildAttention } from "../../../../modules/ops/attention";

/**
 * Attention hub — one severity-ordered feed for the dashboard page and the
 * PWA Status card. Section logic lives in modules/ops/attention (shared
 * with the digest job); this route only stamps and serves it.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.json({
    generated_at: new Date().toISOString(),
    sections: await buildAttention(req.scope),
  });
};
