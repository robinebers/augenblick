import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = {
  appStateSet: vi.fn(),
};

vi.mock("@/lib/api", () => ({ api: apiMock }));

describe("persistenceTimers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    apiMock.appStateSet.mockReset();
    apiMock.appStateSet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces app state writes", async () => {
    const { scheduleAppStateWrite } = await import("@/stores/notes/persistenceTimers");

    scheduleAppStateWrite(() => ({ sidebarWidth: 250, selectedId: "n1", viewMode: "notes" }));
    scheduleAppStateWrite(() => ({ sidebarWidth: 300, selectedId: "n2", viewMode: "trash" }));

    await vi.advanceTimersByTimeAsync(250);

    expect(apiMock.appStateSet).toHaveBeenCalledWith("sidebarWidth", "300");
    expect(apiMock.appStateSet).toHaveBeenCalledWith("selectedNoteId", "n2");
    expect(apiMock.appStateSet).toHaveBeenCalledWith("viewMode", "trash");
  });

  it("skips selectedNoteId write when no selected note", async () => {
    const { scheduleAppStateWrite } = await import("@/stores/notes/persistenceTimers");

    scheduleAppStateWrite(() => ({ sidebarWidth: 220, selectedId: null, viewMode: "notes" }));
    await vi.advanceTimersByTimeAsync(250);

    expect(apiMock.appStateSet).toHaveBeenCalledWith("sidebarWidth", "220");
    expect(apiMock.appStateSet).toHaveBeenCalledWith("viewMode", "notes");
    expect(apiMock.appStateSet).not.toHaveBeenCalledWith("selectedNoteId", expect.anything());
  });

  it("logs app state write failures", async () => {
    const { scheduleAppStateWrite } = await import("@/stores/notes/persistenceTimers");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    apiMock.appStateSet.mockRejectedValueOnce(new Error("boom"));

    scheduleAppStateWrite(() => ({ sidebarWidth: 220, selectedId: "n1", viewMode: "notes" }));
    await vi.advanceTimersByTimeAsync(250);

    expect(errorSpy).toHaveBeenCalledWith("App state write failed:", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("schedules and replaces draft save timers", async () => {
    const { scheduleDraftSave } = await import("@/stores/notes/persistenceTimers");

    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});

    scheduleDraftSave("n1", first, 500);
    scheduleDraftSave("n1", second, 500);
    await vi.advanceTimersByTimeAsync(500);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("clears pending draft save timer", async () => {
    const { clearDraftSaveTimer, scheduleDraftSave } = await import("@/stores/notes/persistenceTimers");

    const save = vi.fn(async () => {});
    scheduleDraftSave("n1", save, 500);
    clearDraftSaveTimer("n1");
    await vi.advanceTimersByTimeAsync(500);

    expect(save).not.toHaveBeenCalled();
  });
});

