import { api } from "@/lib/api";

type AppStateSnapshot = {
  sidebarWidth: number;
  selectedId: string | null;
  viewMode: "notes" | "trash";
};

const draftSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let appStateTimer: ReturnType<typeof setTimeout> | null = null;

export function clearDraftSaveTimer(id: string) {
  const timer = draftSaveTimers.get(id);
  if (timer) clearTimeout(timer);
  draftSaveTimers.delete(id);
}

export function scheduleDraftSave(id: string, task: () => Promise<void>, delayMs = 500) {
  clearDraftSaveTimer(id);
  const timer = setTimeout(async () => {
    draftSaveTimers.delete(id);
    await task();
  }, delayMs);
  draftSaveTimers.set(id, timer);
}

export function scheduleAppStateWrite(getSnapshot: () => AppStateSnapshot) {
  if (appStateTimer) clearTimeout(appStateTimer);
  appStateTimer = setTimeout(async () => {
    try {
      const state = getSnapshot();
      await api.appStateSet("sidebarWidth", String(state.sidebarWidth));
      if (state.selectedId) await api.appStateSet("selectedNoteId", state.selectedId);
      await api.appStateSet("viewMode", state.viewMode);
    } catch (err) {
      console.error("App state write failed:", err);
    }
  }, 250);
}

