import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("api", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue(undefined);
  });

  it("calls invoke with expected commands", async () => {
    const { api } = await import("@/lib/api");

    await api.notesList();
    await api.noteCreate();
    await api.noteGet("n1");
    await api.noteSetActive("n1");
    await api.noteWriteDraft("n1", "content");
    await api.noteSave("n1", "content");
    await api.noteSaveAs("n1", "/tmp/file.md", "content");
    await api.noteImportFile("/tmp/file.md");
    await api.noteTrash("n1");
    await api.noteRestore("n1");
    await api.noteDeleteForever("n1");
    await api.notePin("n1", true);
    await api.notesReorder(["a", "b"]);
    await api.settingsGetAll();
    await api.settingsSet("theme", "dark");
    await api.appStateGetAll();
    await api.appStateSet("viewMode", "notes");
    await api.expiryRunNow();

    expect(invoke).toHaveBeenCalledWith("notes_list");
    expect(invoke).toHaveBeenCalledWith("note_create");
    expect(invoke).toHaveBeenCalledWith("note_get", { id: "n1" });
    expect(invoke).toHaveBeenCalledWith("note_set_active", { id: "n1" });
    expect(invoke).toHaveBeenCalledWith("note_write_draft", { id: "n1", content: "content" });
    expect(invoke).toHaveBeenCalledWith("note_save", { id: "n1", content: "content" });
    expect(invoke).toHaveBeenCalledWith("note_save_as", {
      id: "n1",
      path: "/tmp/file.md",
      content: "content",
    });
    expect(invoke).toHaveBeenCalledWith("note_import_file", { path: "/tmp/file.md" });
    expect(invoke).toHaveBeenCalledWith("note_trash", { id: "n1" });
    expect(invoke).toHaveBeenCalledWith("note_restore", { id: "n1" });
    expect(invoke).toHaveBeenCalledWith("note_delete_forever", { id: "n1" });
    expect(invoke).toHaveBeenCalledWith("note_pin", { id: "n1", pinned: true });
    expect(invoke).toHaveBeenCalledWith("notes_reorder", { ids: ["a", "b"] });
    expect(invoke).toHaveBeenCalledWith("settings_get_all");
    expect(invoke).toHaveBeenCalledWith("settings_set", { key: "theme", value: "dark" });
    expect(invoke).toHaveBeenCalledWith("app_state_get_all");
    expect(invoke).toHaveBeenCalledWith("app_state_set", { key: "viewMode", value: "notes" });
    expect(invoke).toHaveBeenCalledWith("expiry_run_now");
  });
});
