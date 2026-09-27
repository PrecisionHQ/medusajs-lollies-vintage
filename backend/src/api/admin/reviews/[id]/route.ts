import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * PR-04 — Moderate one review: POST { action: "approve" | "reject" }.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const reviews = req.scope.resolve("review") as any;
  const { action } = (req.body ?? {}) as { action?: string };

  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ message: 'action must be "approve" or "reject".' });
    return;
  }

  const [updated] = await reviews.updateReviews(
    { id: req.params.id },
    { status: action === "approve" ? "approved" : "rejected" }
  );
  res.json({ review: { id: updated.id, status: updated.status } });
};
