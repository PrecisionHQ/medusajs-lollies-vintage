import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { EmailTemplates } from "../../../../modules/email-notifications/templates";
import { RESEND_FROM_EMAIL, STOREFRONT_URL } from "../../../../lib/constants";
import { buildUnsubscribeLink } from "../../../../modules/marketing/utils";
import {
  alreadySent,
  claimSend,
  isOptedOut,
} from "../../../../modules/marketing/flow-guards";

/**
 * One-click newsletter confirmation (double opt-in).
 *
 * POST /store/newsletter/confirm { token } — unauthenticated; the random
 * emailed token is the authorization. Idempotent: re-clicks on an already
 * confirmed address answer confirmed without writing. Unknown tokens get a
 * 404 and nothing is written.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { token } = (req.body ?? {}) as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ message: "token is required." });
    return;
  }

  const [row] = (await marketing.listNewsletterSubscriptions({
    confirm_token: token,
  })) as any[];
  if (!row) {
    res.status(404).json({ message: "Invalid confirmation link." });
    return;
  }
  if (row.status !== "confirmed") {
    await marketing.updateNewsletterSubscriptions({
      id: row.id,
      status: "confirmed",
      confirmed_at: new Date(),
    });
  }

  // P9 handoff: a confirmed subscriber gets the welcome mail once (same
  // public WELCOME10 incentive as signup). The customer.created welcome
  // checks the same claim, so a later signup never double-sends.
  const email = (row.email || "").trim().toLowerCase();
  if (
    email &&
    !(await isOptedOut(marketing, email)) &&
    !(await alreadySent(marketing, "welcome", `newsletter:${email}`))
  ) {
    await claimSend(marketing, "welcome", `newsletter:${email}`, email);
    try {
      const notifications = req.scope.resolve(Modules.NOTIFICATION);
      const base = STOREFRONT_URL.replace(/\/$/, "");
      await notifications.createNotifications({
        to: email,
        channel: "email",
        template: EmailTemplates.WELCOME,
        data: {
          emailOptions: {
            replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
            subject: "Welcome — here’s 10% off your first order",
          },
          name: null,
          incentiveCode: "WELCOME10",
          shopLink: base,
          unsubscribeLink: buildUnsubscribeLink(email),
          preview: "Welcome in",
        },
      });
    } catch {
      // Welcome is a bonus on top of confirmation — never fail the request.
    }
  }
  res.json({ confirmed: true, email: row.email });
};
