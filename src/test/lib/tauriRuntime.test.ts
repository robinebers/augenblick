import { beforeEach, describe, expect, it, vi } from "vitest";

const isTauri = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ isTauri }));

describe("tauri runtime", () => {
  beforeEach(() => {
    isTauri.mockReset();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("detects web shim", async () => {
    (window as Window & { __TAURI_INTERNALS__?: { __augenblick_web?: boolean } }).__TAURI_INTERNALS__ = {
      __augenblick_web: true,
    };

    const { isWebTauriShim, hasRealTauri } = await import("@/lib/tauri/runtime");
    isTauri.mockReturnValue(true);

    expect(isWebTauriShim()).toBe(true);
    expect(hasRealTauri()).toBe(false);
  });

  it("detects real tauri", async () => {
    const { isWebTauriShim, hasRealTauri } = await import("@/lib/tauri/runtime");
    isTauri.mockReturnValue(true);

    expect(isWebTauriShim()).toBe(false);
    expect(hasRealTauri()).toBe(true);
  });

  it("returns false when not tauri", async () => {
    const { hasRealTauri } = await import("@/lib/tauri/runtime");
    isTauri.mockReturnValue(false);
    expect(hasRealTauri()).toBe(false);
  });

  it("handles missing window", async () => {
    const originalWindow = (globalThis as unknown as { window?: Window }).window;
    (globalThis as unknown as { window?: Window }).window = undefined;

    const { isWebTauriShim, hasRealTauri } = await import("@/lib/tauri/runtime");
    isTauri.mockReturnValue(true);

    expect(isWebTauriShim()).toBe(false);
    expect(hasRealTauri()).toBe(false);

    (globalThis as unknown as { window?: Window }).window = originalWindow;
  });
});
