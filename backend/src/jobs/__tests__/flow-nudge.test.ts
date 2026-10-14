import { describe, expect, it, vi } from "vitest";
import flowNudgeJob, { NUDGE_AFTER_DAYS } from "../flow-nudge";

const DAY = 24 * 3600 * 1000;

const containerWith = (configs: any[], resolvePush?: () => never) => {
  const resolves: string[] = [];
  return {
    resolves,
    container: {
      resolve: (key: string) => {
        resolves.push(key);
        if (key === "logger") return { info: vi.fn(), error: vi.fn() };
        if (key === "marketing") {
          return { listFlowConfigs: vi.fn().mockResolvedValue(configs) };
        }
        if (resolvePush) resolvePush();
        throw new Error(`unresolvable: ${key}`);
      },
    } as any,
  };
};

describe("flow nudge job", () => {
  it(`pings a flow disabled ${NUDGE_AFTER_DAYS}+ days ago (attempts push, never throws)`, async () => {
    const { container, resolves } = containerWith([
      {
        key: "winback",
        enabled: false,
        updated_at: new Date(Date.now() - (NUDGE_AFTER_DAYS + 0.5) * DAY).toISOString(),
      },
    ]);
    await expect(flowNudgeJob(container)).resolves.toBeUndefined();
    // Push attempted (no VAPID/keys in test env → quiet 0/0, no throw).
    expect(resolves).toContain("push");
  });

  it("stays quiet for recently-disabled and enabled flows", async () => {
    const { container, resolves } = containerWith([
      { key: "winback", enabled: false, updated_at: new Date(Date.now() - 5 * DAY).toISOString() },
      { key: "welcome", enabled: true, updated_at: new Date(Date.now() - 90 * DAY).toISOString() },
      { key: "old", enabled: false, updated_at: new Date(Date.now() - 400 * DAY).toISOString() },
    ]);
    await expect(flowNudgeJob(container)).resolves.toBeUndefined();
    expect(resolves).not.toContain("push");
  });
});
