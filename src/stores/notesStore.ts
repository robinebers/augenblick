import { create } from "zustand";
import { api } from "@/lib/api";
import type { NoteMeta, NotesList } from "@/lib/types";

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
  reorder: (section: "pinned" | "notes", ids: string[]) => Promise<void>;
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

function upsertMeta(list: NotesList, meta: NoteMeta): NotesList {
  const target = meta.isTrashed ? "trashed" : "active";
  const other = target === "active" ? "trashed" : "active";

  const nextTarget = list[target].some((n) => n.id === meta.id)
    ? list[target].map((n) => (n.id === meta.id ? meta : n))
    : [...list[target], meta];

  const nextOther = list[other].filter((n) => n.id !== meta.id);

  return target === "active"
    ? { active: nextTarget, trashed: nextOther }
    : { active: nextOther, trashed: nextTarget };
}

function removeMeta(list: NotesList, id: string): NotesList {
  return {
    active: list.active.filter((n) => n.id !== id),
    trashed: list.trashed.filter((n) => n.id !== id),
  };
}

function replaceOrAppendActive(list: NotesList, meta: NoteMeta): NotesList {
  const without = list.active.filter((n) => n.id !== meta.id);
  return { ...list, active: [...without, meta] };
}

const draftSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let appStateTimer: ReturnType<typeof setTimeout> | null = null;
const reorderUndoStack: Array<{ section: "pinned" | "notes"; ids: string[] }> = [];
const reorderRedoStack: Array<{ section: "pinned" | "notes"; ids: string[] }> = [];

function clearDraftSaveTimer(id: string) {
  const timer = draftSaveTimers.get(id);
  if (timer) clearTimeout(timer);
  draftSaveTimers.delete(id);
}

function scheduleAppStateWrite(getState: () => NotesState) {
  if (appStateTimer) clearTimeout(appStateTimer);
  appStateTimer = setTimeout(async () => {
    try {
      const s = getState();
      await api.appStateSet("sidebarWidth", String(s.sidebarWidth));
      if (s.selectedId) await api.appStateSet("selectedNoteId", s.selectedId);
      await api.appStateSet("viewMode", s.viewMode);
    } catch (err) {
      console.error("App state write failed:", err);
    }
  }, 250);
}

function getSectionIds(s: NotesState, section: "pinned" | "notes") {
  return s.list.active
    .filter((n) => (section === "pinned" ? n.isPinned : !n.isPinned))
    .map((n) => n.id);
}

function applyReorderState(
  setState: (fn: (s: NotesState) => NotesState) => void,
  section: "pinned" | "notes",
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

function pushUndo(section: "pinned" | "notes", ids: string[]) {
  reorderUndoStack.push({ section, ids });
  if (reorderUndoStack.length > 20) reorderUndoStack.shift();
  reorderRedoStack.length = 0;
}

function listIds(list: NotesList) {
  return new Set([...list.active, ...list.trashed].map((note) => note.id));
}

function pruneByIds<T>(map: Record<string, T>, ids: Set<string>) {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    if (ids.has(key)) next[key] = value;
  }
  return next;
}

function sortActive(notes: NoteMeta[]) {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

function sortTrashed(notes: NoteMeta[]) {
  return [...notes].sort((a, b) => {
    const aTrashed = a.trashedAt ?? 0;
    const bTrashed = b.trashedAt ?? 0;
    if (aTrashed !== bTrashed) return bTrashed - aTrashed;
    return a.sortOrder - b.sortOrder;
  });
}

function findMetaById(list: NotesList, id: string | null) {
  if (!id) return null;
  return list.active.find((n) => n.id === id) ?? list.trashed.find((n) => n.id === id) ?? null;
}

function bumpLastInteraction(list: NotesList, id: string, now: number): NotesList {
  let changed = false;
  const update = (note: NoteMeta) => {
    if (note.id !== id) return note;
    if (note.lastInteraction === now) return note;
    changed = true;
    return { ...note, lastInteraction: now };
  };
  const active = list.active.map(update);
  const trashed = list.trashed.map(update);
  return changed ? { active, trashed } : list;
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

    scheduleAppStateWrite(get);
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
    scheduleAppStateWrite(get);

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
    scheduleAppStateWrite(get);
  },
  setSidebarWidth: (sidebarWidth) => {
    const clamped = Math.max(200, Math.min(400, sidebarWidth));
    set((s) => ({ ...s, sidebarWidth: clamped }));
    scheduleAppStateWrite(get);
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

    clearDraftSaveTimer(id);
    const timer = setTimeout(async () => {
      draftSaveTimers.delete(id);
      try {
        const updated = await api.noteWriteDraft(id, content);
        set((s) => ({ ...s, list: upsertMeta(s.list, updated) }));
      } catch (err) {
        console.error(`Draft auto-save failed for ${id}:`, err);
      }
    }, 500);
    draftSaveTimers.set(id, timer);
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

    scheduleAppStateWrite(get);
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
    const prev = getSectionIds(get(), section);
    pushUndo(section, prev);
    applyReorderState(set, section, ids);

    await api.notesReorder(ids);
    await get().refresh();
  },
  undoReorder: async () => {
    const entry = reorderUndoStack.pop();
    if (!entry) return;

    const current = getSectionIds(get(), entry.section);
    reorderRedoStack.push({ section: entry.section, ids: current });
    if (reorderRedoStack.length > 20) reorderRedoStack.shift();

    applyReorderState(set, entry.section, entry.ids);
    await api.notesReorder(entry.ids);
    await get().refresh();
  },
  redoReorder: async () => {
    const entry = reorderRedoStack.pop();
    if (!entry) return;

    const current = getSectionIds(get(), entry.section);
    reorderUndoStack.push({ section: entry.section, ids: current });
    if (reorderUndoStack.length > 20) reorderUndoStack.shift();

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
