import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { validatePushPayload } from "../../../../modules/push/validation";
import { notifyPushSubscribers } from "../../../../modules/push/push-sender";

/**
 * Phone board push — admin broadcast / test send.
 * Body: { title, body, url?, device? }. device filters ("phone" |
 * "desktop"); omitted targets every installed app. Never throws when push
 * is unconfigured — returns { sent: 0, removed: 0, configured: false }.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { title, body, url, device } = (req.body ?? {}) as {
    title?: string;
    body?: string;
    url?: string;
    device?: string;
  };
  const invalid = validatePushPayload({ title: title ?? "", body: body ?? "", url });
  if (invalid) {
    res.status(400).json({ message: invalid });
    return;
  }
  if (
    device !== undefined &&
    device !== "phone" &&
    device !== "desktop"
  ) {
    res.status(400).json({ message: 'device must be "phone" or "desktop".' });
    return;
  }
  const result = await notifyPushSubscribers(
    req.scope,
    { title: title as string, body: body as string, url },
    device ? { device } : undefined
  );
  res.json({
    ...result,
    configured: Boolean(
      process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ),
  });
};
