import { useEffect, type Dispatch, type SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createPageKeydownHandler } from "@/routes/pageHotkeys";
import { useNotesStore } from "@/stores/notesStore";

type Actions = {
  openMarkdown: () => Promise<void>;
  saveCurrent: () => Promise<void>;
  saveAs: () => Promise<void>;
  closeCurrent: () => Promise<void>;
};

type Params = {
  enabled: boolean;
  actions: Actions;
  runOrAlert: (task: () => void | Promise<void>) => Promise<void>;
  requestQuit: () => Promise<void>;
  setShowCommandPalette: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  syncMacActivationPolicy: (visible?: boolean) => Promise<void>;
};

export function useWindowAndMenuEvents({
  enabled,
  actions,
  runOrAlert,
  requestQuit,
  setShowCommandPalette,
  setShowSettings,
  syncMacActivationPolicy,
}: Params) {
  useEffect(() => {
    if (!enabled) return;

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
      if (disposed) return;
      registerUnlisten(await listen("menu-open-markdown", () => void runOrAlert(actions.openMarkdown)));
      if (disposed) return;
      registerUnlisten(await listen("menu-new-note", () => void runOrAlert(() => useNotesStore.getState().createNote())));
      if (disposed) return;
      registerUnlisten(await listen("menu-save", () => void runOrAlert(actions.saveCurrent)));
      if (disposed) return;
      registerUnlisten(await listen("menu-save-as", () => void runOrAlert(actions.saveAs)));
      if (disposed) return;
      registerUnlisten(await listen("menu-trash", () => void runOrAlert(actions.closeCurrent)));
      if (disposed) return;
      registerUnlisten(await listen("menu-settings", () => setShowSettings(true)));

      if (disposed) return;
      registerUnlisten(await listen("menu-quit", () => void runOrAlert(requestQuit)));

      if (disposed) return;
      registerUnlisten(await listen("tray-new-note", () => void runOrAlert(() => useNotesStore.getState().createNote())));

      if (disposed) return;
      registerUnlisten(await listen("tray-show-all", () => useNotesStore.getState().setViewMode("notes")));

      if (disposed) return;
      registerUnlisten(
        await listen<string>("tray-select-note", (event) => {
          const id = event.payload;
          if (!id) return;
          void runOrAlert(() => useNotesStore.getState().select(id));
        }),
      );

      if (disposed) return;
      registerUnlisten(await listen("tray-quit", () => void runOrAlert(requestQuit)));

      if (disposed) return;
      registerUnlisten(
        await getCurrentWindow().onCloseRequested(async (event) => {
          event.preventDefault();
          await getCurrentWindow().hide();
          await runOrAlert(() => syncMacActivationPolicy(false));
        }),
      );
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
        void runOrAlert(actions.closeCurrent);
      },
      openMarkdown: () => {
        void runOrAlert(actions.openMarkdown);
      },
      quit: () => {
        void runOrAlert(requestQuit);
      },
      saveCurrent: () => {
        void runOrAlert(actions.saveCurrent);
      },
      saveAs: () => {
        void runOrAlert(actions.saveAs);
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
      for (const unlisten of unlisteners.splice(0)) {
        unlisten();
      }
    };
  }, [
    actions,
    enabled,
    requestQuit,
    runOrAlert,
    setShowCommandPalette,
    setShowSettings,
    syncMacActivationPolicy,
  ]);
}

