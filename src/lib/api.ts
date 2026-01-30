import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, NoteMeta, NoteWithContent, NotesList } from "@/lib/types";

export const api = {
  notesList: () => invoke<NotesList>("notes_list"),
  noteCreate: () => invoke<NoteMeta>("note_create"),
  noteGet: (id: string) => invoke<NoteWithContent>("note_get", { id }),
  noteSetActive: (id: string) => invoke<void>("note_set_active", { id }),
  noteWriteDraft: (id: string, content: string) =>
    invoke<NoteMeta>("note_write_draft", { id, content }),
  noteSave: (id: string, content: string) => invoke<NoteMeta>("note_save", { id, content }),
  noteSaveAs: (id: string, path: string, content: string) =>
    invoke<NoteMeta>("note_save_as", { id, path, content }),
  noteImportFile: (path: string) => invoke<NoteWithContent>("note_import_file", { path }),
  noteTrash: (id: string) => invoke<NoteMeta>("note_trash", { id }),
  noteRestore: (id: string) => invoke<NoteMeta>("note_restore", { id }),
  noteDeleteForever: (id: string) => invoke<void>("note_delete_forever", { id }),
  notePin: (id: string, pinned: boolean) => invoke<NoteMeta>("note_pin", { id, pinned }),
  notesReorder: (ids: string[]) => invoke<void>("notes_reorder", { ids }),
  settingsGetAll: () => invoke<AppSettings>("settings_get_all"),
  settingsSet: (key: string, value: string) => invoke<void>("settings_set", { key, value }),
  appStateGetAll: () => invoke<Record<string, string>>("app_state_get_all"),
  appStateSet: (key: string, value: string) => invoke<void>("app_state_set", { key, value }),
  expiryRunNow: () => invoke<void>("expiry_run_now"),
  appSetActivationPolicy: (policy: "regular" | "accessory" | "prohibited") =>
    invoke<void>("app_set_activation_policy", { policy }),
  appShowMainWindow: () => invoke<void>("app_show_main_window"),
  appExit: () => invoke<void>("app_exit"),
};
