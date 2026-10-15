/**
 * Review-request candidacy rule, dependency-free so it is unit-testable
 * without the Medusa container (the workflow module pulls constants with
 * a path alias vitest cannot resolve).
 */

export type CandidateOrder = {
  fulfillments?: { delivered_at?: string | null; shipped_at?: string | null }[];
};

/**
 * Delivered-before-cutoff, with a shipped fallback for shops that never
 * mark delivered (manual provider, no tracking loop): when
 * shopMarksDelivered is false, shipped_at before the cutoff qualifies.
 */
export function isReviewCandidate(
  order: CandidateOrder,
  cutoffIso: string,
  shopMarksDelivered: boolean
): boolean {
  const stamp = (f?: {
    delivered_at?: string | null;
    shipped_at?: string | null;
  }) => (shopMarksDelivered ? f?.delivered_at : f?.delivered_at ?? f?.shipped_at);
  return (order.fulfillments ?? []).some((f) => {
    const at = stamp(f);
    return !!at && at < cutoffIso;
  });
}
