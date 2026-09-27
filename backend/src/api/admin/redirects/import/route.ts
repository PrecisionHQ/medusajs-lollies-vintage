import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { normalizeRedirectPath } from "../../../../modules/redirects/utils";

/**
 * PR-15 — Bulk import. POST { csv } with `from,to,status?` rows (status
 * defaults 301). Existing from_paths update in place; bad rows are skipped
 * and reported, never fail the batch.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const redirects = req.scope.resolve("redirect") as any;
  const { csv } = (req.body ?? {}) as { csv?: string };
  if (typeof csv !== "string" || !csv.trim()) {
    res.status(400).json({ message: "csv is required." });
    return;
  }

  let created = 0;
  let updated = 0;
  const skipped: string[] = [];
  for (const [n, line] of csv.split("\n").entries()) {
    if (!line.trim()) {
      continue;
    }
    const [fromRaw, toRaw, statusRaw] = line.split(",").map((s) => s.trim());
    const from = normalizeRedirectPath(fromRaw ?? "");
    const to = (toRaw ?? "").trim();
    const code = statusRaw === "302" ? 302 : 301;
    if (!from || !to.startsWith("/")) {
      skipped.push(`line ${n + 1}: need from-path,to-/path`);
      continue;
    }
    const existing = await redirects.listRedirects({ from_path: from });
    if (existing.length) {
      await redirects.updateRedirects(
        { id: existing[0].id },
        { to_path: to, status_code: code }
      );
      updated += 1;
    } else {
      await redirects.createRedirects({
        from_path: from,
        to_path: to,
        status_code: code,
      });
      created += 1;
    }
  }
  res.json({ created, updated, skipped });
};
