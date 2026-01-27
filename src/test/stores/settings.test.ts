import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = {
  settingsGetAll: vi.fn(),
  settingsSet: vi.fn(),
};

vi.mock("@/lib/api", () => ({ api: apiMock }));

describe("settingsStore", () => {
  beforeEach(() => {
    vi.resetModules();
    apiMock.settingsGetAll.mockReset();
    apiMock.settingsSet.mockReset();
    document.documentElement.className = "";
  });

  it("initializes once and applies theme", async () => {
    apiMock.settingsGetAll.mockResolvedValue({
      expiryDays: 7,
      trashRetentionDays: 30,
      theme: "light",
    });

    const { useSettingsStore } = await import("@/stores/settingsStore");
    await useSettingsStore.getState().init();

    expect(useSettingsStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    await useSettingsStore.getState().init();
    expect(apiMock.settingsGetAll).toHaveBeenCalledTimes(1);
  });

  it("switches themes and persists", async () => {
    apiMock.settingsGetAll.mockResolvedValue({
      expiryDays: 7,
      trashRetentionDays: 30,
      theme: "dark",
    });

    const { useSettingsStore } = await import("@/stores/settingsStore");
    await useSettingsStore.getState().init();

    await useSettingsStore.getState().setTheme("light");
    expect(apiMock.settingsSet).toHaveBeenCalledWith("theme", "light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    await useSettingsStore.getState().setTheme("dark");
    expect(apiMock.settingsSet).toHaveBeenCalledWith("theme", "dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("handles system theme", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener,
    });

    apiMock.settingsGetAll.mockResolvedValue({
      expiryDays: 7,
      trashRetentionDays: 30,
      theme: "system",
    });

    const { useSettingsStore } = await import("@/stores/settingsStore");
    await useSettingsStore.getState().init();

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(addEventListener).toHaveBeenCalled();

    await useSettingsStore.getState().setTheme("dark");
    expect(removeEventListener).toHaveBeenCalled();
  });

  it("attaches system theme listener when switching to system", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener,
      removeEventListener,
    });

    apiMock.settingsGetAll.mockResolvedValue({
      expiryDays: 7,
      trashRetentionDays: 30,
      theme: "dark",
    });

    const { useSettingsStore } = await import("@/stores/settingsStore");
    await useSettingsStore.getState().init();

    expect(addEventListener).not.toHaveBeenCalled();
    await useSettingsStore.getState().setTheme("system");
    expect(addEventListener).toHaveBeenCalled();

    await useSettingsStore.getState().setTheme("dark");
    expect(removeEventListener).toHaveBeenCalled();
  });

  it("applies dark system theme and updates on system changes", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    let listener: ((e: MediaQueryListEvent) => void) | null = null;

    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: (_event: string, next: (e: MediaQueryListEvent) => void) => {
        addEventListener();
        listener = next;
      },
      removeEventListener,
    });

    apiMock.settingsGetAll.mockResolvedValue({
      expiryDays: 7,
      trashRetentionDays: 30,
      theme: "system",
    });

    const { useSettingsStore } = await import("@/stores/settingsStore");
    await useSettingsStore.getState().init();

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(addEventListener).toHaveBeenCalled();

    if (!listener) throw new Error("Expected matchMedia change listener to be set");
    const fireChange = listener as unknown as (e: MediaQueryListEvent) => void;
    fireChange({ matches: false } as MediaQueryListEvent);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("persists expiry + trash settings", async () => {
    apiMock.settingsGetAll.mockResolvedValue({
      expiryDays: 7,
      trashRetentionDays: 30,
      theme: "dark",
    });

    const { useSettingsStore } = await import("@/stores/settingsStore");
    await useSettingsStore.getState().init();

    await useSettingsStore.getState().setExpiryDays(14);
    expect(apiMock.settingsSet).toHaveBeenCalledWith("expiry_days", "14");

    await useSettingsStore.getState().setTrashRetentionDays(60);
    expect(apiMock.settingsSet).toHaveBeenCalledWith("trash_retention_days", "60");
  });
});
