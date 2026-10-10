import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * P3 — Queue a draft (or re-queue a scheduled) campaign for immediate
 * sending: marks it scheduled with scheduled_at=now so the next
 * quarter-hourly job run picks it up. Actual delivery happens in the job,
 * never in this request.
 */
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
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    res.status(400).json({
      message: `Only draft or scheduled campaigns can be queued (status: ${campaign.status}).`,
    });
    return;
  }

  // House pattern (see flows route): update, then re-list — the update
  // return shape isn't trustworthy for reading back.
  await marketing.updateMarketingCampaigns(
    { id },
    { status: "scheduled", scheduled_at: new Date() }
  );
  const fresh = await marketing.listMarketingCampaigns({ id });
  res.json({ campaign: fresh?.[0] ?? null, queued: true });
};
