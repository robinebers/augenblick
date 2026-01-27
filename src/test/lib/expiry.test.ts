import { describe, expect, it } from "vitest";
import { expiryProgress, expiryStatus } from "@/lib/utils/expiry";

describe("expiryProgress", () => {
  it("computes progress with minute granularity", () => {
    const now = 1_000_000;
    const last = now - 30 * 60_000;
    expect(expiryProgress(last, 60, now)).toBeCloseTo(0.5, 5);
  });

  it("clamps to [0,1]", () => {
    const now = 1_000_000;
    expect(expiryProgress(now, 60, now)).toBe(1);
    expect(expiryProgress(now - 120 * 60_000, 60, now)).toBe(0);
    expect(expiryProgress(now, Number.NaN, now)).toBe(0);
  });
});

describe("expiryStatus", () => {
  it("maps thresholds", () => {
    expect(expiryStatus(1)).toBe("fresh");
    expect(expiryStatus(0.5)).toBe("fresh");
    expect(expiryStatus(0.49)).toBe("aging");
    expect(expiryStatus(0.25)).toBe("aging");
    expect(expiryStatus(0.24)).toBe("warning");
    expect(expiryStatus(0.1)).toBe("warning");
    expect(expiryStatus(0.09)).toBe("danger");
  });
});
