import { describe, expect, it, vi } from "vitest";
import { heartbeat } from "../heartbeat";

const opsService = () => {
  const calls: { op: string; arg: unknown }[] = [];
  return {
    calls,
    service: {
      listOpsHeartbeats: vi.fn(async () => []),
      createOpsHeartbeats: vi.fn(async (arg: unknown) => {
        calls.push({ op: "create", arg });
      }),
      updateOpsHeartbeats: vi.fn(async (arg: unknown) => {
        calls.push({ op: "update", arg });
      }),
    } as any,
  };
};

describe("ops heartbeat", () => {
  it("creates the row on first ok", async () => {
    const { service, calls } = opsService();
    await heartbeat({ resolve: () => service }, "winback-daily", true);
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("create");
    expect((calls[0].arg as any).name).toBe("winback-daily");
    expect((calls[0].arg as any).last_error).toBeNull();
  });

  it("updates the row and truncates errors", async () => {
    const { service, calls } = opsService();
    service.listOpsHeartbeats = vi.fn(async () => [{ id: "hb_1" }]);
    await heartbeat({ resolve: () => service }, "winback-daily", false, new Error("x".repeat(500)));
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("update");
    expect(((calls[0].arg as any).last_error as string)).toHaveLength(280);
  });

  it("never throws when the module is missing", async () => {
    await expect(
      heartbeat(
        {
          resolve: () => {
            throw new Error("no ops module");
          },
        },
        "winback-daily",
        true
      )
    ).resolves.toBeUndefined();
  });
});
