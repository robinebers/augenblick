import { describe, expect, it } from "vitest";
import { formatRelativeTime, formatRelativeTimeFromNow } from "@/lib/utils/time";

describe("formatRelativeTime", () => {
  it("formats seconds, minutes, hours, days", () => {
    const now = 1_000_000;
    expect(formatRelativeTime(now - 9_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 10_000, now)).toBe("10s ago");
    expect(formatRelativeTime(now - 59_000, now)).toBe("59s ago");
    expect(formatRelativeTime(now - 60_000, now)).toBe("1m ago");
    expect(formatRelativeTime(now - 3_600_000, now)).toBe("1h ago");
    expect(formatRelativeTime(now - 86_400_000, now)).toBe("1d ago");
  });

  it("clamps negative deltas to now", () => {
    const now = 5_000;
    expect(formatRelativeTime(now + 1_000, now)).toBe("just now");
  });
});

describe("formatRelativeTimeFromNow", () => {
  it("formats edge cases", () => {
    const now = 1_000_000;
    expect(formatRelativeTimeFromNow(now - 1_000, now)).toBe("now");
    expect(formatRelativeTimeFromNow(now + 1_000, now)).toBe("in a moment");
    expect(formatRelativeTimeFromNow(now + 10_000, now)).toBe("in 10s");
  });

  it("formats exact units without trailing zero", () => {
    const now = 1_000_000;
    expect(formatRelativeTimeFromNow(now + 60_000, now)).toBe("in 1m");
    expect(formatRelativeTimeFromNow(now + 3_600_000, now)).toBe("in 1h");
    expect(formatRelativeTimeFromNow(now + 86_400_000, now)).toBe("in 1d");
  });

  it("formats compound days + hours", () => {
    const now = 1_000_000;
    // 1d 1h = 25h = 90_000_000ms
    expect(formatRelativeTimeFromNow(now + 90_000_000, now)).toBe("in 1d 1h");
    // 2d 12h
    expect(formatRelativeTimeFromNow(now + 216_000_000, now)).toBe("in 2d 12h");
  });

  it("formats compound hours + minutes", () => {
    const now = 1_000_000;
    // 2h 3m = 7380s = 7_380_000ms
    expect(formatRelativeTimeFromNow(now + 7_380_000, now)).toBe("in 2h 3m");
    // 5h 30m
    expect(formatRelativeTimeFromNow(now + 19_800_000, now)).toBe("in 5h 30m");
  });

  it("formats compound minutes + seconds", () => {
    const now = 1_000_000;
    // 12m 34s = 754s = 754_000ms
    expect(formatRelativeTimeFromNow(now + 754_000, now)).toBe("in 12m 34s");
    // 1m 30s
    expect(formatRelativeTimeFromNow(now + 90_000, now)).toBe("in 1m 30s");
  });
});
