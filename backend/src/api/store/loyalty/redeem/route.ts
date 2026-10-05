import { randomBytes } from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import type { IPromotionModuleService } from "@medusajs/framework/types";
import { getAccount, getSettings, liveBalance } from "../../../../modules/loyalty/helpers";

/**
 * PR-13 — Burn threshold points for a single-use fixed-value code.
 * The usage-budget campaign (limit 1) makes the code truly single-use.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to redeem points." });
    return;
  }
  const loyalty = req.scope.resolve("rewards") as any;
  const promotions: IPromotionModuleService = req.scope.resolve(
    Modules.PROMOTION
  );
  const settings = await getSettings(loyalty);
  const balance = await liveBalance(loyalty, customerId);
  if (balance < settings.burn_threshold) {
    res.status(400).json({
      message: `Need ${settings.burn_threshold} points to redeem (you have ${balance}).`,
    });
    return;
  }

  const code = `LOY-${randomBytes(4).toString("hex").toUpperCase()}`;
  await promotions.createPromotions({
    code,
    type: "standard",
    status: "active",
    is_automatic: false,
    campaign: {
      name: `Loyalty redemption ${code}`,
      campaign_identifier: `loy-${code.toLowerCase()}`,
      budget: { type: "usage", limit: 1 },
    },
    application_method: {
      type: "fixed",
      target_type: "order",
      allocation: "across",
      value: settings.burn_value_minor,
      currency_code: settings.burn_currency,
    },
  });

  await loyalty.createLoyaltyLedgers({
    customer_id: customerId,
    delta: -settings.burn_threshold,
    reason: "burn",
    order_id: null,
    expires_at: null,
  });
  const account = await getAccount(loyalty, customerId);
  await loyalty.updateLoyaltyAccounts(
    { id: account.id },
    { balance: Math.max(0, account.balance - settings.burn_threshold) }
  );
  res.status(201).json({ code });
};
