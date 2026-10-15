import { describe, expect, it, vi } from "vitest";
import { buildAttention } from "../attention";
import opsDigestJob from "../../../jobs/ops-digest";

const scopeWith = (impls: Record<string, any>) => ({
  resolve: (key: string) => {
    if (key === "query") {
      return {
        graph: vi.fn(async () => ({ data: [] })),
      };
    }
    if (impls[key]) return impls[key];
    throw new Error(`unresolvable: ${key}`);
  },
});

describe("attention builder", () => {
  it("orders critical first and drops empty sections", async () => {
    const scope = scopeWith({
      order: {
        listOrders: vi.fn(async () => [
          {
            id: "order_9",
            display_id: 9,
            email: "sam@example.com",
            status: "pending",
            fulfillment_status: "not_fulfilled",
            created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
          },
        ]),
      },
      marketing: {
        listFlowConfigs: vi.fn(async () => []),
        listMarketingCampaigns: vi.fn(async () => []),
        listStockSubscriptions: vi.fn(async () => []),
      },
      ops: { listOpsHeartbeats: vi.fn(async () => []) },
      question: { listAndCountQuestions: vi.fn(async () => [[], 0]) },
      review: { listAndCountReviews: vi.fn(async () => [[], 0]) },
    });
    const sections = await buildAttention(scope as any);
    expect(sections[0].key).toBe("sla");
    expect(sections[0].count).toBe(1);
    expect(sections.every((s) => s.count > 0)).toBe(true);
  });

  it("marks dead sources degraded instead of throwing", async () => {
    const scope = {
      resolve: () => {
        throw new Error("everything down");
      },
    };
    const sections = await buildAttention(scope as any);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((s) => s.degraded)).toBe(true);
  });
});

describe("ops digest job", () => {
  it("stays silent on a clear day and never throws", async () => {
    const notified: string[] = [];
    const scope = scopeWith({
      order: { listOrders: vi.fn(async () => []) },
      marketing: {
        listFlowConfigs: vi.fn(async () => []),
        listMarketingCampaigns: vi.fn(async () => []),
        listStockSubscriptions: vi.fn(async () => []),
      },
      ops: {
        listOpsHeartbeats: vi.fn(async () => []),
        createOpsHeartbeats: vi.fn(async () => {
          notified.push("heartbeat");
        }),
      },
      question: { listAndCountQuestions: vi.fn(async () => [[], 0]) },
      review: { listAndCountReviews: vi.fn(async () => [[], 0]) },
      logger: { info: vi.fn(), error: vi.fn() },
    });
    // No "push" module resolvable and no VAPID: notify resolves to silence.
    await expect(opsDigestJob(scope as any)).resolves.toBeUndefined();
    expect(notified).toContain("heartbeat");
  });
});
