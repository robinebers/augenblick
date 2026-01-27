import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@/test/utils/render";

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

describe("ExpiryRing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders tooltip and status color", async () => {
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/ExpiryRing")).ExpiryRing, {
        lastInteraction: Date.now() - 30 * 60_000,
        expiryMinutes: 60,
      }),
    );

    const trigger = container.querySelector('[aria-label^="Trashed"]') as HTMLElement;
    expect(trigger.getAttribute("aria-label")).toBe("Trashed in 30m");

    const rings = container.querySelectorAll("circle");
    expect(rings.length).toBe(2);
    expect(rings[1]?.getAttribute("stroke")).toBe("var(--ring-green)");

    await unmount();
  });

  it("renders aging color", async () => {
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/ExpiryRing")).ExpiryRing, {
        lastInteraction: Date.now() - 40 * 60_000,
        expiryMinutes: 60,
      }),
    );

    const rings = container.querySelectorAll("circle");
    expect(rings[1]?.getAttribute("stroke")).toBe("var(--ring-yellow)");

    await unmount();
  });

  it("renders warning and danger colors", async () => {
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/ExpiryRing")).ExpiryRing, {
        lastInteraction: Date.now() - 50 * 60_000,
        expiryMinutes: 60,
      }),
    );

    const rings = container.querySelectorAll("circle");
    expect(rings[1]?.getAttribute("stroke")).toBe("var(--ring-orange)");

    await unmount();

    const next = await render(
      React.createElement((await import("@/features/sidebar/ExpiryRing")).ExpiryRing, {
        lastInteraction: Date.now() - 59 * 60_000,
        expiryMinutes: 60,
      }),
    );
    const rings2 = next.container.querySelectorAll("circle");
    expect(rings2[1]?.getAttribute("stroke")).toBe("var(--ring-red)");
    await next.unmount();
  });
});
