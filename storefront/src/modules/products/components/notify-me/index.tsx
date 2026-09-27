"use client"

import { useState } from "react"

import { subscribeStock } from "@lib/data/availability"

/**
 * PR-06 — "Notify me" form, rendered in place of Add to cart when the
 * selected variant is out of stock. Email-only (works for guests); signed-in
 * shoppers can leave it blank to use their account email.
 */
export default function NotifyMe({ variantId }: { variantId: string }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("sending")
    const res = await subscribeStock(variantId, email)
    setState(res.ok ? "sent" : "failed")
  }

  if (state === "sent") {
    return (
      <p className="text-small-regular">
        You&apos;re on the list — we&apos;ll email you the moment it&apos;s back.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-y-2">
      <p className="text-small-regular text-ui-fg-subtle">
        Out of stock — leave your email and we&apos;ll tell you when it returns.
      </p>
      <div className="flex gap-x-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="border border-ui-border-base rounded px-3 py-2 flex-1 text-small-regular"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="bg-ui-fg-base text-ui-fg-on-inverted rounded px-4 py-2 disabled:opacity-50"
        >
          {state === "sending" ? "…" : "Notify me"}
        </button>
      </div>
      {state === "failed" ? <p>Something went wrong — please try again.</p> : null}
    </form>
  )
}
