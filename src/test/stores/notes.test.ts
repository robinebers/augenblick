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
  });

  it("clears selectedId when missing from list", async () => {
    apiMock.notesList.mockResolvedValue({ active: [], trashed: [] });
    apiMock.appStateGetAll.mockResolvedValue({ selectedNoteId: "missing" });

    const { useNotesStore } = await import("@/stores/notesStore");
    await useNotesStore.getState().init();

    expect(useNotesStore.getState().selectedId).toBeNull();
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
});
