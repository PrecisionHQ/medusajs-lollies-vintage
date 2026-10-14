import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  normalizeDevice,
  validateSubscriptionInput,
} from "../../../../modules/push/validation";

/**
 * PWA phone app — store subscription endpoints (no auth: the installed PWA
 * on a shop phone has no customer session; the payload is just the
 * push-service credentials from pushManager.subscribe()).
 *
 * POST upserts by endpoint (re-installs / key rotations reuse the row).
 * DELETE removes one endpoint. Bodies accept both `{ endpoint,
 * keys: { p256dh, auth } }` (Web Push JS shape) and flat `{ endpoint,
 * p256dh, auth }`.
 */

type Body = {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  keys?: { p256dh?: string; auth?: string };
  device?: string;
  user_id?: string;
};

function flatten(body: Body) {
  return {
    endpoint: body.endpoint,
    p256dh: body.p256dh ?? body.keys?.p256dh,
    auth: body.auth ?? body.keys?.auth,
    device: body.device,
  };
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const flat = flatten((req.body ?? {}) as Body);
  const invalid = validateSubscriptionInput(flat);
  if (invalid) {
    res.status(400).json({ message: invalid });
    return;
  }
  const push = req.scope.resolve("push") as any;
  const endpoint = (flat.endpoint as string).trim();
  const existing = await push.listPushSubscriptions({ endpoint });
  if (existing.length) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    const updated = await push.updatePushSubscriptions({
      id: existing[0].id,
      p256dh: flat.p256dh,
      auth: flat.auth,
      device: normalizeDevice(flat.device),
      ...(actorId ? { user_id: actorId } : {}),
    });
    res.status(200).json({ subscription: { id: updated.id } });
    return;
  }
  const createdRaw = await push.createPushSubscriptions({
    endpoint,
    p256dh: flat.p256dh,
    auth: flat.auth,
    device: normalizeDevice(flat.device),
    // Admin installs bind on login (PWA shell passes the session through);
    // bound rows receive moderation pings, unbound rows only broadcasts.
    user_id: ((req as any).auth_context?.actor_id as string | undefined) ?? null,
  });
  const created = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;
  res.status(201).json({ subscription: { id: created.id } });
};

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { endpoint } = (req.body ?? {}) as { endpoint?: string };
  if (!endpoint?.trim()) {
    res.status(400).json({ message: "endpoint is required." });
    return;
  }
  const push = req.scope.resolve("push") as any;
  const existing = await push.listPushSubscriptions({ endpoint: endpoint.trim() });
  if (existing.length) {
    await push.deletePushSubscriptions(existing.map((s: any) => s.id));
  }
  res.status(200).json({ deleted: existing.length ? true : false });
};
