"use client"

import { useEffect, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  StoreReview,
  getProductReviews,
  submitReview,
  voteHelpful,
} from "@lib/data/reviews"
import { track } from "@lib/analytics/posthog"
import { trackPixel } from "@lib/analytics/pixels"

/**
 * PR-04 — Reviews tab content: approved list with helpful votes plus the
 * write form. Loads its own data (server action) because the tab shell is a
 * client component. Posting requires an account: unauthenticated submits get
 * a login link (the server action returns { error: "signin" }).
 */
export default function ReviewsTab({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<StoreReview[]>([])
  const [loaded, setLoaded] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "signin" | "failed">("idle")
  const [voted, setVoted] = useState<Set<string>>(new Set())

  useEffect(() => {
    getProductReviews(productId).then((res) => {
      setReviews(res.reviews)
      setLoaded(true)
    })
  }, [productId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("sending")
    const res = await submitReview(productId, { rating, title, body })
    setState(res.ok ? "sent" : res.error === "signin" ? "signin" : "failed")
    if (res.ok) {
      // P7 — strongest interest signal on the PDP.
      track("review_submitted", { product_id: productId, rating })
      trackPixel("review_submitted", { product_id: productId, rating })
      setTitle("")
      setBody("")
    }
  }

  const onHelpful = async (id: string) => {
    if (voted.has(id)) {
      return
    }
    const res = await voteHelpful(productId, id)
    if (res.ok) {
      // P7 — endorsement signal.
      track("review_vote", { product_id: productId, review_id: id })
      trackPixel("review_vote", { product_id: productId, review_id: id })
      setVoted(new Set(voted).add(id))
      setReviews(reviews.map((r) => (r.id === id ? { ...r, helpful_count: r.helpful_count + 1 } : r)))
    }
  }

  return (
    <div className="text-small-regular py-8 flex flex-col gap-y-8">
      <div className="flex flex-col gap-y-4">
        {!loaded ? (
          <p className="text-ui-fg-subtle">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-ui-fg-subtle">No reviews yet — yours could be the first.</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="border-b border-ui-border-base pb-4">
              <p className="font-semibold">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)} {r.title}
              </p>
              <p>{r.body}</p>
              <p className="text-ui-fg-subtle text-small-regular">
                {r.name} {r.verified ? "· verified purchase" : null} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
              <button
                className="text-ui-fg-muted underline mt-1 disabled:no-underline disabled:text-ui-fg-subtle"
                disabled={voted.has(r.id)}
                onClick={() => onHelpful(r.id)}
              >
                Helpful ({r.helpful_count})
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-ui-border-base pt-6">
        <h3 className="font-semibold mb-2">Write a review</h3>
        {state === "sent" ? (
          <p>Thanks — your review is awaiting moderation.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-y-3 max-w-md">
            <label className="flex flex-col gap-y-1">
              Rating
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="border border-ui-border-base rounded p-2">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-y-1">
              Title (optional)
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="border border-ui-border-base rounded p-2" maxLength={120} />
            </label>
            <label className="flex flex-col gap-y-1">
              Review
              <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} className="border border-ui-border-base rounded p-2" maxLength={2000} />
            </label>
            <button type="submit" disabled={state === "sending"} className="bg-ui-fg-base text-ui-fg-on-inverted rounded px-4 py-2 disabled:opacity-50">
              {state === "sending" ? "Sending…" : "Submit review"}
            </button>
            {state === "signin" ? (
              <p>
                <LocalizedClientLink href="/account" className="underline">
                  Sign in
                </LocalizedClientLink>{" "}
                to write a review.
              </p>
            ) : null}
            {state === "failed" ? <p>Sending failed — please try again.</p> : null}
          </form>
        )}
      </div>
    </div>
  )
}
