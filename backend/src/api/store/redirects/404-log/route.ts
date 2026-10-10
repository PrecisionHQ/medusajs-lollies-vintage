import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { normalizeRedirectPath } from "../../../../modules/redirects/utils";

/**
 * PR-15 — 404 reporter. Unauthenticated (fired by not-found pages); stores
 * path-only aggregates, never IPs or user agents.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const redirects = req.scope.resolve("redirect") as any;
  const { path } = (req.body ?? {}) as { path?: string };
  const normalized = normalizeRedirectPath(path ?? "");
  if (!normalized || normalized.length > 500) {
    res.status(400).json({ message: "Invalid path." });
    return;
  }
  const rows = await redirects.listNotFoundLogs({ path: normalized });
  if (rows.length) {
    await redirects.updateNotFoundLogs({
      id: rows[0].id,
      hits: (rows[0].hits ?? 0) + 1,
      last_seen: new Date(),
    });
  } else {
    await redirects.createNotFoundLogs({
      path: normalized,
      hits: 1,
      last_seen: new Date(),
    });
  }
  res.json({ logged: true });
};
