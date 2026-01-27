import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";
import { AppShell } from "@/app/AppShell";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Icon } from "@/components/icons/Icon";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { CommandPalette } from "@/features/command/CommandPalette";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { createPageActions } from "@/routes/pageActions";
import { createPageKeydownHandler } from "@/routes/pageHotkeys";
import { openDialog, confirmDialog } from "@/stores/dialogStore";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";

const LazyEditor = lazy(() =>
  import("@/features/editor/Editor").then((mod) => ({ default: mod.Editor })),
);
const LazyTrashPreview = lazy(() =>
  import("@/features/editor/TrashPreview").then((mod) => ({ default: mod.TrashPreview })),
);

function App() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const list = useNotesStore((s) => s.list);
  const selectedId = useNotesStore((s) => s.selectedId);
  const viewMode = useNotesStore((s) => s.viewMode);
  const sidebarWidth = useNotesStore((s) => s.sidebarWidth);
  const contentById = useNotesStore((s) => s.contentById);

  const expiryDays = useSettingsStore((s) => s.expiryDays);
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays);
  const theme = useSettingsStore((s) => s.theme);

  const pinned = useMemo(() => list.active.filter((n) => n.isPinned), [list.active]);
  const notes = useMemo(() => list.active.filter((n) => !n.isPinned), [list.active]);
  const trashed = useMemo(() => list.trashed, [list.trashed]);

  const selectedMeta = useMemo(() => {
    if (!selectedId) return null;
    return (
      list.active.find((n) => n.id === selectedId) ??
      list.trashed.find((n) => n.id === selectedId) ??
      null
    );
  }, [list.active, list.trashed, selectedId]);

  const selectedContent = useMemo(
    () => (selectedId ? contentById[selectedId] ?? "" : ""),
    [contentById, selectedId],
  );

  const selectedLoaded = useMemo(
    () => (selectedId ? typeof contentById[selectedId] === "string" : false),
    [contentById, selectedId],
  );

  const selectedIsTrashed = Boolean(selectedMeta?.isTrashed);
  const shouldShowSelection =
    Boolean(selectedMeta && selectedId) && (viewMode !== "trash" || selectedIsTrashed);

  const runOrAlert = useCallback(async (task: () => void | Promise<void>) => {
    try {
      await Promise.resolve(task());
    } catch (err) {
      toast.error("Error", { description: String(err) });
    }
  }, []);

  const actions = useMemo(() => {
    const notesStore = useNotesStore.getState();
    return createPageActions({
      notesStore: {
        importFile: notesStore.importFile,
        save: notesStore.save,
        saveAs: notesStore.saveAs,
        trash: notesStore.trash,
        updateContent: notesStore.updateContent,
        deleteForever: notesStore.deleteForever,
        clearTrash: notesStore.clearTrash,
      },
      dialog: { openDialog, confirmDialog },
      toast: { success: (message) => toast.success(message) },
      openFile: open,
      saveFile: save,
      getSelectedId: () => useNotesStore.getState().selectedId,
      getSelectedMeta: () => {
        const s = useNotesStore.getState();
        const id = s.selectedId;
        if (!id) return null;
        return (
          s.list.active.find((n) => n.id === id) ??
          s.list.trashed.find((n) => n.id === id) ??
          null
        );
      },
      isDirtySaved: (id) => Boolean(useNotesStore.getState().dirtySavedById[id]),
      getSidebarWidth: () => useNotesStore.getState().sidebarWidth,
      setSidebarWidth: (width) => useNotesStore.getState().setSidebarWidth(width),
      getTrashedCount: () => useNotesStore.getState().list.trashed.length,
    });
  }, []);

  useEffect(() => {
    let unlistenClose: (() => void) | null = null;
    let unlistenMenuOpen: (() => void) | null = null;
    let unlistenMenuNew: (() => void) | null = null;
    let unlistenMenuSave: (() => void) | null = null;
    let unlistenMenuSaveAs: (() => void) | null = null;
    let unlistenMenuTrash: (() => void) | null = null;
    let unlistenMenuSettings: (() => void) | null = null;
    let unlistenMenuFind: (() => void) | null = null;
    let unlistenMenuReplace: (() => void) | null = null;
    let unlistenMenuFindNext: (() => void) | null = null;
    let unlistenMenuFindPrev: (() => void) | null = null;
    let isClosing = false;

    void runOrAlert(async () => {
      await useSettingsStore.getState().init();
      await useNotesStore.getState().init();

      unlistenMenuOpen = await listen("menu-open-markdown", () => {
        void runOrAlert(() => actions.openMarkdown());
      });
      unlistenMenuNew = await listen("menu-new-note", () => {
        void runOrAlert(() => useNotesStore.getState().createNote());
      });
      unlistenMenuSave = await listen("menu-save", () => {
        void runOrAlert(() => actions.saveCurrent());
      });
      unlistenMenuSaveAs = await listen("menu-save-as", () => {
        void runOrAlert(() => actions.saveAs());
      });
      unlistenMenuTrash = await listen("menu-trash", () => {
        void runOrAlert(() => actions.closeCurrent());
      });
      unlistenMenuSettings = await listen("menu-settings", () => {
        setShowSettings(true);
      });

      const emitEditor = (event: string) => {
        window.dispatchEvent(new Event(event));
      };

      unlistenMenuFind = await listen("menu-find", () => emitEditor("augenblick:find"));
      unlistenMenuReplace = await listen("menu-replace", () => emitEditor("augenblick:replace"));
      unlistenMenuFindNext = await listen("menu-find-next", () => emitEditor("augenblick:find-next"));
      unlistenMenuFindPrev = await listen("menu-find-prev", () => emitEditor("augenblick:find-prev"));

      unlistenClose = await getCurrentWindow().onCloseRequested(async (event) => {
        if (isClosing) return;

        const dirtyCount = Object.keys(useNotesStore.getState().dirtySavedById).length;
        if (dirtyCount === 0) return;

        event.preventDefault();
        const choice = await openDialog({
          title: "Quit Augenblick?",
          description: `You have unsaved changes in ${dirtyCount} note${dirtyCount === 1 ? "" : "s"}.`,
          cancelId: "cancel",
          actions: [
            { id: "save", label: "Save" },
            { id: "discard", label: "Don't Save", variant: "secondary" },
            { id: "cancel", label: "Cancel", variant: "secondary" },
          ],
        });

        if (choice === "cancel") return;
        if (choice === "save") await useNotesStore.getState().saveAllDirty();

        isClosing = true;
        await getCurrentWindow().close();
      });
    });

    const heartbeat = window.setInterval(() => {
      void useNotesStore.getState().heartbeatSelected();
    }, 30_000);

    const onKeyDown = createPageKeydownHandler({
      getNotesSnapshot: () => {
        const s = useNotesStore.getState();
        return {
          list: {
            active: s.list.active.map((n) => ({ id: n.id, isPinned: n.isPinned })),
            trashed: s.list.trashed.map((n) => ({ id: n.id })),
          },
          selectedId: s.selectedId,
          viewMode: s.viewMode,
        };
      },
      getSelectedId: () => useNotesStore.getState().selectedId,
      toggleCommandPalette: () => setShowCommandPalette((prev) => !prev),
      closeCommandPalette: () => setShowCommandPalette(false),
      openSettings: () => setShowSettings(true),
      setViewMode: (next) => {
        void runOrAlert(() => useNotesStore.getState().setViewMode(next));
      },
      createNote: () => {
        void runOrAlert(() => useNotesStore.getState().createNote());
      },
      togglePinCurrent: () => {
        const id = useNotesStore.getState().selectedId;
        if (id) void runOrAlert(() => useNotesStore.getState().togglePin(id));
      },
      closeCurrent: () => {
        void runOrAlert(() => actions.closeCurrent());
      },
      openMarkdown: () => {
        void runOrAlert(() => actions.openMarkdown());
      },
      saveCurrent: () => {
        void runOrAlert(() => actions.saveCurrent());
      },
      saveAs: () => {
        void runOrAlert(() => actions.saveAs());
      },
      selectNote: (id) => {
        void runOrAlert(() => useNotesStore.getState().select(id));
      },
      undoReorder: () => {
        void runOrAlert(() => useNotesStore.getState().undoReorder());
      },
      redoReorder: () => {
        void runOrAlert(() => useNotesStore.getState().redoReorder());
      },
      emitEditor: (event) => {
        window.dispatchEvent(new Event(event));
      },
    });

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("keydown", onKeyDown);
      unlistenClose?.();
      unlistenMenuOpen?.();
      unlistenMenuNew?.();
      unlistenMenuSave?.();
      unlistenMenuSaveAs?.();
      unlistenMenuTrash?.();
      unlistenMenuSettings?.();
      unlistenMenuFind?.();
      unlistenMenuReplace?.();
      unlistenMenuFindNext?.();
      unlistenMenuFindPrev?.();
    };
  }, [actions, runOrAlert]);

  return (
    <ErrorBoundary>
      <AppShell>
        <div className="app-shell h-screen w-screen overflow-hidden">
        <div className="flex h-full">
          <div className="shrink-0" style={{ width: sidebarWidth }}>
            <Sidebar
              pinned={pinned}
              notes={notes}
              trashed={trashed}
              selectedId={selectedId}
              expiryDays={expiryDays}
              trashRetentionDays={trashRetentionDays}
              viewMode={viewMode}
              onSelect={(id) => void runOrAlert(() => useNotesStore.getState().select(id))}
              onReorder={(section, ids) => void runOrAlert(() => useNotesStore.getState().reorder(section, ids))}
              onToggleTrash={() =>
                useNotesStore.getState().setViewMode(viewMode === "trash" ? "notes" : "trash")
              }
              onClearTrash={() => void runOrAlert(() => actions.clearTrash())}
              onRestore={(id) => void runOrAlert(() => useNotesStore.getState().restore(id))}
              onDeleteForever={(id) => void runOrAlert(() => actions.deleteForeverFromTrash(id))}
              onNewNote={() => void runOrAlert(() => useNotesStore.getState().createNote())}
            />
          </div>

          <button
            type="button"
            className="h-full w-[2px] cursor-col-resize"
            style={{ background: "var(--border-default)" }}
            aria-label="Resize sidebar"
            onMouseDown={(e) => actions.startResize(e.nativeEvent)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft")
                useNotesStore.getState().setSidebarWidth(useNotesStore.getState().sidebarWidth - 10);
              if (e.key === "ArrowRight")
                useNotesStore.getState().setSidebarWidth(useNotesStore.getState().sidebarWidth + 10);
            }}
          />

          <div className="flex-1 h-full">
            {shouldShowSelection ? (
              selectedLoaded ? (
                selectedIsTrashed ? (
                  <Suspense fallback={null}>
                    <LazyTrashPreview key={selectedId} content={selectedContent} />
                  </Suspense>
                ) : (
                  <Suspense fallback={null}>
                    <LazyEditor key={selectedId} value={selectedContent} onChange={actions.onEditorChange} />
                  </Suspense>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="text-[13px] text-[var(--text-secondary)]">Loading note…</div>
                </div>
              )
            ) : viewMode === "trash" && trashed.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div className="text-[13px] text-[var(--text-secondary)]">Trash is empty</div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="flex justify-center text-[var(--text-tertiary)]">
                    <Icon name="file-text" size={40} />
                  </div>
                  <div className="mt-3 text-[13px] text-[var(--text-secondary)]">
                    Press ⌘N to create a note
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showCommandPalette ? (
          <CommandPalette
            notes={list.active}
            onClose={() => setShowCommandPalette(false)}
            onNewNote={() => void runOrAlert(() => useNotesStore.getState().createNote())}
            onTogglePinCurrent={() => {
              const id = useNotesStore.getState().selectedId;
              if (id) void runOrAlert(() => useNotesStore.getState().togglePin(id));
            }}
            onCloseNote={() => void runOrAlert(() => actions.closeCurrent())}
            onOpenFile={() => void runOrAlert(() => actions.openMarkdown())}
            onSave={() => void runOrAlert(() => actions.saveCurrent())}
            onSaveAs={() => void runOrAlert(() => actions.saveAs())}
            onSelectNote={(id) => void runOrAlert(() => useNotesStore.getState().select(id))}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : null}

        {showSettings ? (
          <SettingsDialog
            settings={{ expiryDays, trashRetentionDays, theme }}
            onClose={() => setShowSettings(false)}
            onTheme={(theme) => void runOrAlert(() => useSettingsStore.getState().setTheme(theme))}
            onExpiryDays={(days) => void runOrAlert(() => useSettingsStore.getState().setExpiryDays(days))}
            onTrashDays={(days) => void runOrAlert(() => useSettingsStore.getState().setTrashRetentionDays(days))}
          />
        ) : null}
        </div>
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
