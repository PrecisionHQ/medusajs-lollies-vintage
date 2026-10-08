import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

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
  res.json({ confirmed: true, email: row.email });
};
