import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { normalizeRedirectPath } from "../../../modules/redirects/utils";

/**
 * PR-15 — Redirect admin API. GET returns redirects + 404 log (hits first).
 * POST creates one { from, to, status? }; import { csv } bulk-loads
 * `from,to,status?` rows (Shopify URL exports fit after column-trimming).
 * from_paths dedupe: an existing row is updated, never duplicated.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const redirects = req.scope.resolve("redirect") as any;
  const rows = await redirects.listRedirects({}, { take: 5000 });
  const logs = await redirects.listNotFoundLogs(
    {},
    { take: 100, order: { hits: "DESC" } }
  );
  res.json({
    redirects: rows.map((r: any) => ({
      id: r.id,
      from: r.from_path,
      to: r.to_path,
      status: r.status_code,
    })),
    notFound: logs.map((l: any) => ({
      path: l.path,
      hits: l.hits,
      last_seen: l.last_seen,
    })),
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const redirects = req.scope.resolve("redirect") as any;
  const { from, to, status } = (req.body ?? {}) as {
    from?: string;
    to?: string;
    status?: number;
  };
  const fromPath = normalizeRedirectPath(from ?? "");
  const toPath = (to ?? "").trim();
  const code = status === 302 ? 302 : 301;
  if (!fromPath || fromPath.length > 500 || !toPath.startsWith("/")) {
    res.status(400).json({
      message: "from (path) and to (/path) are required; to must start with /.",
    });
    return;
  }
  const existing = await redirects.listRedirects({ from_path: fromPath });
  if (existing.length) {
    const updatedRaw = await redirects.updateRedirects({
      id: existing[0].id,
      to_path: toPath,
      status_code: code,
    });
    const updated = Array.isArray(updatedRaw) ? updatedRaw[0] : updatedRaw;
    res.json({ redirect: { id: updated.id }, deduped: true });
    return;
  }
  const [created] = await redirects.createRedirects({
    from_path: fromPath,
    to_path: toPath,
    status_code: code,
  });
  res.status(201).json({ redirect: { id: created.id }, deduped: false });
};
