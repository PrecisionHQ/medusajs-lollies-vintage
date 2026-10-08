import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { verifyUnsubscribeToken } from "../../../../modules/marketing/utils";

/**
 * PR-02 — One-click marketing unsubscribe.
 *
 * Deliberately unauthenticated (the recipient has no account session when
 * clicking from an email). The HMAC token IS the authorization: it can only
 * have come from a link we emailed to this address. Invalid signatures get a
 * 400 and nothing is written.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { email, token } = (req.body ?? {}) as {
    email?: string;
    token?: string;
  };

  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized || !token || !verifyUnsubscribeToken(normalized, token)) {
    res.status(400).json({ message: "Invalid or expired unsubscribe link." });
    return;
  }

  const existing = await marketing.listMarketingOptOuts({ email: normalized });
  if (!existing.length) {
    await marketing.createMarketingOptOuts({
      email: normalized,
    });
  }

  // Newsletter consent lives on its own row: mark it unsubscribed too so the
  // address can never be mailed as "confirmed" again. The opt-out above keeps
  // the flows quiet regardless.
  const [sub] = (await marketing.listNewsletterSubscriptions({
    email: normalized,
  })) as any[];
  if (sub && sub.status !== "unsubscribed") {
    await marketing.updateNewsletterSubscriptions({
      id: sub.id,
      status: "unsubscribed",
    });
  }

  res.json({ unsubscribed: true });
};
