type NotesSnapshot = {
  list: { active: Array<{ id: string; isPinned: boolean }>; trashed: Array<{ id: string }> };
  selectedId: string | null;
  viewMode: "notes" | "trash";
};

export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    Boolean(el?.closest?.("[contenteditable='true']"))
  );
}

type Deps = {
  getNotesSnapshot: () => NotesSnapshot;
  getSelectedId: () => string | null;
  toggleCommandPalette: () => void;
  closeCommandPalette: () => void;
  openSettings: () => void;
  setViewMode: (viewMode: "notes" | "trash") => void;
  createNote: () => void;
  togglePinCurrent: () => void;
  closeCurrent: () => void;
  openMarkdown: () => void;
  saveCurrent: () => void;
  saveAs: () => void;
  selectNote: (id: string) => void;
  undoReorder: () => void;
  redoReorder: () => void;
};

export function createPageKeydownHandler(deps: Deps) {
  return (e: KeyboardEvent) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      if (!isTypingTarget(e.target)) {
        e.preventDefault();
        deps.closeCurrent();
        return;
      }
    }

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) {
      if (e.key === "Escape") {
        deps.closeCommandPalette();
        if (deps.getNotesSnapshot().viewMode === "trash") deps.setViewMode("notes");
      }
      return;
    }

    const key = e.key.toLowerCase();

    if (key === "z") {
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) deps.redoReorder();
      else deps.undoReorder();
      return;
    }

    if (key === "k") {
      e.preventDefault();
      deps.toggleCommandPalette();
      return;
    }

    if (key === ",") {
      e.preventDefault();
      deps.openSettings();
      return;
    }

    if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const snapshot = deps.getNotesSnapshot();

      const list =
        snapshot.viewMode === "trash"
          ? snapshot.list.trashed
          : [
              ...snapshot.list.active.filter((n) => n.isPinned),
              ...snapshot.list.active.filter((n) => !n.isPinned),
            ];
      if (list.length === 0) return;

      const dir = e.key === "ArrowUp" ? -1 : 1;
      const selectedId = deps.getSelectedId();
      const idx = selectedId ? list.findIndex((n: { id: string }) => n.id === selectedId) : -1;
      const nextIdx =
        idx === -1
          ? dir === 1
            ? 0
            : list.length - 1
          : Math.max(0, Math.min(list.length - 1, idx + dir));
      deps.selectNote(list[nextIdx]!.id);
      return;
    }

    if (key === "n") {
      e.preventDefault();
      deps.createNote();
      return;
    }

    if (key === "p") {
      e.preventDefault();
      deps.togglePinCurrent();
      return;
    }

    if (key === "s" && e.shiftKey) {
      e.preventDefault();
      deps.saveAs();
      return;
    }

    if (key === "s") {
      e.preventDefault();
      deps.saveCurrent();
      return;
    }

    if (key === "w") {
      e.preventDefault();
      deps.closeCurrent();
      return;
    }

    if (key === "o") {
      e.preventDefault();
      deps.openMarkdown();
    }
  };
}
