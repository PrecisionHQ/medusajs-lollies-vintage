import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { EmailTemplates } from "../../../../../../modules/email-notifications/templates";
import { buildCampaignEmailData } from "../../../../../../modules/marketing/campaign-email";
import { RESEND_FROM_EMAIL } from "../../../../../../lib/constants";

/**
 * P2 — Send one draft campaign mail to a typed address (inbox proof
 * before P3 batch sending exists). Real unsubscribe link for the
 * recipient; never touches the subscriber list.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params as { id?: string };
  const { email } = (req.body ?? {}) as { email?: string };
  const normalized = (email ?? "").trim().toLowerCase();
  if (!id) {
    res.status(400).json({ message: "campaign id is required." });
    return;
  }
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    res.status(400).json({ message: "A valid email address is required." });
    return;
  }

  const marketing = req.scope.resolve("marketing") as any;
  const rows = await marketing.listMarketingCampaigns({ id });
  const campaign = rows?.[0];
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  const data = await buildCampaignEmailData(req.scope, campaign, {
    email: normalized,
  });
  try {
    const notifications = req.scope.resolve(Modules.NOTIFICATION);
    await notifications.createNotifications({
      to: normalized,
      channel: "email",
      template: EmailTemplates.CAMPAIGN,
      data: {
        emailOptions: {
          replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
          subject: `[TEST] ${campaign.subject}`,
        },
        ...data,
      },
    });
  } catch (e: any) {
    // Most commonly: no email provider keys configured in this env.
    res.status(400).json({
      message: e?.message ?? "Could not send test mail (no provider?).",
    });
    return;
  }
  res.json({ sent: true });
};
