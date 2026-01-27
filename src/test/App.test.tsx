import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { render } from "@/test/utils/render";

const downloadAndInstall = vi.fn(async () => {});
const check = vi.fn(async () => ({ version: "0.1.1", downloadAndInstall }));

let lastOnCheckUpdates: (() => void) | null = null;

vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
  save: vi.fn(async () => null),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  }),
}));

vi.mock("@/app/AppShell", () => ({
  AppShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/features/sidebar/Sidebar", () => ({
  Sidebar: () => <div />,
}));
vi.mock("@/features/command/CommandPalette", () => ({
  CommandPalette: () => <div />,
}));
vi.mock("@/features/settings/SettingsDialog", () => ({
  SettingsDialog: (props: any) => {
    lastOnCheckUpdates = props.onCheckUpdates;
    return <button onClick={props.onCheckUpdates}>Check for updates</button>;
  },
}));

const notesState = {
  list: { active: [], trashed: [] },
  selectedId: null,
  viewMode: "notes",
  sidebarWidth: 240,
  contentById: {},
  dirtySavedById: {},
  init: vi.fn(async () => {}),
  refresh: vi.fn(async () => {}),
  createNote: vi.fn(async () => {}),
  select: vi.fn(async () => {}),
  setViewMode: vi.fn(),
  setSidebarWidth: vi.fn(),
  updateContent: vi.fn(),
  save: vi.fn(async () => {}),
  saveAs: vi.fn(async () => {}),
  saveAllDirty: vi.fn(async () => {}),
  importFile: vi.fn(async () => {}),
  trash: vi.fn(async () => {}),
  restore: vi.fn(async () => {}),
  deleteForever: vi.fn(async () => {}),
  clearTrash: vi.fn(async () => {}),
  togglePin: vi.fn(async () => {}),
  reorder: vi.fn(async () => {}),
  undoReorder: vi.fn(async () => {}),
  redoReorder: vi.fn(async () => {}),
  heartbeatSelected: vi.fn(async () => {}),
};

const useNotesStore = ((selector: any) => selector(notesState)) as any;
useNotesStore.getState = () => notesState;

const settingsState = {
  expiryMinutes: 10_080,
  trashRetentionDays: 30,
  theme: "dark",
  init: vi.fn(async () => {}),
  setTheme: vi.fn(async () => {}),
  setExpiryMinutes: vi.fn(async () => {}),
  setTrashRetentionDays: vi.fn(async () => {}),
};

const useSettingsStore = ((selector: any) => selector(settingsState)) as any;
useSettingsStore.getState = () => settingsState;

vi.mock("@/stores/notesStore", () => ({ useNotesStore }));
vi.mock("@/stores/settingsStore", () => ({ useSettingsStore }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("App updater", () => {
  beforeEach(() => {
    lastOnCheckUpdates = null;
    downloadAndInstall.mockClear();
    check.mockClear();
  });

  it("passes restart option when installing an update", async () => {
    const App = (await import("@/App")).default;
    const { unmount } = await render(React.createElement(App));

    await act(async () => {
      await flush();
    });

    await act(async () => {
      (globalThis as any).__TAURI_EMIT__("menu-settings");
      await flush();
    });

    expect(typeof lastOnCheckUpdates).toBe("function");

    await act(async () => {
      lastOnCheckUpdates?.();
      await flush();
    });

    expect(check).toHaveBeenCalled();
    expect(downloadAndInstall).toHaveBeenCalledWith({ restart: true });

    await unmount();
  });
});
