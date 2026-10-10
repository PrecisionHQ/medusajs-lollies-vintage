import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { render } from "@react-email/render";
import {
  EmailTemplates,
  generateEmailTemplate,
} from "../../../../../../modules/email-notifications/templates";
import { buildCampaignEmailData } from "../../../../../../modules/marketing/campaign-email";

/**
 * P2 — Render a draft campaign to HTML for the composer preview
 * (returned as a string; the admin page shows it in an iframe).
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params as { id?: string };
  if (!id) {
    res.status(400).json({ message: "campaign id is required." });
    return;
  }

  const marketing = req.scope.resolve("marketing") as any;
  const rows = await marketing.listMarketingCampaigns({ id });
  const campaign = rows?.[0];
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found." });
    return;
  }

  try {
    const data = await buildCampaignEmailData(req.scope, campaign, {
      email: "preview@example.com",
      preview: true,
    });
    const node = generateEmailTemplate(EmailTemplates.CAMPAIGN, data);
    const html = await render(node as any);
    res.json({ html });
  } catch (e: any) {
    res
      .status(400)
      .json({ message: e?.message ?? "Could not render preview." });
  }
};
