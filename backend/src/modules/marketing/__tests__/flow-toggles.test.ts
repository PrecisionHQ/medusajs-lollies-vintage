import { describe, expect, it } from "vitest";
import { isFlowEnabled, TOGGLE_FLOWS } from "../flow-guards";

/**
 * Toggle-only flows (#5 board): every automated send beyond the four
 * delay-flows must be gateable and counted. The mapping is the single
 * source of truth shared by runners and the admin board — if a new
 * automated send appears without a board row, extend TOGGLE_FLOWS.
 */
const fakeMarketing = (rows: { enabled: boolean }[]) => ({
  listFlowConfigs: async () => rows,
});

describe("flow toggles", () => {
  it("covers price-drop, cross-sell and back-in-stock counters", () => {
    expect(TOGGLE_FLOWS.map((f) => f.key).sort()).toEqual([
      "back_in_stock",
      "cross_sell",
      "price_drop",
    ]);
    expect(TOGGLE_FLOWS.map((f) => f.flow).sort()).toEqual([
      "back-in-stock",
      "cross-sell",
      "pricedrop",
    ]);
  });

  it("defaults ON with no config row (historical behavior)", async () => {
    await expect(isFlowEnabled(fakeMarketing([]), "price_drop")).resolves.toBe(
      true
    );
  });

  it("honors an explicit OFF row", async () => {
    await expect(
      isFlowEnabled(fakeMarketing([{ enabled: false }]), "cross_sell")
    ).resolves.toBe(false);
    await expect(
      isFlowEnabled(fakeMarketing([{ enabled: true }]), "cross_sell")
    ).resolves.toBe(true);
  });

  it("fails open when the config read throws", async () => {
    const broken = {
      listFlowConfigs: async () => {
        throw new Error("db down");
      },
    };
    await expect(isFlowEnabled(broken, "back_in_stock")).resolves.toBe(true);
  });
});
