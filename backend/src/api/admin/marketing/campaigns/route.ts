import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * P2 — Campaign drafts (batch sending lands in P3).
 * GET lists newest-first; POST creates a draft.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;
  const campaigns = await marketing.listMarketingCampaigns(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  );
  res.json({ campaigns });
};

const required = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0;

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { subject, headline, body, cta_label, cta_href, product_handles } =
    (req.body ?? {}) as Record<string, unknown>;

  if (!required(subject) || !required(headline) || !required(body)) {
    res
      .status(400)
      .json({ message: "subject, headline and body are required." });
    return;
  }

  const createdRaw = await marketing.createMarketingCampaigns({
    subject: (subject as string).trim(),
    headline: (headline as string).trim(),
    body: body as string,
    cta_label: ((cta_label as string) || "").trim() || "Shop now",
    cta_href: ((cta_href as string) || "").trim() || "/",
    product_handles: ((product_handles as string) || "").trim(),
    status: "draft",
  });
  // Single-object input returns a single object (array only for array
  // input) — normalize instead of destructuring blindly.
  const created = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;
  res.status(201).json({ campaign: created });
};
