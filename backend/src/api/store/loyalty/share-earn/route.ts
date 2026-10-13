import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  expiryDate,
  getAccount,
  getSettings,
  liveBalance,
} from "../../../../modules/loyalty/helpers";

/**
 * Share-to-earn (#13). An authenticated shopper earns a small points reward
 * for sharing a product (WhatsApp on the storefront). Dedupe without a
 * migration: order_id carries a `share:<product_id>` marker (never a real
 * order id — share rows are earn-like, never reversed by cancellations).
 * Guards: one earn per product ever, max SHARE_DAILY_CAP products per day.
 */
export const SHARE_POINTS = 10;
export const SHARE_DAILY_CAP = 5;

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to earn share credit." });
    return;
  }
  const { product_id } = (req.body ?? {}) as { product_id?: string };
  if (typeof product_id !== "string" || !product_id.trim()) {
    res.status(400).json({ message: "product_id is required." });
    return;
  }

  const loyalty = req.scope.resolve("rewards") as any;
  const marker = `share:${product_id.trim()}`;
  const existing = await loyalty.listLoyaltyLedgers({
    customer_id: customerId,
    reason: "share",
    order_id: marker,
  });
  if (existing.length) {
    const balance = await liveBalance(loyalty, customerId);
    res.json({ points: 0, balance, duplicate: true });
    return;
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [, today] = await loyalty.listAndCountLoyaltyLedgers({
    customer_id: customerId,
    reason: "share",
    created_at: { $gte: dayAgo },
  });
  if (today >= SHARE_DAILY_CAP) {
    res.status(429).json({ message: "daily share limit reached." });
    return;
  }

  const settings = await getSettings(loyalty);
  await loyalty.createLoyaltyLedgers({
    customer_id: customerId,
    delta: SHARE_POINTS,
    reason: "share",
    order_id: marker,
    expires_at: expiryDate(settings.expiry_months),
  });
  const account = await getAccount(loyalty, customerId);
  await loyalty.updateLoyaltyAccounts({
    id: account.id,
    balance: account.balance + SHARE_POINTS,
  });
  const balance = await liveBalance(loyalty, customerId);
  res.status(201).json({ points: SHARE_POINTS, balance });
};
