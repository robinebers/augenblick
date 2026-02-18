import { create } from "zustand";
import { api } from "@/lib/api";
import type { NoteMeta, NotesList } from "@/lib/types";
import {
  bumpLastInteraction,
  findMetaById,
  getSectionIds,
  listIds,
  pruneByIds,
  removeMeta,
  replaceOrAppendActive,
  sortActive,
  sortTrashed,
  upsertMeta,
  type ReorderSection,
} from "@/stores/notes/helpers";
import {
  popReorderRedo,
  popReorderUndo,
  pushReorderRedo,
  pushReorderUndo,
  pushUndoFromRedo,
} from "@/stores/notes/reorderHistory";
import {
  clearDraftSaveTimer,
  scheduleAppStateWrite,
  scheduleDraftSave,
} from "@/stores/notes/persistenceTimers";

type ViewMode = "notes" | "trash";

type NotesState = {
  list: NotesList;
  selectedId: string | null;
  viewMode: ViewMode;
  sidebarWidth: number;
  contentById: Record<string, string>;
  dirtySavedById: Record<string, true>;
  loading: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  createNote: () => Promise<void>;
  select: (id: string) => Promise<void>;
  setViewMode: (viewMode: ViewMode) => Promise<void> | void;
  setSidebarWidth: (sidebarWidth: number) => void;
  updateContent: (id: string, content: string) => void;
  save: (id: string) => Promise<void>;
  saveAs: (id: string, path: string) => Promise<void>;
  saveAllDirty: () => Promise<void>;
  importFile: (path: string) => Promise<void>;
  trash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  clearTrash: () => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  reorder: (section: ReorderSection, ids: string[]) => Promise<void>;
  undoReorder: () => Promise<void>;
  redoReorder: () => Promise<void>;
  heartbeatSelected: () => Promise<void>;
  runExpirySweep: () => Promise<void>;
};

const DEFAULT_STATE: Omit<
  NotesState,
  | "init"
  | "refresh"
  | "createNote"
  | "select"
  | "setViewMode"
  | "setSidebarWidth"
  | "updateContent"
  | "save"
  | "saveAs"
  | "saveAllDirty"
  | "importFile"
  | "trash"
  | "restore"
  | "deleteForever"
  | "clearTrash"
  | "togglePin"
  | "reorder"
  | "undoReorder"
  | "redoReorder"
  | "heartbeatSelected"
  | "runExpirySweep"
> = {
  list: { active: [], trashed: [] },
  selectedId: null,
  viewMode: "notes",
  sidebarWidth: 260,
  contentById: {},
  dirtySavedById: {},
  loading: false,
};

function applyReorderState(
  setState: (fn: (s: NotesState) => NotesState) => void,
  section: ReorderSection,
  ids: string[],
) {
  setState((s) => {
    const pinned = s.list.active.filter((n) => n.isPinned);
    const unpinned = s.list.active.filter((n) => !n.isPinned);
    const target = section === "pinned" ? pinned : unpinned;
    const other = section === "pinned" ? unpinned : pinned;

    const byId = new Map(target.map((n) => [n.id, n] as const));
    const reordered: NoteMeta[] = [];
    for (const id of ids) {
      const note = byId.get(id);
      if (note) reordered.push(note);
    }

    const seen = new Set(reordered.map((n) => n.id));
    for (const note of target) {
      if (!seen.has(note.id)) reordered.push(note);
    }

    const nextPinned = section === "pinned" ? reordered : other;
    const nextUnpinned = section === "pinned" ? other : reordered;
    return { ...s, list: { ...s.list, active: [...nextPinned, ...nextUnpinned] } };
  });
}

function appStateSnapshot(getState: () => NotesState) {
  const state = getState();
  return {
    sidebarWidth: state.sidebarWidth,
    selectedId: state.selectedId,
    viewMode: state.viewMode,
  };
}

export const useNotesStore = create<NotesState>((set, get) => ({
  ...DEFAULT_STATE,
  init: async () => {
    set({ loading: true });

    try {
      await api.expiryRunNow();
    } catch (err) {
      console.error("Expiry sweep failed during init:", err);
    }

    const [list, appState] = await Promise.all([api.notesList(), api.appStateGetAll()]);

    set((s) => ({
      ...s,
      list,
      sidebarWidth: Number(appState.sidebarWidth ?? s.sidebarWidth),
      viewMode: (appState.viewMode as ViewMode) || s.viewMode,
      selectedId: appState.selectedNoteId ?? null,
      loading: false,
    }));

    const s = get();
    if (s.selectedId) {
      const inList =
        s.list.active.some((n) => n.id === s.selectedId) ||
        s.list.trashed.some((n) => n.id === s.selectedId);
      if (!inList) set({ selectedId: null });
    }

    const selected = get().selectedId;
    if (selected) await get().select(selected);
  },
  refresh: async () => {
    const list = await api.notesList();
    set((s) => ({ ...s, list }));
  },
  createNote: async () => {
    const meta = await api.noteCreate();
    set((s) => ({
      ...s,
      list: replaceOrAppendActive(s.list, meta),
      selectedId: meta.id,
      viewMode: "notes",
      contentById: { ...s.contentById, [meta.id]: "" },
    }));

    scheduleAppStateWrite(() => appStateSnapshot(get));
    await api.noteSetActive(meta.id);

    // Focus the editor after creating a new note
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("augenblick:focus-editor"));
    });
  },
  select: async (id) => {
    const before = get();
    const shouldOpenTrash = before.list.trashed.some((n) => n.id === id);
    const prevId = before.selectedId;
    const prevMeta = findMetaById(before.list, prevId);
    const nextMeta = findMetaById(before.list, id);
    const now = Date.now();
    const shouldBumpPrev = !!prevId && prevId !== id && prevMeta && !prevMeta.isTrashed;
    const shouldBumpNext = !!nextMeta && !nextMeta.isTrashed;

    set((s) => {
      let list = s.list;
      if (shouldBumpPrev && prevId) list = bumpLastInteraction(list, prevId, now);
      if (shouldBumpNext) list = bumpLastInteraction(list, id, now);
      return {
        ...s,
        list,
        selectedId: id,
        viewMode: shouldOpenTrash ? "trash" : s.viewMode,
      };
    });
    scheduleAppStateWrite(() => appStateSnapshot(get));

    if (shouldBumpPrev && prevId) {
      await api.noteSetActive(prevId);
    }

    if (shouldBumpNext) {
      await api.noteSetActive(id);
    }

    const state = get();
    const cached = state.contentById[id];
    if (typeof cached === "string") {
      return;
    }

    const note = await api.noteGet(id);
    set((s) => {
      const wantsTrashVisible = note.meta.isTrashed && s.viewMode !== "trash";
      return {
        ...s,
        list: upsertMeta(s.list, note.meta),
        contentById: { ...s.contentById, [id]: note.content },
        viewMode: wantsTrashVisible ? "trash" : s.viewMode,
      };
    });

  },
  setViewMode: (viewMode) => {
    set((s) => ({ ...s, viewMode }));
    scheduleAppStateWrite(() => appStateSnapshot(get));
  },
  setSidebarWidth: (sidebarWidth) => {
    const clamped = Math.max(200, Math.min(400, sidebarWidth));
    set((s) => ({ ...s, sidebarWidth: clamped }));
    scheduleAppStateWrite(() => appStateSnapshot(get));
  },
  updateContent: (id, content) => {
    const state = get();
    const meta =
      state.list.active.find((n) => n.id === id) ??
      state.list.trashed.find((n) => n.id === id);
    if (!meta) return;

    set((s) => ({
      ...s,
      contentById: { ...s.contentById, [id]: content },
      dirtySavedById:
        meta.storage === "saved" && !meta.isTrashed
          ? { ...s.dirtySavedById, [id]: true }
          : s.dirtySavedById,
    }));

    if (meta.storage !== "draft" || meta.isTrashed) return;

    scheduleDraftSave(id, async () => {
      try {
        const updated = await api.noteWriteDraft(id, content);
        set((s) => ({ ...s, list: upsertMeta(s.list, updated) }));
      } catch (err) {
        console.error(`Draft auto-save failed for ${id}:`, err);
      }
    });
  },
  save: async (id) => {
    const s = get();
    const meta = s.list.active.find((n) => n.id === id);
    if (!meta) return;

    const content = s.contentById[id] ?? "";
    const updated = await api.noteSave(id, content);

    const restDirty = { ...s.dirtySavedById };
    delete restDirty[id];
    set((st) => ({
      ...st,
      list: upsertMeta(st.list, updated),
      dirtySavedById: restDirty,
    }));
  },
  saveAs: async (id, path) => {
    clearDraftSaveTimer(id);
    const s = get();
    const content = s.contentById[id] ?? "";
    const updated = await api.noteSaveAs(id, path, content);

    const restDirty = { ...s.dirtySavedById };
    delete restDirty[id];
    set((st) => ({
      ...st,
      list: upsertMeta(st.list, updated),
      dirtySavedById: restDirty,
    }));
  },
  saveAllDirty: async () => {
    const s = get();
    const dirtyIds = Object.keys(s.dirtySavedById);
    if (dirtyIds.length === 0) return;

    const updates: NoteMeta[] = [];
    for (const id of dirtyIds) {
      const content = s.contentById[id] ?? "";
      const updated = await api.noteSave(id, content);
      updates.push(updated);
    }

    set((st) => {
      let nextList = st.list;
      for (const meta of updates) nextList = upsertMeta(nextList, meta);
      return { ...st, list: nextList, dirtySavedById: {} };
    });
  },
  importFile: async (path) => {
    const note = await api.noteImportFile(path);
    set((s) => ({
      ...s,
      list: upsertMeta(s.list, note.meta),
      selectedId: note.meta.id,
      viewMode: "notes",
      contentById: { ...s.contentById, [note.meta.id]: note.content },
    }));

    scheduleAppStateWrite(() => appStateSnapshot(get));
    await api.noteSetActive(note.meta.id);
  },
  trash: async (id) => {
    const updated = await api.noteTrash(id);
    set((s) => {
      const restDirty = { ...s.dirtySavedById };
      delete restDirty[id];

      return {
        ...s,
        selectedId: s.selectedId === id ? null : s.selectedId,
        list: upsertMeta(s.list, updated),
        dirtySavedById: restDirty,
      };
    });
  },
  restore: async (id) => {
    const updated = await api.noteRestore(id);
    set((s) => ({
      ...s,
      list: upsertMeta(s.list, updated),
      viewMode: "notes",
    }));
  },
  deleteForever: async (id) => {
    clearDraftSaveTimer(id);
    await api.noteDeleteForever(id);
    set((s) => {
      const nextContent = { ...s.contentById };
      delete nextContent[id];

      const nextDirty = { ...s.dirtySavedById };
      delete nextDirty[id];

      return {
        ...s,
        selectedId: s.selectedId === id ? null : s.selectedId,
        list: removeMeta(s.list, id),
        contentById: nextContent,
        dirtySavedById: nextDirty,
      };
    });
  },
  clearTrash: async () => {
    const ids = get().list.trashed.map((n) => n.id);
    if (ids.length === 0) return;

    for (const id of ids) {
      clearDraftSaveTimer(id);
      await api.noteDeleteForever(id);
    }

    set((s) => {
      const nextContent = { ...s.contentById };
      const nextDirty = { ...s.dirtySavedById };
      for (const id of ids) {
        delete nextContent[id];
        delete nextDirty[id];
      }

      return {
        ...s,
        selectedId: s.selectedId && ids.includes(s.selectedId) ? null : s.selectedId,
        list: { ...s.list, trashed: [] },
        contentById: nextContent,
        dirtySavedById: nextDirty,
      };
    });
  },
  togglePin: async (id) => {
    const s = get();
    const meta = s.list.active.find((n) => n.id === id);
    if (!meta) return;
    const updated = await api.notePin(id, !meta.isPinned);
    set((st) => ({ ...st, list: upsertMeta(st.list, updated) }));
  },
  reorder: async (section, ids) => {
    const prev = getSectionIds(get().list, section);
    pushReorderUndo(section, prev);
    applyReorderState(set, section, ids);

    await api.notesReorder(ids);
    await get().refresh();
  },
  undoReorder: async () => {
    const entry = popReorderUndo();
    if (!entry) return;

    const current = getSectionIds(get().list, entry.section);
    pushReorderRedo(entry.section, current);

    applyReorderState(set, entry.section, entry.ids);
    await api.notesReorder(entry.ids);
    await get().refresh();
  },
  redoReorder: async () => {
    const entry = popReorderRedo();
    if (!entry) return;

    const current = getSectionIds(get().list, entry.section);
    pushUndoFromRedo(entry.section, current);

    applyReorderState(set, entry.section, entry.ids);
    await api.notesReorder(entry.ids);
    await get().refresh();
  },
  heartbeatSelected: async () => {
    const id = get().selectedId;
    if (!id) return;
    try {
      await api.noteSetActive(id);
    } catch (err) {
      console.error("Heartbeat failed:", err);
    }
  },
  runExpirySweep: async () => {
    const sweepStartedAt = Date.now();

    try {
      await api.expiryRunNow();
    } catch (err) {
      console.error("Expiry sweep failed:", err);
    }

    const fetched = await api.notesList();
    const current = get();
    const fetchedIds = listIds(fetched);
    const extraActive = current.list.active.filter(
      (note) => !fetchedIds.has(note.id) && note.createdAt >= sweepStartedAt,
    );
    const extraTrashed = current.list.trashed.filter(
      (note) => !fetchedIds.has(note.id) && note.createdAt >= sweepStartedAt,
    );
    const list =
      extraActive.length || extraTrashed.length
        ? {
            active: sortActive([...fetched.active, ...extraActive]),
            trashed: sortTrashed([...fetched.trashed, ...extraTrashed]),
          }
        : fetched;
    const trashedIds = new Set(list.trashed.map((note) => note.id));
    const allowedIds = listIds(list);

    set((s) => {
      const nextContent = pruneByIds(s.contentById, allowedIds);
      const nextDirty = Object.fromEntries(
        Object.entries(s.dirtySavedById).filter(([id]) => allowedIds.has(id)),
      );
      const selectedId = s.selectedId && allowedIds.has(s.selectedId) ? s.selectedId : null;
      const selectedIsTrashed = selectedId ? trashedIds.has(selectedId) : false;

      return {
        ...s,
        list,
        selectedId,
        viewMode: selectedIsTrashed ? "trash" : s.viewMode,
        contentById: nextContent,
        dirtySavedById: nextDirty,
      };
    });
  },
}));
