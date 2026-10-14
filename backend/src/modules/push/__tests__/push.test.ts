import { describe, expect, it, vi } from "vitest";
import {
  isGoneStatus,
  normalizeDevice,
  validatePushPayload,
  validateSubscriptionInput,
} from "../validation";
import {
  buildPayload,
  sendPushToTargets,
} from "../push-sender";

describe("push subscription validation", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    p256dh: "p256dh-key-material-long-enough-here",
    auth: "auth-secret-long-enough",
  };

  it("accepts a well-formed subscription", () => {
    expect(validateSubscriptionInput({ ...valid })).toBeNull();
    expect(
      validateSubscriptionInput({ ...valid, device: "desktop" })
    ).toBeNull();
  });

  it("accepts the flat keys shape via callers (p256dh/auth top-level)", () => {
    expect(
      validateSubscriptionInput({
        endpoint: valid.endpoint,
        p256dh: valid.p256dh,
        auth: valid.auth,
      })
    ).toBeNull();
  });

  it("rejects bad endpoints, missing keys, bad devices", () => {
    expect(validateSubscriptionInput({} as any)).toMatch(/endpoint/);
    expect(
      validateSubscriptionInput({ ...valid, endpoint: "not-a-url" })
    ).toMatch(/endpoint/);
    expect(
      validateSubscriptionInput({ ...valid, p256dh: "short" })
    ).toMatch(/p256dh/);
    expect(validateSubscriptionInput({ ...valid, auth: "" })).toMatch(/auth/);
    expect(validateSubscriptionInput({ ...valid, device: "watch" })).toMatch(
      /device/
    );
  });

  it("defaults unknown devices to phone", () => {
    expect(normalizeDevice(undefined)).toBe("phone");
    expect(normalizeDevice("desktop")).toBe("desktop");
    expect(normalizeDevice("watch")).toBe("phone");
  });
});

describe("push payload validation", () => {
  it("accepts title + body, rejects blanks and oversize", () => {
    expect(
      validatePushPayload({ title: "New question", body: "On Silk dress" })
    ).toBeNull();
    expect(validatePushPayload({ title: "", body: "x" })).toMatch(/title/);
    expect(validatePushPayload({ title: "t", body: "" })).toMatch(/body/);
    expect(
      validatePushPayload({ title: "t".repeat(121), body: "b" })
    ).toMatch(/title/);
  });

  it("serializes url only when present", () => {
    expect(JSON.parse(buildPayload({ title: "t", body: "b" }))).toEqual({
      title: "t",
      body: "b",
    });
    expect(
      JSON.parse(buildPayload({ title: "t", body: "b", url: "/app" })).url
    ).toBe("/app");
  });
});

describe("push fan-out hygiene", () => {
  it("treats 404/410 as gone, nothing else", () => {
    expect(isGoneStatus(410)).toBe(true);
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(500)).toBe(false);
    expect(isGoneStatus(undefined)).toBe(false);
  });

  it("deletes gone subscriptions, counts the rest as sent", async () => {
    const pushService = {
      deletePushSubscriptions: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      sendNotification: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ statusCode: 410 })
        .mockRejectedValueOnce({ statusCode: 500 }),
    };
    const targets = [
      { id: "a", endpoint: "https://x/1", p256dh: "k1-long-enough-material", auth: "a1-long-enough" },
      { id: "b", endpoint: "https://x/2", p256dh: "k2-long-enough-material", auth: "a2-long-enough" },
      { id: "c", endpoint: "https://x/3", p256dh: "k3-long-enough-material", auth: "a3-long-enough" },
    ];
    const result = await sendPushToTargets(pushService, client, targets, {
      title: "t",
      body: "b",
    });
    expect(result).toEqual({ sent: 1, removed: 1 });
    expect(pushService.deletePushSubscriptions).toHaveBeenCalledWith("b");
  });

  it("survives a failing delete without throwing", async () => {
    const pushService = {
      deletePushSubscriptions: vi.fn().mockRejectedValue(new Error("db down")),
    };
    const client = {
      sendNotification: vi.fn().mockRejectedValue({ statusCode: 404 }),
    };
    const result = await sendPushToTargets(
      pushService,
      client,
      [{ id: "z", endpoint: "https://x/z", p256dh: "k-long-enough-material", auth: "a-long-enough" }],
      { title: "t", body: "b" }
    );
    expect(result).toEqual({ sent: 0, removed: 0 });
  });
});
