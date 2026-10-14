/**
 * PWA phone app — Web Push input validation + payload builder.
 *
 * Pure (no container, no network) so it is unit-testable. The sender
 * (push-sender.ts) imports these; API routes import the validator.
 */

export const PUSH_DEVICES = ["phone", "desktop"] as const;
export type PushDevice = (typeof PUSH_DEVICES)[number];

export type SubscriptionInput = {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  device?: string;
};

/** Null when valid, otherwise a human-readable reason (400 body). */
export function validateSubscriptionInput(
  body: SubscriptionInput
): string | null {
  const endpoint = body.endpoint?.trim() ?? "";
  if (!endpoint || !(endpoint.startsWith("https://") || endpoint.startsWith("http://"))) {
    return "endpoint must be an https URL from pushManager.subscribe().";
  }
  if (endpoint.length > 2000) {
    return "endpoint is too long.";
  }
  if (!body.p256dh || body.p256dh.length < 20 || body.p256dh.length > 500) {
    return "keys.p256dh is required.";
  }
  if (!body.auth || body.auth.length < 10 || body.auth.length > 500) {
    return "keys.auth is required.";
  }
  if (
    body.device !== undefined &&
    !(PUSH_DEVICES as readonly string[]).includes(body.device)
  ) {
    return `device must be one of: ${PUSH_DEVICES.join(", ")}.`;
  }
  return null;
}

export function normalizeDevice(device?: string): PushDevice {
  return (PUSH_DEVICES as readonly string[]).includes(device ?? "")
    ? (device as PushDevice)
    : "phone";
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/** Null when valid, otherwise a 400 reason for the admin send route. */
export function validatePushPayload(payload: PushPayload): string | null {
  if (!payload.title?.trim() || payload.title.length > 120) {
    return "title is required (max 120 chars).";
  }
  if (!payload.body?.trim() || payload.body.length > 500) {
    return "body is required (max 500 chars).";
  }
  if (payload.url !== undefined && payload.url.length > 2000) {
    return "url is too long.";
  }
  return null;
}

/** Push services report dead subscriptions as 404 or 410 — both mean delete. */
export function isGoneStatus(statusCode: unknown): boolean {
  return statusCode === 404 || statusCode === 410;
}
