import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * PR-04 — Store reviews for one product.
 *
 * GET /store/products/:id/reviews — approved reviews only, paginated.
 * POST — authenticated customers only (401 otherwise); creates a `pending`
 *   review. `verified` is set when the author has a delivered order containing
 *   the product (best-effort: any failure leaves verified=false rather than
 *   rejecting the review).
 */

const APPROVED = "approved";

async function isVerifiedPurchase(
  scope: any,
  customerId: string,
  productId: string
): Promise<boolean> {
  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders }: { data: { items?: { product_id?: string }[] }[] } =
      await query.graph({
        entity: "order",
        fields: ["items.product_id"],
        filters: { customer_id: customerId, fulfillment_status: "delivered" },
        pagination: { take: 50 },
      });
    return (orders ?? []).some((o) =>
      (o.items ?? []).some((i) => i.product_id === productId)
    );
  } catch {
    return false;
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const reviews = req.scope.resolve("review") as any;
  const productId = req.params.id as string;
  const take = Math.min(Number(req.query.take ?? 20), 100);
  const skip = Number(req.query.offset ?? 0);

  const [rows, count] = await reviews.listAndCountReviews(
    { product_id: productId, status: APPROVED },
    { take, skip, order: { created_at: "DESC" } }
  );
  const avg =
    count > 0
      ? rows.reduce((sum: number, r: any) => sum + r.rating, 0) / count
      : null;

  res.json({
    reviews: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verified: r.verified,
      helpful_count: r.helpful_count,
      created_at: r.created_at,
    })),
    count,
    average_rating: avg,
  });
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  if (!customerId) {
    res.status(401).json({ message: "Sign in to write a review." });
    return;
  }

  const { rating, title, body, name } = (req.body ?? {}) as {
    rating?: number;
    title?: string;
    body?: string;
    name?: string;
  };
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    res.status(400).json({ message: "rating must be an integer from 1 to 5." });
    return;
  }
  if (typeof body !== "string" || !body.trim()) {
    res.status(400).json({ message: "body is required." });
    return;
  }

  const productId = req.params.id as string;
  const customerModule = req.scope.resolve(Modules.CUSTOMER);
  const customer = await customerModule.retrieveCustomer(customerId);
  const displayName =
    name?.trim() ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email.split("@")[0];

  const reviews = req.scope.resolve("review") as any;
  const verified = await isVerifiedPurchase(req.scope, customerId, productId);
  const [created] = await reviews.createReviews({
    product_id: productId,
    customer_id: customerId,
    name: displayName,
    rating,
    title: title?.trim() || null,
    body: body.trim(),
    status: "pending",
    verified,
  });

  res.status(201).json({
    review: { id: created.id, status: created.status, verified },
  });
};
