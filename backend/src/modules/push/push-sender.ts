/**
 * PWA phone app — Web Push fan-out.
 *
 * The `web-push` library is an optional runtime dependency (declared in
 * package.json so Railway installs it; local builds must NOT statically
 * import it or they break before `pnpm install`). It is loaded lazily via
 * `loadWebPush()` and injected as `WebPushClient` so unit tests can pass a
 * stub and never touch the network.
 *
 * Stale-subscription hygiene lives here, not in a janitor: any send that
 * the push service answers with 404/410 deletes that row immediately.
 */

import { createRequire } from "module";
import type { PushPayload } from "./validation";
import { isGoneStatus } from "./validation";

// The build compiles to CommonJS (where require exists natively); under
// ESM/Vitest fall back to createRequire. Either way the optional web-push
// package is resolved lazily at runtime, never statically imported.
declare const require: any | undefined;
function optionalRequire(name: string): any {
  try {
    if (typeof require !== "undefined") {
      return require(name);
    }
    return createRequire(process.cwd() + "/package.json")(name);
  } catch {
    return null;
  }
}

export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id?: string | null;
};

export type WebPushClient = {
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ): Promise<{ statusCode?: number } | unknown>;
};

export type PushSendResult = {
  sent: number;
  removed: number;
};

let cachedClient: WebPushClient | null | undefined;

function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

/**
 * Lazily require `web-push` (optional dep). Returns null when the package
 * is not installed or VAPID env is missing — callers treat that as
 * "push inert", never a 500.
 */
export function loadWebPush(): WebPushClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }
  cachedClient = null;
  try {
    if (!vapidConfigured()) {
      return cachedClient;
    }
    // createRequire (not a static import): the package is optional until
    // `pnpm install` runs, and a static import would break builds without it.
    const webpush = optionalRequire("web-push") as {
      setVapidDetails: (subject: string, pub: string, priv: string) => void;
      sendNotification: WebPushClient["sendNotification"];
    } | null;
    if (!webpush) {
      return cachedClient;
    }
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT as string,
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string
    );
    cachedClient = {
      sendNotification: (sub, payload) =>
        webpush.sendNotification(sub, payload),
    };
  } catch {
    cachedClient = null;
  }
  return cachedClient;
}

/** Test seam — resets the lazy cache between tests. */
export function _resetWebPushCache(): void {
  cachedClient = undefined;
}

export function buildPayload(payload: PushPayload): string {
  return JSON.stringify({
    title: payload.title.trim(),
    body: payload.body.trim(),
    ...(payload.url ? { url: payload.url } : {}),
  });
}

/**
 * Send one payload to many subscriptions. Gone (404/410) rows are deleted
 * via `pushService.deletePushSubscriptions({ id })`; other per-target
 * errors are swallowed so one bad row can't block the rest.
 */
export async function sendPushToTargets(
  pushService: {
    deletePushSubscriptions: (ids: string | string[]) => Promise<unknown>;
  },
  client: WebPushClient,
  targets: PushTarget[],
  payload: PushPayload
): Promise<PushSendResult> {
  const body = buildPayload(payload);
  let sent = 0;
  let removed = 0;
  for (const t of targets) {
    try {
      await client.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        body
      );
      sent += 1;
    } catch (err: unknown) {
      const status = (err as { statusCode?: unknown })?.statusCode;
      if (isGoneStatus(status)) {
        try {
          await pushService.deletePushSubscriptions(t.id);
          removed += 1;
        } catch {
          // Hygiene is best-effort; the next send retries the delete.
        }
      }
    }
  }
  return { sent, removed };
}

/**
 * Container-level fan-out used by API routes and subscribers. Resolves the
 * `push` module, filters by device when given, and no-ops (0/0) when push
 * is not configured rather than throwing.
 */
export async function notifyPushSubscribers(
  container: { resolve: (key: string) => any },
  payload: PushPayload,
  opts?: { device?: string; adminOnly?: boolean }
): Promise<PushSendResult> {
  const empty: PushSendResult = { sent: 0, removed: 0 };
  let pushService: any;
  try {
    pushService = container.resolve("push");
  } catch {
    return empty;
  }
  const client = loadWebPush();
  if (!client) {
    return empty;
  }
  let targets: PushTarget[] = [];
  try {
    targets = await pushService.listPushSubscriptions(
      opts?.device ? { device: opts.device } : {},
      { take: 2000 }
    );
  } catch {
    return empty;
  }
  if (!targets.length) {
    return empty;
  }
  // Moderation pings (question/review) are admin-only: unbound rows belong
  // to customer installs that must never see back-office activity. Manual
  // broadcasts omit the flag and reach every installed app.
  if (opts?.adminOnly) {
    targets = targets.filter((t) => t.user_id);
  }
  if (!targets.length) {
    return empty;
  }
  return sendPushToTargets(pushService, client, targets, payload);
}
