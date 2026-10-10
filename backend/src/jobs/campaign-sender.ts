import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { runCampaignSend } from "../modules/marketing/campaign-sender";

/**
 * P3 — Campaign sender pass, every 15 minutes. Picks up campaigns that are
 * scheduled and due (or mid-sending after a crash) and batch-sends them.
 * The send log makes overlapping runs safe; a failed run never wedges the
 * scheduler — the next quarter hour retries whatever is left.
 */
export default async function campaignSenderJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  try {
    const marketing = container.resolve("marketing") as any;
    const now = new Date();
    const due = await marketing.listMarketingCampaigns({
      $or: [{ status: "scheduled" }, { status: "sending" }],
    });
    let total = { sent: 0, failed: 0, skipped: 0 };
    for (const campaign of due || []) {
      if (
        campaign.status === "scheduled" &&
        campaign.scheduled_at &&
        new Date(campaign.scheduled_at).getTime() > now.getTime()
      ) {
        continue;
      }
      try {
        const r = await runCampaignSend(container, campaign.id);
        total = {
          sent: total.sent + r.sent,
          failed: total.failed + r.failed,
          skipped: total.skipped + r.skipped,
        };
      } catch (error) {
        logger.error(
          `campaign-sender: campaign ${campaign.id} failed: ${(error as Error).message}`
        );
      }
    }
    if (total.sent + total.failed > 0) {
      logger.info(
        `campaign-sender: sent=${total.sent} failed=${total.failed} skipped=${total.skipped}`
      );
    }
  } catch (error) {
    logger.error(`campaign-sender job failed: ${(error as Error).message}`);
  }
}

export const config = {
  name: "campaign-sender-quarter-hourly",
  schedule: "*/15 * * * *",
};
