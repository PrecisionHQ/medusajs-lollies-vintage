import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Admin Q&A queue (#11). GET lists questions (default open first),
 * answers/close/reopen live on POST /admin/questions/:id.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const questions = req.scope.resolve("question") as any;
  const take = Math.min(Number(req.query.take ?? 20), 100);
  const skip = Number(req.query.offset ?? 0);
  const status = (req.query.status as string) || undefined;

  const [rows, count] = await questions.listAndCountQuestions(
    status ? { status } : {},
    { take, skip, order: { created_at: "DESC" } }
  );
  res.json({ questions: rows, count });
};
