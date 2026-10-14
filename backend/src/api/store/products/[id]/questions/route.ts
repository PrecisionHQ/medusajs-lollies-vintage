import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  overDailyCap,
  validateQuestionInput,
} from "../../../../../modules/questions/validation";

/**
 * Store product Q&A (#11). Guests may ask — pre-purchase shoppers often
 * have no account — so POST is unauthenticated. Spam guard: max 3 open
 * questions per email per product per day (cheap listAndCount, no extra
 * infra). GET returns answered questions only.
 */

const ANSWERED = "answered";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const questions = req.scope.resolve("question") as any;
  const productId = req.params.id as string;
  const take = Math.min(Number(req.query.take ?? 20), 100);
  const skip = Number(req.query.offset ?? 0);

  const [rows, count] = await questions.listAndCountQuestions(
    { product_id: productId, status: ANSWERED },
    { take, skip, order: { created_at: "DESC" } }
  );
  res.json({
    questions: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      question: r.question,
      answer: r.answer,
      created_at: r.created_at,
    })),
    count,
  });
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { name, email, question, locale } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    question?: string;
    locale?: string;
  };
  const invalid = validateQuestionInput({ name, email, question });
  if (invalid) {
    res.status(400).json({ message: invalid });
    return;
  }

  const productId = req.params.id as string;
  const questions = req.scope.resolve("question") as any;
  // validateQuestionInput above guarantees these shapes; the casts keep
  // narrowing local instead of re-validating inline.
  const cleanName = (name as string).trim();
  const cleanEmail = (email as string).trim().toLowerCase();
  const cleanQuestion = (question as string).trim();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [, recent] = await questions.listAndCountQuestions({
    product_id: productId,
    email: cleanEmail,
    created_at: { $gte: dayAgo },
  });
  if (overDailyCap(recent)) {
    res
      .status(429)
      .json({ message: "too many questions — please try again tomorrow." });
    return;
  }

  const customerId = (req as any).auth_context?.actor_id as string | undefined;
  // create* returns a single object for single input (an array only for
  // array input) — destructuring the object throws "not iterable".
  const createdRaw = await questions.createQuestions({
    product_id: productId,
    customer_id: customerId ?? null,
    name: cleanName,
    email: cleanEmail,
    question: cleanQuestion,
    status: "open",
    locale: typeof locale === "string" ? locale.slice(0, 12) : null,
  });
  const created = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;

  res.status(201).json({ question: { id: created.id, status: created.status } });
};
