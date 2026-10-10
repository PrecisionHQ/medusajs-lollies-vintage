import { Modules } from "@medusajs/framework/utils";
import { EmailTemplates } from "../email-notifications/templates";
import { RESEND_FROM_EMAIL } from "../../lib/constants";
import { buildCampaignEmailData, CampaignRow } from "./campaign-email";

const BATCH = 100;

export type CampaignSendResult = {
  sent: number;
  failed: number;
  skipped: number;
  done: boolean;
  reason?: string;
};

/**
 * P3 — Batch-send one campaign. Safe to re-run: recipients with a send-log
 * row for this campaign are skipped, so a crash or an overlapping job run
 * can never double-send. Audience = confirmed subscribers minus opt-outs.
 */
export async function runCampaignSend(
  scope: { resolve: (key: string) => any },
  campaignId: string,
  opts?: { batch?: number }
): Promise<CampaignSendResult> {
  const marketing = scope.resolve("marketing") as any;
  const batch = opts?.batch ?? BATCH;

  const rows = await marketing.listMarketingCampaigns({ id: campaignId });
  const campaign = rows?.[0] as CampaignRow | undefined;
  if (!campaign) {
    return { sent: 0, failed: 0, skipped: 0, done: true, reason: "not-found" };
  }
  if (campaign.status !== "scheduled" && campaign.status !== "sending") {
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      done: true,
      reason: `status-${campaign.status}`,
    };
  }
  if (campaign.scheduled_at && new Date(campaign.scheduled_at).getTime() > Date.now()) {
    return { sent: 0, failed: 0, skipped: 0, done: false, reason: "not-due" };
  }

  if (campaign.status === "scheduled") {
    await marketing.updateMarketingCampaigns({ id: campaignId, status: "sending" });
  }

  // Exclusion sets, loaded once per run.
  const optOutRows = await marketing
    .listMarketingOptOuts({}, { select: ["email"], take: 10000 })
    .catch(() => []);
  const optOuts = new Set(
    (optOutRows || []).map((r: any) => (r.email || "").toLowerCase())
  );
  const sentRows = await marketing
    .listMarketingCampaignSends({ campaign_id: campaignId }, { select: ["email", "status"], take: 100000 })
    .catch(() => []);
  // Terminal states only: failed rows are NOT retried (transient outages
  // show up in the failure count; duplicate the campaign to retry them).
  // "sending" rows left by a crashed run are treated as unsent.
  const alreadyDone = new Set(
    (sentRows || [])
      .filter((r: any) => r.status === "sent" || r.status === "failed")
      .map((r: any) => (r.email || "").toLowerCase())
  );

  const notifications = scope.resolve(Modules.NOTIFICATION);
  let sent = 0,
    failed = 0,
    skipped = 0,
    offset = 0;

  for (;;) {
    const subs =
      (await marketing.listNewsletterSubscriptions(
        { status: "confirmed" },
        { select: ["email"], take: batch, skip: offset }
      ).catch(() => [])) || [];
    if (!subs.length) break;
    offset += subs.length;

    for (const sub of subs) {
      const email = (sub.email || "").toLowerCase();
      if (!email || alreadyDone.has(email) || optOuts.has(email)) {
        skipped += 1;
        continue;
      }
      // Claim first: a concurrent run seeing this row skips it.
      try {
        await marketing.createMarketingCampaignSends({
          campaign_id: campaignId,
          email,
          status: "sending",
          sent_at: null,
        });
      } catch {
        skipped += 1;
        continue;
      }
      try {
        const data = await buildCampaignEmailData(scope, campaign, { email });
        await notifications.createNotifications({
          to: email,
          channel: "email",
          template: EmailTemplates.CAMPAIGN,
          data: {
            emailOptions: {
              replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
              subject: campaign.subject,
            },
            ...data,
          },
        });
        await marketing.updateMarketingCampaignSends(
          { campaign_id: campaignId, email },
          { status: "sent", sent_at: new Date() }
        );
        alreadyDone.add(email);
        sent += 1;
      } catch (e: any) {
        await marketing
          .updateMarketingCampaignSends(
            { campaign_id: campaignId, email },
            { status: "failed", error: String(e?.message || e).slice(0, 500) }
          )
          .catch(() => {});
        failed += 1;
      }
    }
    if (subs.length < batch) break;
  }

  await marketing
    .updateMarketingCampaigns({ id: campaignId, status: "sent" })
    .catch(() => {});
  return { sent, failed, skipped, done: true };
}
