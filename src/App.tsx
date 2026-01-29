import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";
import { AppShell } from "@/app/AppShell";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons/Icon";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { CommandPalette } from "@/features/command/CommandPalette";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { createPageActions } from "@/routes/pageActions";
import { createPageKeydownHandler } from "@/routes/pageHotkeys";
import { openDialog, confirmDialog } from "@/stores/dialogStore";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { noteExpiryTime } from "@/lib/utils/expiry";

const LazyEditor = lazy(() =>
  import("@/features/editor/Editor").then((mod) => ({ default: mod.Editor })),
);
const LazyTrashPreview = lazy(() =>
  import("@/features/editor/TrashPreview").then((mod) => ({ default: mod.TrashPreview })),
);

function App() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const updateCheckInFlightRef = useRef(false);
  const updateCheckTimeoutIdRef = useRef<number | null>(null);

  const list = useNotesStore((s) => s.list);
  const selectedId = useNotesStore((s) => s.selectedId);
  const viewMode = useNotesStore((s) => s.viewMode);
  const sidebarWidth = useNotesStore((s) => s.sidebarWidth);
  const contentById = useNotesStore((s) => s.contentById);

  const expiryMinutes = useSettingsStore((s) => s.expiryMinutes);
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

  const showMainWindow = useCallback(async () => {
    const window = getCurrentWindow();
    await window.show();
    await window.setFocus();
  }, []);

  const hasCheckedOnLaunchRef = useRef(false);

  const checkForUpdates = useCallback(async (options: { silent?: boolean } = {}) => {
    if (updateCheckInFlightRef.current) return;

    updateCheckInFlightRef.current = true;
    setIsCheckingUpdates(true);

    try {
      const update = await check();
      if (!update) {
        if (!options.silent) {
          toast.success("You're up to date!", {
            description: "You're running the latest version of Augenblick.",
          });
        }
        return;
      }

      // Download and install immediately (silently)
      await update.downloadAndInstall();

      // Show toast with Restart button
      toast.success("Update available", {
        description: `Version ${update.version} is here. Restart to install.`,
        action: {
          label: "Restart",
          onClick: () => {
            relaunch().catch((err) => {
              toast.error("Restart failed", {
                description: "Please restart the app manually to apply the update.",
              });
              console.error("Relaunch failed:", err);
            });
          },
        },
        duration: Infinity,
      });
    } catch (err) {
      if (!options.silent) {
        toast.error("Update failed", { description: String(err) });
      }
    } finally {
      updateCheckInFlightRef.current = false;
      setIsCheckingUpdates(false);
    }
  }, []);

  const handleCheckUpdates = useCallback(() => {
    if (updateCheckTimeoutIdRef.current != null) {
      window.clearTimeout(updateCheckTimeoutIdRef.current);
      updateCheckTimeoutIdRef.current = null;
    }
    void checkForUpdates({ silent: false });
  }, [checkForUpdates]);

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

  const confirmUnsaved = useCallback(async (title: string) => {
    const dirtyCount = Object.keys(useNotesStore.getState().dirtySavedById).length;
    if (dirtyCount === 0) return true;

    const choice = await openDialog({
      title,
      description: `You have unsaved changes in ${dirtyCount} note${dirtyCount === 1 ? "" : "s"}.`,
      cancelId: "cancel",
      actions: [
        { id: "save", label: "Save" },
        { id: "discard", label: "Don't Save", variant: "secondary" },
        { id: "cancel", label: "Cancel", variant: "secondary" },
      ],
    });

    if (choice === "cancel") return false;
    if (choice === "save") await useNotesStore.getState().saveAllDirty();
    return true;
  }, []);

  useEffect(() => {
    let nextExpiryAt: number | null = null;

    for (const note of list.active) {
      if (note.isPinned) continue;
      const noteExpiry = noteExpiryTime(note.lastInteraction, expiryMinutes);
      if (nextExpiryAt === null || noteExpiry < nextExpiryAt) nextExpiryAt = noteExpiry;
    }

    if (nextExpiryAt === null) return;

    const delay = Math.max(0, nextExpiryAt - Date.now());
    const timer = window.setTimeout(() => {
      void runOrAlert(() => useNotesStore.getState().runExpirySweep());
    }, delay);

    return () => window.clearTimeout(timer);
  }, [expiryMinutes, list.active, runOrAlert]);

  useEffect(() => {
    let isClosing = false;
    let disposed = false;
    const unlisteners: Array<() => void> = [];
    const registerUnlisten = (unlisten: (() => void) | null | undefined) => {
      if (!unlisten) return;
      if (disposed) {
        unlisten();
        return;
      }
      unlisteners.push(unlisten);
    };

    void runOrAlert(async () => {
      await useSettingsStore.getState().init();
      if (disposed) return;
      await useNotesStore.getState().init();
      if (disposed) return;

      // Check for updates on launch (silent - only shows toast if update ready)
      if (!hasCheckedOnLaunchRef.current) {
        hasCheckedOnLaunchRef.current = true;
        updateCheckTimeoutIdRef.current = window.setTimeout(() => {
          updateCheckTimeoutIdRef.current = null;
          void checkForUpdates({ silent: true });
        }, 2000);
      }

      if (disposed) return;
      registerUnlisten(await listen("menu-open-markdown", () => {
        void runOrAlert(() => actions.openMarkdown());
      }));
      if (disposed) return;
      registerUnlisten(await listen("menu-new-note", () => {
        void runOrAlert(() => useNotesStore.getState().createNote());
      }));
      if (disposed) return;
      registerUnlisten(await listen("menu-save", () => {
        void runOrAlert(() => actions.saveCurrent());
      }));
      if (disposed) return;
      registerUnlisten(await listen("menu-save-as", () => {
        void runOrAlert(() => actions.saveAs());
      }));
      if (disposed) return;
      registerUnlisten(await listen("menu-trash", () => {
        void runOrAlert(() => actions.closeCurrent());
      }));
      if (disposed) return;
      registerUnlisten(await listen("menu-settings", () => {
        setShowSettings(true);
      }));

      if (disposed) return;
      registerUnlisten(await listen("tray-new-note", () => {
        void runOrAlert(async () => {
          await useNotesStore.getState().createNote();
          await showMainWindow();
        });
      }));

      if (disposed) return;
      registerUnlisten(await listen("tray-show-all", () => {
        void runOrAlert(async () => {
          useNotesStore.getState().setViewMode("notes");
          await showMainWindow();
        });
      }));

      if (disposed) return;
      registerUnlisten(await listen<string>("tray-select-note", (event) => {
        const id = event.payload;
        if (!id) return;
        void runOrAlert(async () => {
          await useNotesStore.getState().select(id);
          await showMainWindow();
        });
      }));

      if (disposed) return;
      registerUnlisten(await listen("tray-quit", () => {
        void runOrAlert(async () => {
          await showMainWindow();
          const shouldQuit = await confirmUnsaved("Quit Augenblick?");
          if (!shouldQuit) return;
          await api.appExit();
        });
      }));

      if (disposed) return;
      registerUnlisten(await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        if (isClosing) return;
        isClosing = true;
        try {
          const shouldHide = await confirmUnsaved("Hide Augenblick?");
          if (!shouldHide) return;
          await getCurrentWindow().hide();
        } finally {
          isClosing = false;
        }
      }));
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
    });

    window.addEventListener("keydown", onKeyDown);

    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("keydown", onKeyDown);
      if (updateCheckTimeoutIdRef.current != null) {
        window.clearTimeout(updateCheckTimeoutIdRef.current);
        updateCheckTimeoutIdRef.current = null;
      }
      for (const unlisten of unlisteners.splice(0)) {
        unlisten();
      }
    };
  }, [actions, checkForUpdates, confirmUnsaved, runOrAlert, showMainWindow]);

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
              expiryMinutes={expiryMinutes}
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

          <div className="flex-1 h-full" style={{ background: "var(--bg-primary)" }}>
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
                <div className="flex h-full items-center justify-center gap-2">
                  <Spinner className="size-4 text-[var(--text-secondary)]" />
                  <span className="text-[13px] text-[var(--text-secondary)]">Loading note…</span>
                </div>
              )
            ) : viewMode === "trash" ? (
              <Empty className="h-full border-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="trash" />
                  </EmptyMedia>
                  <EmptyTitle>{trashed.length === 0 ? "Trash is empty" : "Select a note"}</EmptyTitle>
                  <EmptyDescription>
                    {trashed.length === 0
                      ? "Deleted notes will appear here"
                      : "Select a note to preview before restoring or deleting"}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Empty className="h-full border-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Icon name="file-text" />
                  </EmptyMedia>
                  <EmptyTitle>No note selected</EmptyTitle>
                  <EmptyDescription>
                    Create a new note or open an existing file
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex gap-2">
                    <Button onClick={() => void runOrAlert(() => useNotesStore.getState().createNote())}>
                      New note
                    </Button>
                    <Button variant="outline" onClick={() => void runOrAlert(() => actions.openMarkdown())}>
                      Open File
                    </Button>
                  </div>
                </EmptyContent>
              </Empty>
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
            settings={{ expiryMinutes, trashRetentionDays, theme }}
            onClose={() => setShowSettings(false)}
            onTheme={(theme) => void runOrAlert(() => useSettingsStore.getState().setTheme(theme))}
            onExpiryMinutes={(minutes) =>
              void runOrAlert(() => useSettingsStore.getState().setExpiryMinutes(minutes))
            }
            onTrashDays={(days) => void runOrAlert(() => useSettingsStore.getState().setTrashRetentionDays(days))}
            isCheckingUpdates={isCheckingUpdates}
            onCheckUpdates={handleCheckUpdates}
          />
        ) : null}
        </div>
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
