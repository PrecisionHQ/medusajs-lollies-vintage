import { randomBytes } from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

/**
 * PR-06 — Stock alert subscriptions.
 *
 * POST /store/availability/subscribe { variant_id, email? } — email optional
 *   when signed in (falls back to the account email). Idempotent per
 *   variant × email: an existing pending subscription is returned as-is.
 * GET /store/availability/subscriptions — signed-in shopper's subscriptions
 *   (pending + notified) for the account page.
 * POST /store/availability/unsubscribe { id, token } — unauthenticated;
 *   the emailed random token is the authorization. Deletes the row.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const marketing = req.scope.resolve("marketing") as any;
  const { variant_id, email } = (req.body ?? {}) as {
    variant_id?: string;
    email?: string;
  };
  if (!variant_id) {
    res.status(400).json({ message: "variant_id is required." });
    return;
  }

  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  let resolvedEmail = (email ?? "").trim().toLowerCase();
  if (!resolvedEmail && customerId) {
    const customers = req.scope.resolve(Modules.CUSTOMER);
    const customer = await customers.retrieveCustomer(customerId);
    resolvedEmail = (customer.email ?? "").trim().toLowerCase();
  }
  if (!resolvedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(resolvedEmail)) {
    res.status(400).json({ message: "A valid email is required." });
    return;
  }

  const products = req.scope.resolve(Modules.PRODUCT);
  const variant = await products
    .retrieveProductVariant(variant_id)
    .catch(() => null);
  if (!variant) {
    res.status(404).json({ message: "Variant not found." });
    return;
  }

  const existing = await marketing.listStockSubscriptions({
    variant_id,
    email: resolvedEmail,
  });
  const pending = existing.find((s: any) => !s.notified_at);
  if (pending) {
    res.json({ subscription: { id: pending.id }, deduped: true });
    return;
  }

  const [created] = await marketing.createStockSubscriptions({
    variant_id,
    product_id: variant.product_id,
    email: resolvedEmail,
    customer_id: customerId ?? null,
    token: randomBytes(32).toString("hex"),
    notified_at: null,
  });
  res.status(201).json({ subscription: { id: created.id }, deduped: false });
};

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to view stock alerts." });
    return;
  }
  const marketing = req.scope.resolve("marketing") as any;
  const rows = await marketing.listStockSubscriptions(
    { customer_id: customerId },
    { take: 100, order: { created_at: "DESC" } }
  );
  res.json({
    subscriptions: rows.map((r: any) => ({
      id: r.id,
      variant_id: r.variant_id,
      product_id: r.product_id,
      email: r.email,
      notified: !!r.notified_at,
    })),
  });
};

/**
 * DELETE /store/availability/subscriptions { id } — signed-in shopper removes
 * their own pending alert. Ownership enforced via customer_id match.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to manage stock alerts." });
    return;
  }
  const marketing = req.scope.resolve("marketing") as any;
  const { id } = (req.body ?? {}) as { id?: string };
  const rows = await marketing.listStockSubscriptions({ id });
  const sub = rows[0] as any;
  if (!sub || sub.customer_id !== customerId) {
    res.status(404).json({ message: "Subscription not found." });
    return;
  }
  await marketing.deleteStockSubscriptions([id]);
  res.json({ deleted: true });
};
