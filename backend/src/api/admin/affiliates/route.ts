import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { cleanHandle, validateCommission, validateHandle } from "../../../modules/affiliates/validation";

const PLATFORMS = ["instagram", "tiktok", "youtube", "blog", "other"] as const;

/**
 * Phase 4 (F1) — affiliate creators, invite-only model. GET lists
 * newest-first; POST creates ({ name, handle, platform?, commission_pct? });
 * per-id POST patches ({ status | code }); DELETE removes. Code minting
 * itself goes through the promotions API (dashboard/PWA call it, then
 * store the code here) so promo rules stay in one place.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const affiliates = req.scope.resolve("affiliate") as any;
  const rows = await affiliates.listAffiliateCreators({}, { order: { created_at: "DESC" }, take: 200 });
  res.json({ creators: rows ?? [] });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { name, handle, platform, commission_pct } = (req.body ?? {}) as {
    name?: string;
    handle?: string;
    platform?: string;
    commission_pct?: number;
  };
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    res.status(400).json({ message: "name is required (max 120 chars)." });
    return;
  }
  const badHandle = validateHandle(handle);
  if (badHandle) {
    res.status(400).json({ message: badHandle });
    return;
  }
  const clean = cleanHandle(handle as string);
  if (platform !== undefined && !(PLATFORMS as readonly string[]).includes(platform)) {
    res.status(400).json({ message: `platform must be one of: ${PLATFORMS.join(", ")}.` });
    return;
  }
  const pct = commission_pct ?? 10;
  const badPct = validateCommission(pct);
  if (badPct) {
    res.status(400).json({ message: badPct });
    return;
  }
  const affiliates = req.scope.resolve("affiliate") as any;
  const existing = await affiliates.listAffiliateCreators({ handle: clean });
  if (existing.length) {
    res.status(409).json({ message: "That handle is taken." });
    return;
  }
  const createdRaw = await affiliates.createAffiliateCreators({
    name: (name as string).trim(),
    handle: clean,
    platform: platform ?? "instagram",
    commission_pct: pct,
  });
  const created = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;
  res.status(201).json({ creator: { id: created.id, handle: created.handle } });
};
