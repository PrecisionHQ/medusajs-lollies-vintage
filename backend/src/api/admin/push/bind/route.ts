import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Phone PWA — bind an installed endpoint to the logged-in admin user.
 *
 * The store subscribe route cannot trust a client-sent user_id, and an
 * admin JWT on a store route is not guaranteed to populate auth_context —
 * so the PWA calls this admin-authenticated route after subscribing.
 * Only bound rows receive moderation pings (question/review); unbound
 * rows get manual broadcasts only, so customer installs stay quiet.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { endpoint } = (req.body ?? {}) as { endpoint?: string };
  if (!endpoint?.trim()) {
    res.status(400).json({ message: "endpoint is required." });
    return;
  }
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    res.status(401).json({ message: "Sign in to bind this device." });
    return;
  }
  const push = req.scope.resolve("push") as any;
  const existing = await push.listPushSubscriptions({ endpoint: endpoint.trim() });
  if (!existing.length) {
    res.status(404).json({ message: "Subscribe this device first." });
    return;
  }
  await push.updatePushSubscriptions({ id: existing[0].id, user_id: actorId });
  res.json({ bound: true });
};
