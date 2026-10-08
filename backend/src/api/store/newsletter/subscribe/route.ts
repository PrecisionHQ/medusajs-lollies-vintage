import { randomBytes } from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { EmailTemplates } from "../../../../modules/email-notifications/templates";
import { buildNewsletterConfirmLink } from "../../../../modules/marketing/utils";
import { RESEND_FROM_EMAIL, STOREFRONT_URL } from "../../../../lib/constants";

/**
 * Owned newsletter subscribe. Replaces the Modave theme's external Brevo
 * post: addresses stay in our database (double opt-in) instead of flowing
 * to an unidentified third party.
 *
 * POST /store/newsletter/subscribe { email, source? } — source is footer |
 * popup, anything else stored as null. Idempotent per email: an existing
 * pending row re-sends the confirm mail, an already-confirmed address
 * answers the same generic ok (no existence oracle). Unauthenticated;
 * the emailed confirm link is the authorization.
 *
 * The confirm mail is best-effort: with stub Resend keys the send fails and
 * is logged while the pending row is kept, so enabling keys later needs no
 * data repair — the next subscribe (or a resend) delivers it.
 */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { email, source } = (req.body ?? {}) as {
    email?: string;
    source?: string;
  };
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized || !EMAIL_RE.test(normalized)) {
    res.status(400).json({ message: "A valid email is required." });
    return;
  }
  const origin = source === "footer" || source === "popup" ? source : null;

  let row = (
    await marketing.listNewsletterSubscriptions({ email: normalized })
  )[0] as any;
  if (!row) {
    row = await marketing.createNewsletterSubscriptions({
      email: normalized,
      status: "pending",
      source: origin,
      confirm_token: randomBytes(32).toString("hex"),
      confirmed_at: null,
    });
  } else if (row.status !== "confirmed" && !row.confirm_token) {
    row = await marketing.updateNewsletterSubscriptions({
      id: row.id,
      confirm_token: randomBytes(32).toString("hex"),
    });
  }

  if (row.status !== "confirmed" && row.confirm_token) {
    try {
      const notifications = req.scope.resolve(Modules.NOTIFICATION);
      await notifications.createNotifications({
        to: normalized,
        channel: "email",
        template: EmailTemplates.NEWSLETTER_CONFIRM,
        data: {
          emailOptions: {
            replyTo: process.env.ORDER_REPLY_TO_EMAIL || RESEND_FROM_EMAIL,
            subject: "Confirm your subscription",
          },
          confirmLink: buildNewsletterConfirmLink(row.confirm_token),
          shopLink: STOREFRONT_URL.replace(/\/$/, ""),
        },
      });
    } catch (error) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
      logger.warn(
        `newsletter confirm mail to ${normalized} failed (keys stubbed?): ${
          (error as Error).message
        } — subscription kept pending.`
      );
    }
  }

  res.json({ ok: true });
};
