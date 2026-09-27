import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * PR-15 — Public redirect table (paths are public mappings — safe) plus the
 * 404 reporter. Middleware caches GET /store/redirects hourly; misses POST
 * here from not-found pages (path-only, hit-counted, unauthenticated).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const redirects = req.scope.resolve("redirect") as any;
  const rows = await redirects.listRedirects({}, { take: 5000 });
  res.json({
    redirects: rows.map((r: any) => ({
      from: r.from_path,
      to: r.to_path,
      status: r.status_code === 302 ? 302 : 301,
    })),
  });
};
