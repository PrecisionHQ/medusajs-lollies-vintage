import { describe, expect, it } from "vitest";
import { isReviewCandidate } from "../review-request-candidates";

const CUTOFF = "2026-10-01T00:00:00.000Z";
const OLD = "2026-09-20T00:00:00.000Z";
const NEW = "2026-10-10T00:00:00.000Z";

const base = {
  id: "order_1",
  email: "sam@example.com",
  display_id: 7,
  updated_at: OLD,
};

describe("review-request candidacy", () => {
  it("takes delivered-before-cutoff when the shop marks delivered", () => {
    expect(
      isReviewCandidate(
        { ...base, fulfillments: [{ delivered_at: OLD }] },
        CUTOFF,
        true
      )
    ).toBe(true);
    expect(
      isReviewCandidate(
        { ...base, fulfillments: [{ delivered_at: NEW }] },
        CUTOFF,
        true
      )
    ).toBe(false);
  });

  it("ignores shipped-only rows when the shop marks delivered", () => {
    expect(
      isReviewCandidate(
        { ...base, fulfillments: [{ shipped_at: OLD }] },
        CUTOFF,
        true
      )
    ).toBe(false);
  });

  it("falls back to shipped when delivered is never marked", () => {
    expect(
      isReviewCandidate(
        { ...base, fulfillments: [{ shipped_at: OLD }] },
        CUTOFF,
        false
      )
    ).toBe(true);
    expect(
      isReviewCandidate(
        { ...base, fulfillments: [{ shipped_at: NEW }] },
        CUTOFF,
        false
      )
    ).toBe(false);
  });

  it("rejects orders with no fulfillments", () => {
    expect(isReviewCandidate({ ...base }, CUTOFF, true)).toBe(false);
    expect(
      isReviewCandidate({ ...base, fulfillments: [] }, CUTOFF, false)
    ).toBe(false);
  });
});
