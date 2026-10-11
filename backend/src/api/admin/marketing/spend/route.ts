import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Ads v1 — Manual ad-spend ledger (the cost side of ROAS; revenue lives in
 * PostHog broken down by utm_source/utm_campaign — see the PR body for the
 * Insight pairing). GET lists newest-first; POST creates; DELETE removes a
 * fat-fingered row.
 */
const required = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0;

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;
  const rows = await marketing.listMarketingAdSpends(
    {},
    { order: { spend_date: "DESC" }, take: 500 }
  );
  res.json({ spend: rows || [] });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { spend_date, source, campaign, amount, currency } = (req.body ??
    {}) as Record<string, unknown>;

  if (
    typeof spend_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(spend_date) ||
    !required(source)
  ) {
    res
      .status(400)
      .json({ message: "spend_date (YYYY-MM-DD) and source are required." });
    return;
  }
  const major = typeof amount === "number" ? amount : parseFloat(amount as string);
  if (!Number.isFinite(major) || major <= 0) {
    res.status(400).json({ message: "amount must be a positive number." });
    return;
  }

  const createdRaw = await marketing.createMarketingAdSpends({
    spend_date,
    source: (source as string).trim().toLowerCase(),
    campaign: required(campaign) ? (campaign as string).trim() : null,
    // Major-decimal form input -> integer minor units (EUR/GBP/USD).
    amount_minor: Math.round(major * 100),
    currency: (
      (typeof currency === "string" && currency.trim()) ||
      "eur"
    ).toLowerCase(),
  });
  const created = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;
  res.status(201).json({ spend: created });
};
