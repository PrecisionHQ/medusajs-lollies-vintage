import { describe, expect, it } from "vitest";
import { cleanHandle, validateCommission, validateHandle } from "../validation";

describe("affiliate validation", () => {
  it("accepts clean handles", () => {
    expect(validateHandle("adaeze")).toBeNull();
    expect(validateHandle("adaeze_22-style")).toBeNull();
    expect(cleanHandle("  Adaeze ")).toBe("adaeze");
  });

  it("rejects bad handles", () => {
    expect(validateHandle("")).toMatch(/2-40/);
    expect(validateHandle("x")).toMatch(/2-40/);
    expect(validateHandle("has space")).toMatch(/lowercase/);
    expect(validateHandle("UPPER")).toBeNull();
    expect(validateHandle(undefined)).toMatch(/required/);
  });

  it("bounds commission 0-100", () => {
    expect(validateCommission(10)).toBeNull();
    expect(validateCommission(0)).toBeNull();
    expect(validateCommission(100)).toBeNull();
    expect(validateCommission(-1)).toMatch(/0-100/);
    expect(validateCommission(101)).toMatch(/0-100/);
    expect(validateCommission("10")).toMatch(/0-100/);
  });
});
