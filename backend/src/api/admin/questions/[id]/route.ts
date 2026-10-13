import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Answer one question: POST { action: "answer" (needs answer text) |
 * "close" | "reopen" }. Answering flips status to answered, which is what
 * the storefront GET exposes.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const questions = req.scope.resolve("question") as any;
  const { action, answer } = (req.body ?? {}) as {
    action?: string;
    answer?: string;
  };

  let update: Record<string, unknown>;
  if (action === "answer") {
    if (typeof answer !== "string" || !answer.trim() || answer.length > 4000) {
      res.status(400).json({ message: "answer must be 1-4000 characters." });
      return;
    }
    update = { id: req.params.id, answer: answer.trim(), status: "answered" };
  } else if (action === "close") {
    update = { id: req.params.id, status: "closed" };
  } else if (action === "reopen") {
    update = { id: req.params.id, status: "open" };
  } else {
    res
      .status(400)
      .json({ message: 'action must be "answer", "close" or "reopen".' });
    return;
  }

  const updatedRaw = await questions.updateQuestions(update);
  const updated = Array.isArray(updatedRaw) ? updatedRaw[0] : updatedRaw;
  res.json({ question: { id: updated.id, status: updated.status } });
};
