import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * P2 — Update a draft campaign. Non-draft campaigns are read-only until
 * P3 (send flow) owns their transitions.
 */
const EDITABLE = [
  "subject",
  "headline",
  "body",
  "cta_label",
  "cta_href",
  "product_handles",
  "scheduled_at",
] as const;

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { id } = req.params as { id?: string };
  if (!id) {
    res.status(400).json({ message: "campaign id is required." });
    return;
  }

  const rows = await marketing.listMarketingCampaigns({ id });
  const campaign = rows?.[0];
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }
  if (campaign.status !== "draft") {
    res
      .status(400)
      .json({ message: "Only draft campaigns can be edited." });
    return;
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    const value = (req.body as Record<string, unknown> | undefined)?.[key];
    if (typeof value === "string") {
      patch[key] = key === "scheduled_at" ? value || null : value;
    }
  }
  if (!Object.keys(patch).length) {
    res.status(400).json({ message: "Nothing to update." });
    return;
  }

  await marketing.updateMarketingCampaigns({ id, ...patch });
  const fresh = await marketing.listMarketingCampaigns({ id });
  res.json({ campaign: fresh?.[0] ?? null });
};
