import type { NoteMeta } from "@/lib/types";

type DialogApi = {
  openDialog: (opts: {
    title: string;
    description: string;
    cancelId: string;
    actions: Array<{ id: string; label: string; variant?: "secondary" }>;
  }) => Promise<string>;
  confirmDialog: (opts: {
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    destructive?: boolean;
  }) => Promise<boolean>;
};

type OpenFile = (opts?: any) => Promise<string | string[] | null>;
type SaveFile = (opts?: any) => Promise<string | null>;

export function createPageActions(deps: {
  notesStore: {
    importFile: (path: string) => Promise<void>;
    save: (id: string) => Promise<void>;
    saveAs: (id: string, path: string) => Promise<void>;
    trash: (id: string) => Promise<void>;
    updateContent: (id: string, markdown: string) => void;
    deleteForever: (id: string) => Promise<void>;
    clearTrash: () => Promise<void>;
  };
  dialog: DialogApi;
  toast: { success: (message: string) => void };
  openFile: OpenFile;
  saveFile: SaveFile;
  getSelectedId: () => string | null;
  getSelectedMeta: () => NoteMeta | null;
  getMetaById?: (id: string) => NoteMeta | null;
  isDirtySaved: (id: string) => boolean;
  getSidebarWidth: () => number;
  setSidebarWidth: (width: number) => void;
  getTrashedCount: () => number;
}) {
  let openMarkdownInFlight = false;

  async function openMarkdown() {
    if (openMarkdownInFlight) return;
    openMarkdownInFlight = true;

    try {
      const picked = await deps.openFile({
        multiple: false,
        directory: false,
        filters: [{ name: "Markdown", extensions: ["md"] }],
        fileAccessMode: "scoped",
      });
      if (!picked || Array.isArray(picked)) return;
      await deps.notesStore.importFile(picked);
    } finally {
      openMarkdownInFlight = false;
    }
  }

  async function saveCurrent() {
    const id = deps.getSelectedId();
    const meta = deps.getSelectedMeta();
    if (!id || !meta) return;
    if (meta.storage === "draft") {
      await saveAs();
      return;
    }
    await deps.notesStore.save(id);
  }

  async function saveAs() {
    const id = deps.getSelectedId();
    if (!id) return;

    const defaultName = deps.getSelectedMeta()?.title?.trim() || "Note";
    const picked = await deps.saveFile({
      title: "Save Note",
      defaultPath: `${defaultName}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!picked) return;

    const finalPath = picked.endsWith(".md") ? picked : `${picked}.md`;
    await deps.notesStore.saveAs(id, finalPath);
  }

  function resolveMetaById(id: string) {
    if (deps.getMetaById) return deps.getMetaById(id);
    return deps.getSelectedId() === id ? deps.getSelectedMeta() : null;
  }

  async function trashNoteById(id: string) {
    const meta = resolveMetaById(id);
    if (!meta || meta.isTrashed) return;

    if (meta.storage === "saved" && deps.isDirtySaved(id)) {
      const choice = await deps.dialog.openDialog({
        title: "Trash note?",
        description: "Save changes before moving this note to Trash?",
        cancelId: "cancel",
        actions: [
          { id: "save", label: "Save" },
          { id: "discard", label: "Don't Save", variant: "secondary" },
          { id: "cancel", label: "Cancel", variant: "secondary" },
        ],
      });

      if (choice === "cancel") return;
      if (choice === "save") await deps.notesStore.save(id);
      await deps.notesStore.trash(id);
      deps.toast.success("Moved to Trash");
      return;
    }

    await deps.notesStore.trash(id);
    deps.toast.success("Moved to Trash");
  }

  async function closeCurrent() {
    const id = deps.getSelectedId();
    if (!id) return;
    await trashNoteById(id);
  }

  function onEditorChange(markdown: string) {
    const id = deps.getSelectedId();
    if (!id) return;
    deps.notesStore.updateContent(id, markdown);
  }

  function startResize(e: MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = deps.getSidebarWidth();

    const onMove = (move: MouseEvent) => {
      const delta = move.clientX - startX;
      const width = Math.max(200, Math.min(400, startWidth + delta));
      deps.setSidebarWidth(width);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function deleteForeverFromTrash(id: string) {
    const ok = await deps.dialog.confirmDialog({
      title: "Delete forever?",
      description: "This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    await deps.notesStore.deleteForever(id);
    deps.toast.success("Deleted");
  }

  async function clearTrash() {
    const count = deps.getTrashedCount();
    if (count === 0) return;
    const ok = await deps.dialog.confirmDialog({
      title: "Clear trash?",
      description: `Permanently delete ${count} note${count === 1 ? "" : "s"}?`,
      confirmText: "Clear trash",
      cancelText: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    await deps.notesStore.clearTrash();
    deps.toast.success("Trash cleared");
  }

  return {
    openMarkdown,
    saveCurrent,
    saveAs,
    closeCurrent,
    trashNoteById,
    onEditorChange,
    startResize,
    deleteForeverFromTrash,
    clearTrash,
  };
}
