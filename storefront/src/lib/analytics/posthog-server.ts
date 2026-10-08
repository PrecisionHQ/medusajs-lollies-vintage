import "server-only"

import { PostHog } from "posthog-node"
import { cookies } from "next/headers"

/**
 * PR-1 (Phase 1) — server-side PostHog identity for guest-intelligence
 * stitching ("guest viewed 5 products then bought" becomes answerable).
 *
 * Why server-side: the auth JWT lives in an httpOnly cookie, so client code
 * can never read actor_id; these helpers run inside the login/signup/checkout
 * server actions instead. Mirrors the backend's order-placed-analytics
 * pattern (own client per call, shutdown in finally).
 *
 * PostHog auto-aliasing is a posthog-JS behaviour — server-side every link
 * must be explicit, hence identify + alias as separate calls. All three are
 * consent-gated (the lollies_consent cookie, read explicitly — there is no
 * ambient gate server-side) and key-gated; anything missing or failing is a
 * silent no-op. Analytics must never break shopping or checkout.
 */

const CONSENT_COOKIE = "lollies_consent"
const AUTH_COOKIE = "_medusa_jwt"

// Same public key the client uses (it ships in the bundle anyway), so no
// extra Railway variable is needed — it is readable server-side as-is.
function keyIsReal(): boolean {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ""
  return key.startsWith("phc_") && !key.includes("STUB")
}

async function analyticsReady(): Promise<boolean> {
  if (!keyIsReal()) {
    return false
  }
  try {
    return (await cookies()).get(CONSENT_COOKIE)?.value === "accepted"
  } catch {
    return false
  }
}

function newClient(): PostHog | null {
  try {
    return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
    })
  } catch {
    return null
  }
}

export function normalizeEmail(email: unknown): string | null {
  const value =
    typeof email === "string" ? email.trim().toLowerCase() : ""
  return value || null
}

/** actor_id claim from a Medusa auth JWT (ASCII `cus_*`; decode-only, the
 * backend issued it moments ago — no verification needed client-of-trust). */
export function actorIdFromJwt(token: unknown): string | null {
  try {
    if (typeof token !== "string") {
      return null
    }
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    )
    return typeof payload?.actor_id === "string" && payload.actor_id
      ? payload.actor_id
      : null
  } catch {
    return null
  }
}

/** Whether the request carries a signed-in session (login hook owns identity
 * then; guest hooks must stay out to avoid forking a second person). */
export async function hasSession(): Promise<boolean> {
  try {
    return Boolean((await cookies()).get(AUTH_COOKIE)?.value)
  } catch {
    return false
  }
}

/**
 * The anonymous PostHog id from the client cookie (posthog-js default name).
 * Absent/unparseable → null: alias is skipped, identify still stitches
 * forward (future events join; only past anonymous history stays unlinked).
 */
export async function anonymousId(): Promise<string | null> {
  try {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ""
    const raw = (await cookies()).get(`ph_${key}_posthog`)?.value
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(decodeURIComponent(raw))
    return typeof parsed?.distinct_id === "string"
      ? parsed.distinct_id
      : null
  } catch {
    return null
  }
}

/** Create-or-touch the person for this id. Past anonymous history joins via
 * aliasServerUser, not here. */
export async function identifyServerUser(
  distinctId: string
): Promise<void> {
  if (!distinctId || !(await analyticsReady())) {
    return
  }
  let client: PostHog | null = null
  try {
    client = newClient()
    await client?.identify({ distinctId })
  } catch {
    // Analytics must never break shopping.
  } finally {
    try {
      await client?.shutdown()
    } catch {
      // Ignore flush errors on shutdown.
    }
  }
}

/** Permanently merge `alias` into the `distinctId` person. Idempotent and
 * harmless when the alias was never seen (recorded for future events). */
export async function aliasServerUser(
  distinctId: string,
  alias: string
): Promise<void> {
  if (
    !distinctId ||
    !alias ||
    alias === distinctId ||
    !(await analyticsReady())
  ) {
    return
  }
  let client: PostHog | null = null
  try {
    client = newClient()
    await client?.alias({ distinctId, alias })
  } catch {
    // Analytics must never break shopping.
  } finally {
    try {
      await client?.shutdown()
    } catch {
      // Ignore flush errors on shutdown.
    }
  }
}
