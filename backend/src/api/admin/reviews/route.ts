import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * PR-04 — Admin moderation queue. GET lists reviews (default pending first),
 * moderation actions live on POST /admin/reviews/:id.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const reviews = req.scope.resolve("review") as any;
  const take = Math.min(Number(req.query.take ?? 20), 100);
  const skip = Number(req.query.offset ?? 0);
  const status = (req.query.status as string) || undefined;

  const [rows, count] = await reviews.listAndCountReviews(
    status ? { status } : {},
    { take, skip, order: { created_at: "DESC" } }
  );
  res.json({ reviews: rows, count });
};
