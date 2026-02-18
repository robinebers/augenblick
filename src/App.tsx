import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";
import { AppShell } from "@/app/AppShell";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { useAppBootstrap } from "@/app/hooks/useAppBootstrap";
import { useExpiryScheduler } from "@/app/hooks/useExpiryScheduler";
import { useUpdater } from "@/app/hooks/useUpdater";
import { useWindowAndMenuEvents } from "@/app/hooks/useWindowAndMenuEvents";
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
import { openDialog, confirmDialog } from "@/stores/dialogStore";
import { getDirtySavedCount, getDirtySavedMap, isNoteDirty } from "@/stores/notes/dirty";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";

const LazyEditor = lazy(() =>
  import("@/features/editor/Editor").then((mod) => ({ default: mod.Editor })),
);
const LazyTrashPreview = lazy(() =>
  import("@/features/editor/TrashPreview").then((mod) => ({ default: mod.TrashPreview })),
);

type QuitWindow = Window & {
  __augenblickQuitInProgress?: boolean;
};

function setQuitInProgress(value: boolean) {
  (window as QuitWindow).__augenblickQuitInProgress = value;
}

function App() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    isCheckingUpdates,
    handleCheckUpdates,
    scheduleLaunchUpdateCheck,
  } = useUpdater();

  const list = useNotesStore((s) => s.list);
  const selectedId = useNotesStore((s) => s.selectedId);
  const viewMode = useNotesStore((s) => s.viewMode);
  const sidebarWidth = useNotesStore((s) => s.sidebarWidth);
  const contentById = useNotesStore((s) => s.contentById);
  const lastSavedContentById = useNotesStore((s) => s.lastSavedContentById);

  const expiryMinutes = useSettingsStore((s) => s.expiryMinutes);
  const trashRetentionDays = useSettingsStore((s) => s.trashRetentionDays);
  const theme = useSettingsStore((s) => s.theme);

  const pinned = useMemo(() => list.active.filter((n) => n.isPinned), [list.active]);
  const notes = useMemo(() => list.active.filter((n) => !n.isPinned), [list.active]);
  const trashed = useMemo(() => list.trashed, [list.trashed]);
  const dirtySavedById = useMemo(
    () => getDirtySavedMap({ list, contentById, lastSavedContentById }),
    [contentById, lastSavedContentById, list],
  );

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

  const syncMacActivationPolicy = useCallback(async (visible?: boolean) => {
    try {
      const window = getCurrentWindow();
      const shouldShow = visible ?? (await window.isVisible());
      await api.appSetActivationPolicy(shouldShow ? "regular" : "accessory");
    } catch (err) {
      console.error("activation policy sync failed", err);
      toast.error("Activation policy failed", { description: String(err) });
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
      getMetaById: (id) => {
        const s = useNotesStore.getState();
        return s.list.active.find((n) => n.id === id) ?? s.list.trashed.find((n) => n.id === id) ?? null;
      },
      isDirtySaved: (id) => isNoteDirty(useNotesStore.getState(), id),
      getSidebarWidth: () => useNotesStore.getState().sidebarWidth,
      setSidebarWidth: (width) => useNotesStore.getState().setSidebarWidth(width),
      getTrashedCount: () => useNotesStore.getState().list.trashed.length,
    });
  }, []);

  const confirmUnsaved = useCallback(async (title: string) => {
    const dirtyCount = getDirtySavedCount(useNotesStore.getState());
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

  const requestQuit = useCallback(async () => {
    setQuitInProgress(false);
    const dirtyCount = getDirtySavedCount(useNotesStore.getState());
    if (dirtyCount === 0) {
      setQuitInProgress(true);
      try {
        await api.appExit();
      } catch (err) {
        setQuitInProgress(false);
        throw err;
      }
      return;
    }
    // Has unsaved changes - show window first for dialog visibility
    await api.appShowMainWindow();
    const shouldQuit = await confirmUnsaved("Quit Augenblick?");
    if (!shouldQuit) {
      setQuitInProgress(false);
      return;
    }
    setQuitInProgress(true);
    try {
      await api.appExit();
    } catch (err) {
      setQuitInProgress(false);
      throw err;
    }
  }, [confirmUnsaved]);

  const isBootstrapped = useAppBootstrap({
    runOrAlert,
    syncMacActivationPolicy,
    scheduleLaunchUpdateCheck,
  });

  useExpiryScheduler({
    notes: list.active,
    expiryMinutes,
    runExpirySweep: () => useNotesStore.getState().runExpirySweep(),
    runOrAlert,
  });

  useWindowAndMenuEvents({
    enabled: isBootstrapped,
    actions: {
      openMarkdown: actions.openMarkdown,
      saveCurrent: actions.saveCurrent,
      saveAs: actions.saveAs,
      closeCurrent: actions.closeCurrent,
    },
    runOrAlert,
    requestQuit,
    setShowCommandPalette,
    setShowSettings,
    syncMacActivationPolicy,
  });

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
              dirtyIds={dirtySavedById}
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
              onTogglePin={(id) => void runOrAlert(() => useNotesStore.getState().togglePin(id))}
              onTrash={(id) => void runOrAlert(() => actions.trashNoteById(id))}
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
