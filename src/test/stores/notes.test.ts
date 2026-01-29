import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteMeta } from "@/lib/types";

const apiMock = {
  notesList: vi.fn(),
  noteCreate: vi.fn(),
  noteGet: vi.fn(),
  noteSetActive: vi.fn(),
  noteWriteDraft: vi.fn(),
  noteSave: vi.fn(),
  noteSaveAs: vi.fn(),
  noteImportFile: vi.fn(),
  noteTrash: vi.fn(),
  noteRestore: vi.fn(),
  noteDeleteForever: vi.fn(),
  notePin: vi.fn(),
  notesReorder: vi.fn(),
  settingsGetAll: vi.fn(),
  settingsSet: vi.fn(),
  appStateGetAll: vi.fn(),
  appStateSet: vi.fn(),
  expiryRunNow: vi.fn(),
};

vi.mock("@/lib/api", () => ({ api: apiMock }));

function meta(overrides: Partial<NoteMeta>): NoteMeta {
  return {
    id: "id",
    title: "New Note",
    preview: "",
    filePath: "/tmp/id.md",
    storage: "draft",
    isPinned: false,
    isTrashed: false,
    sortOrder: 1,
    createdAt: 1,
    lastInteraction: 1,
    trashedAt: null,
    ...overrides,
  };
}

describe("notesStore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    Object.values(apiMock).forEach((fn) => fn.mockReset());
    apiMock.noteSetActive.mockResolvedValue(undefined);
    apiMock.appStateSet.mockResolvedValue(undefined);
    apiMock.expiryRunNow.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes list + app state and selects if present", async () => {
    const n1 = meta({ id: "n1", storage: "draft", sortOrder: 1 });

    apiMock.notesList.mockResolvedValue({ active: [n1], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({
      sidebarWidth: "300",
      viewMode: "notes",
      selectedNoteId: "n1",
    });
    apiMock.noteGet.mockResolvedValue({ meta: n1, content: "hello" });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    const state = useNotesStore.getState();
    expect(state.sidebarWidth).toBe(300);
    expect(state.selectedId).toBe("n1");
    expect(state.contentById.n1).toBe("hello");
    expect(apiMock.noteSetActive).toHaveBeenCalledWith("n1");
    expect(apiMock.expiryRunNow).toHaveBeenCalled();
    expect(apiMock.expiryRunNow.mock.invocationCallOrder[0]).toBeLessThan(
      apiMock.notesList.mock.invocationCallOrder[0],
    );
  });

  it("clears selectedId when missing from list", async () => {
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({ selectedNoteId: "missing" });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    expect(useNotesStore.getState().selectedId).toBeNull();
  });

  it("runs expiry sweep and refreshes list", async () => {
    const n1 = meta({ id: "n1", storage: "draft", sortOrder: 1 });

    apiMock.notesList.mockResolvedValue({ active: [n1], trashed: [] });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().runExpirySweep();

    expect(apiMock.expiryRunNow).toHaveBeenCalledTimes(1);
    expect(apiMock.notesList).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().list.active.map((n) => n.id)).toEqual(["n1"]);
  });

  it("cleans local state when expiry removes notes", async () => {
    const n1 = meta({ id: "n1", storage: "saved", sortOrder: 1 });

    apiMock.notesList
      .mockResolvedValueOnce({ active: [n1], trashed: [] })
      .mockResolvedValueOnce({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().updateContent("n1", "changed");
    expect(useNotesStore.getState().dirtySavedById).toEqual({ n1: true });

    await useNotesStore.getState().runExpirySweep();

    expect(useNotesStore.getState().contentById.n1).toBeUndefined();
    expect(useNotesStore.getState().dirtySavedById).toEqual({});
  });

  it("creates draft note, writes app state, and debounces draft autosave", async () => {
    const created = meta({ id: "d1", storage: "draft", sortOrder: 1 });
    const updated = meta({
      id: "d1",
      storage: "draft",
      title: "Hello",
      preview: "World",
      sortOrder: 1,
    });

    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteCreate.mockResolvedValue(created);
    apiMock.noteWriteDraft.mockResolvedValue(updated);

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();
    await useNotesStore.getState().createNote();

    expect(useNotesStore.getState().selectedId).toBe("d1");

    await vi.advanceTimersByTimeAsync(250);
    expect(apiMock.appStateSet).toHaveBeenCalledWith("viewMode", "notes");
    expect(apiMock.appStateSet).toHaveBeenCalledWith("selectedNoteId", "d1");

    useNotesStore.getState().updateContent("d1", "Hello\nWorld");
    await vi.advanceTimersByTimeAsync(500);

    expect(apiMock.noteWriteDraft).toHaveBeenCalledWith("d1", "Hello\nWorld");
    expect(useNotesStore.getState().list.active.find((n) => n.id === "d1")?.title).toBe("Hello");
  });

  it("auto-saves drafts independently per note", async () => {
    const d1 = meta({ id: "d1", storage: "draft" });
    const d2 = meta({ id: "d2", storage: "draft" });

    apiMock.notesList.mockResolvedValue({ active: [d1, d2], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteWriteDraft.mockImplementation(async (id: string) => meta({ id }));

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().updateContent("d1", "one");
    useNotesStore.getState().updateContent("d2", "two");
    await vi.advanceTimersByTimeAsync(500);

    expect(apiMock.noteWriteDraft).toHaveBeenCalledWith("d1", "one");
    expect(apiMock.noteWriteDraft).toHaveBeenCalledWith("d2", "two");
  });

  it("cancels pending draft autosave when Save As converts to saved", async () => {
    const d1 = meta({ id: "d1", storage: "draft" });

    apiMock.notesList.mockResolvedValue({ active: [d1], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteSaveAs.mockResolvedValue(meta({ id: "d1", storage: "saved" }));

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().updateContent("d1", "draft");
    await useNotesStore.getState().saveAs("d1", "/tmp/d1.md");
    await vi.advanceTimersByTimeAsync(500);

    expect(apiMock.noteSaveAs).toHaveBeenCalledWith("d1", "/tmp/d1.md", "draft");
    expect(apiMock.noteWriteDraft).not.toHaveBeenCalled();
  });

  it("uses cached content on repeated select", async () => {
    const n1 = meta({ id: "n1" });
    apiMock.notesList.mockResolvedValue({ active: [n1], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteGet.mockResolvedValue({ meta: n1, content: "hello" });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    await useNotesStore.getState().select("n1");
    await useNotesStore.getState().select("n1");

    expect(apiMock.noteGet).toHaveBeenCalledTimes(1);
    expect(apiMock.noteSetActive).toHaveBeenCalledTimes(2);
  });

  it("marks saved notes dirty and saves on demand", async () => {
    const saved = meta({ id: "s1", storage: "saved" });
    const saved2 = meta({
      id: "s1",
      storage: "saved",
      title: "Changed",
      preview: "p",
    });

    apiMock.notesList.mockResolvedValue({ active: [saved], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({ selectedNoteId: "s1" });
    apiMock.noteGet.mockResolvedValue({ meta: saved, content: "hi" });
    apiMock.noteSave.mockResolvedValue(saved2);

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().updateContent("s1", "new");
    expect(useNotesStore.getState().dirtySavedById).toEqual({ s1: true });
    expect(apiMock.noteWriteDraft).not.toHaveBeenCalled();

    await useNotesStore.getState().save("s1");
    expect(apiMock.noteSave).toHaveBeenCalledWith("s1", "new");
    expect(useNotesStore.getState().dirtySavedById).toEqual({});
  });

  it("saves all dirty notes", async () => {
    const s1 = meta({ id: "s1", storage: "saved" });
    const s2 = meta({ id: "s2", storage: "saved" });
    apiMock.notesList.mockResolvedValue({ active: [s1, s2], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteGet.mockResolvedValueOnce({ meta: s1, content: "one" });
    apiMock.noteGet.mockResolvedValueOnce({ meta: s2, content: "two" });
    apiMock.noteSave.mockImplementation(async (id: string) => meta({ id, storage: "saved" }));

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().updateContent("s1", "one*");
    useNotesStore.getState().updateContent("s2", "two*");

    await useNotesStore.getState().saveAllDirty();
    expect(apiMock.noteSave).toHaveBeenCalledWith("s1", "one*");
    expect(apiMock.noteSave).toHaveBeenCalledWith("s2", "two*");
    expect(useNotesStore.getState().dirtySavedById).toEqual({});
  });

  it("selects trashed notes and switches view mode", async () => {
    const trashed = meta({ id: "t1", isTrashed: true });
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [trashed] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteGet.mockResolvedValue({ meta: trashed, content: "trash" });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();
    await useNotesStore.getState().select("t1");

    expect(useNotesStore.getState().viewMode).toBe("trash");
  });

  it("refreshes list", async () => {
    const n1 = meta({ id: "n1" });
    apiMock.notesList
      .mockResolvedValueOnce({ active: [], trashed: [] })
      .mockResolvedValueOnce({ active: [n1], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();
    await useNotesStore.getState().refresh();

    expect(useNotesStore.getState().list.active.map((n) => n.id)).toEqual(["n1"]);
  });

  it("clamps sidebar width and persists app state", async () => {
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().setSidebarWidth(100);
    expect(useNotesStore.getState().sidebarWidth).toBe(200);
    await vi.advanceTimersByTimeAsync(250);
    expect(apiMock.appStateSet).toHaveBeenCalledWith("sidebarWidth", "200");

    useNotesStore.getState().setSidebarWidth(500);
    expect(useNotesStore.getState().sidebarWidth).toBe(400);
    await vi.advanceTimersByTimeAsync(250);
    expect(apiMock.appStateSet).toHaveBeenCalledWith("sidebarWidth", "400");
  });

  it("sets view mode and persists app state", async () => {
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    useNotesStore.getState().setViewMode("trash");
    expect(useNotesStore.getState().viewMode).toBe("trash");
    await vi.advanceTimersByTimeAsync(250);
    expect(apiMock.appStateSet).toHaveBeenCalledWith("viewMode", "trash");
  });

  it("imports files and sets selection", async () => {
    const imported = meta({ id: "i1" });
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteImportFile.mockResolvedValue({ meta: imported, content: "hello" });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();
    await useNotesStore.getState().importFile("/tmp/file.md");

    expect(useNotesStore.getState().selectedId).toBe("i1");
    expect(useNotesStore.getState().contentById.i1).toBe("hello");
    expect(apiMock.noteSetActive).toHaveBeenCalledWith("i1");
  });

  it("trashes, restores, deletes and clears trash", async () => {
    const active = meta({ id: "a1" });
    const trashed = meta({ id: "t1", isTrashed: true });
    apiMock.notesList.mockResolvedValue({ active: [active], trashed: [trashed] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.noteTrash.mockResolvedValue({ ...active, isTrashed: true });
    apiMock.noteRestore.mockResolvedValue({ ...trashed, isTrashed: false });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    apiMock.noteDeleteForever.mockResolvedValue(undefined);
    await useNotesStore.getState().clearTrash();
    expect(apiMock.noteDeleteForever).toHaveBeenCalledWith("t1");
    expect(useNotesStore.getState().list.trashed).toEqual([]);

    await useNotesStore.getState().trash("a1");
    expect(useNotesStore.getState().list.trashed.map((n) => n.id)).toContain("a1");

    await useNotesStore.getState().restore("t1");
    expect(useNotesStore.getState().viewMode).toBe("notes");

    await useNotesStore.getState().deleteForever("a1");
    expect(useNotesStore.getState().list.active.map((n) => n.id)).not.toContain("a1");
  });

  it("no-ops clearTrash when empty", async () => {
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    await useNotesStore.getState().clearTrash();
    expect(apiMock.noteDeleteForever).not.toHaveBeenCalled();
  });

  it("toggles pin", async () => {
    const note = meta({ id: "p1", isPinned: false });
    apiMock.notesList.mockResolvedValue({ active: [note], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.notePin.mockResolvedValue({ ...note, isPinned: true });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();
    await useNotesStore.getState().togglePin("p1");

    expect(useNotesStore.getState().list.active.find((n) => n.id === "p1")?.isPinned).toBe(true);
  });

  it("reorders and supports undo/redo", async () => {
    const p1 = meta({ id: "p1", isPinned: true, sortOrder: 1 });
    const p2 = meta({ id: "p2", isPinned: true, sortOrder: 2 });
    const n1 = meta({ id: "n1", isPinned: false, sortOrder: 3 });
    apiMock.notesList.mockResolvedValue({ active: [p1, p2, n1], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({});
    apiMock.notesReorder.mockResolvedValue(undefined);

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    await useNotesStore.getState().reorder("pinned", ["p2", "p1"]);
    expect(apiMock.notesReorder).toHaveBeenCalledWith(["p2", "p1"]);

    await useNotesStore.getState().undoReorder();
    expect(apiMock.notesReorder).toHaveBeenCalledWith(["p1", "p2"]);

    await useNotesStore.getState().redoReorder();
    expect(apiMock.notesReorder).toHaveBeenCalledWith(["p2", "p1"]);
  });

  it("heartbeats selected and logs errors", async () => {
    const note = meta({ id: "h1" });
    apiMock.notesList.mockResolvedValue({ active: [note], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({ selectedNoteId: "h1" });
    apiMock.noteGet.mockResolvedValue({ meta: note, content: "" });
    apiMock.noteSetActive.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("nope"));

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    await useNotesStore.getState().heartbeatSelected();
    expect(spy).toHaveBeenCalledWith("Heartbeat failed:", expect.any(Error));
    spy.mockRestore();
  });
});
