import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Phone board push — admin inventory of installed app endpoints.
 * Counts + devices only; endpoints/keys never leave the server except to
 * the push service itself.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const push = req.scope.resolve("push") as any;
  const rows = await push.listPushSubscriptions({}, { take: 2000 });
  const byDevice: Record<string, number> = {};
  for (const r of rows as any[]) {
    const d = String(r.device ?? "phone");
    byDevice[d] = (byDevice[d] ?? 0) + 1;
  }
  res.json({ count: (rows as any[]).length, by_device: byDevice });
};
