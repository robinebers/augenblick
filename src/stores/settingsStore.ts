import { create } from "zustand";
import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  expiryMinutes: 10_080,
  trashRetentionDays: 30,
  theme: "dark",
};

function applyRootMode(mode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
}

let systemMedia: MediaQueryList | null = null;
let systemListener: ((e: MediaQueryListEvent) => void) | null = null;

function stopSystemWatcher() {
  if (!systemMedia || !systemListener) return;
  systemMedia.removeEventListener("change", systemListener);
  systemMedia = null;
  systemListener = null;
}

function startSystemWatcher() {
  stopSystemWatcher();
  systemMedia = window.matchMedia("(prefers-color-scheme: dark)");
  systemListener = (e) => applyRootMode(e.matches ? "dark" : "light");
  applyRootMode(systemMedia.matches ? "dark" : "light");

  systemMedia.addEventListener("change", systemListener);
}

function applyTheme(theme: AppSettings["theme"]) {
  if (typeof window === "undefined") return;
  if (theme === "system") {
    startSystemWatcher();
    return;
  }
  stopSystemWatcher();
  applyRootMode(theme);
}

type SettingsState = AppSettings & {
  initialized: boolean;
  init: () => Promise<void>;
  setTheme: (theme: AppSettings["theme"]) => Promise<void>;
  setExpiryMinutes: (minutes: number) => Promise<void>;
  setTrashRetentionDays: (days: number) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  initialized: false,
  init: async () => {
    if (get().initialized) return;
    const settings = await api.settingsGetAll();
    set({ ...settings, initialized: true });
    applyTheme(settings.theme);
  },
  setTheme: async (theme) => {
    set((s) => ({ ...s, theme }));
    applyTheme(theme);
    await api.settingsSet("theme", theme);
  },
  setExpiryMinutes: async (expiryMinutes) => {
    set((s) => ({ ...s, expiryMinutes }));
    await api.settingsSet("expiry_minutes", String(expiryMinutes));
  },
  setTrashRetentionDays: async (trashRetentionDays) => {
    set((s) => ({ ...s, trashRetentionDays }));
    await api.settingsSet("trash_retention_days", String(trashRetentionDays));
  },
}));
