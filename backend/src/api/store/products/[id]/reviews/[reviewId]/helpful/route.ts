import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * PR-04 — "Helpful" votes. Unauthenticated on purpose (any shopper can vote);
 * increments are last-write-wins, which is fine for a counter.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const reviews = req.scope.resolve("review") as any;
  const reviewId = req.params.reviewId as string;

  const existing = await reviews.retrieveReview(reviewId);
  if (!existing || existing.status !== "approved") {
    res.status(404).json({ message: "Review not found." });
    return;
  }

  const updatedRaw = await reviews.updateReviews({
    id: reviewId,
    helpful_count: (existing.helpful_count ?? 0) + 1,
  });
  const updated = Array.isArray(updatedRaw) ? updatedRaw[0] : updatedRaw;
  res.json({ helpful_count: updated.helpful_count });
};
