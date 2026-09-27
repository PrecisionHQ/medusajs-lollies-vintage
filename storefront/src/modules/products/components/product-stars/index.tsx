import { getProductReviews } from "@lib/data/reviews"

/**
 * PR-04 — Star summary. Server-rendered and cached with the reviews tag.
 * Renders nothing when there are no approved reviews (keeps PDPs clean
 * until moderation approves the first one).
 */
export default async function ProductStars({ productId }: { productId: string }) {
  const { count, average_rating } = await getProductReviews(productId)

  if (!count || average_rating == null) {
    return null
  }

  const full = Math.round(average_rating)
  return (
    <span className="text-small-regular text-ui-fg-subtle" aria-label={`${average_rating.toFixed(1)} out of 5 stars from ${count} reviews`}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)} ({count})
    </span>
  )
}
