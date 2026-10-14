import { describe, expect, it, vi } from "vitest";
import orderPlacedPushHandler from "../order-placed-push";

const containerWithOrder = (order: any) => ({
  resolve: (key: string) => {
    if (key === "order") {
      return { retrieveOrder: vi.fn().mockResolvedValue(order) };
    }
    // No "push" module and no VAPID keys in test env: notifyPushSubscribers
    // resolves nothing and returns { sent: 0, removed: 0 }.
    throw new Error(`unresolvable: ${key}`);
  },
});

describe("order placed push", () => {
  it("pings without throwing when the order loads", async () => {
    const container = containerWithOrder({
      id: "order_1",
      total: 2590,
      currency_code: "eur",
      email: "sam@example.com",
      items: [{ quantity: 2 }],
    });
    await expect(
      orderPlacedPushHandler({ event: { data: { id: "order_1" } }, container } as any)
    ).resolves.toBeUndefined();
  });

  it("stays quiet when the order is gone", async () => {
    const container = {
      resolve: () => ({ retrieveOrder: vi.fn().mockResolvedValue(null) }),
    };
    await expect(
      orderPlacedPushHandler({ event: { data: { id: "order_x" } }, container } as any)
    ).resolves.toBeUndefined();
  });
});
