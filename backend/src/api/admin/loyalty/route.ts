import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { getSettings } from "../../../modules/loyalty/helpers";

/**
 * PR-13 — Loyalty rules admin API. GET returns settings + total outstanding
 * liability (sum of all balances — finance watches this). POST updates the
 * rules (earn rate, threshold, value, currency, expiry).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const loyalty = req.scope.resolve("rewards") as any;
  const settings = await getSettings(loyalty);
  const accounts = await loyalty.listLoyaltyAccounts({}, { take: 5000 });
  const outstanding = accounts.reduce(
    (acc: number, a: any) => acc + (a.balance ?? 0),
    0
  );
  res.json({ settings, accounts: accounts.length, outstanding_points: outstanding });
};

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const loyalty = req.scope.resolve("rewards") as any;
  const body = (req.body ?? {}) as {
    earn_per_major?: number;
    burn_threshold?: number;
    burn_value_minor?: number;
    burn_currency?: string;
    expiry_months?: number;
  };
  const update: Record<string, unknown> = {};
  for (const field of [
    "earn_per_major",
    "burn_threshold",
    "burn_value_minor",
    "expiry_months",
  ] as const) {
    if (typeof body[field] === "number" && body[field]! >= 0) {
      update[field] = Math.floor(body[field]!);
    }
  }
  if (typeof body.burn_currency === "string" && body.burn_currency.length === 3) {
    update.burn_currency = body.burn_currency.toLowerCase();
  }
  const settings = (await getSettings(loyalty)) as any;
  if (Object.keys(update).length) {
    await loyalty.updateLoyaltySettings({ id: settings.id, ...update });
  }
  const next = await getSettings(loyalty);
  void settings;
  res.json({ settings: next });
};
