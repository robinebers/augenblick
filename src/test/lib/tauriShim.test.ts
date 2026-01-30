import { beforeEach, describe, expect, it, vi } from "vitest";

type TauriInternals = {
  __augenblick_web?: boolean;
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

describe("tauri web shim", () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    delete (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
    await import("@/lib/tauri/shim");
  });

  function invoke(cmd: string, args?: Record<string, unknown>) {
    const internals = (window as Window & { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
    if (!internals?.invoke) throw new Error("Missing shim invoke");
    return internals.invoke(cmd, args);
  }

  it("creates notes and lists them", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const list = (await invoke("notes_list")) as { active: { id: string }[] };
    expect(list.active.map((n) => n.id)).toContain(created.id);
  });

  it("handles missing notes safely", async () => {
    await expect(invoke("note_get", { id: "missing" })).rejects.toThrow("Note not found");
    await expect(invoke("note_write_draft", { id: "missing", content: "x" })).rejects.toThrow(
      "Note not found",
    );
    await expect(invoke("note_save", { id: "missing", content: "x" })).rejects.toThrow(
      "Note not found",
    );
    await expect(invoke("note_save_as", { id: "missing", content: "x" })).rejects.toThrow(
      "Note not found",
    );
    await expect(invoke("note_trash", { id: "missing" })).rejects.toThrow("Note not found");
    await expect(invoke("note_restore", { id: "missing" })).rejects.toThrow("Note not found");
    await expect(invoke("note_pin", { id: "missing", pinned: true })).rejects.toThrow(
      "Note not found",
    );
    await expect(invoke("unknown_cmd")).rejects.toThrow("Unsupported command");
  });

  it("writes drafts and saves", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: "# Title\nPreview line",
    })) as { title: string; preview: string };

    expect(updated.title).toBe("Title");
    expect(updated.preview).toBe("Preview line");

    await expect(
      invoke("note_save", { id: created.id, content: "oops" }),
    ).rejects.toThrow("Only saved notes");

    const saved = (await invoke("note_save_as", {
      id: created.id,
      path: "/tmp/note.md",
      content: "content",
    })) as { storage: string; filePath: string };

    expect(saved.storage).toBe("saved");
    expect(saved.filePath).toBe("/tmp/note.md");

    const savedAgain = (await invoke("note_save", {
      id: created.id,
      content: "content",
    })) as { storage: string };
    expect(savedAgain.storage).toBe("saved");
  });

  it("derives title/preview from long content", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const long = "a".repeat(200);
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: `${long}\n${long}`,
    })) as { title: string; preview: string };

    expect(updated.title.length).toBe(80);
    expect(updated.preview.length).toBe(140);
  });

  it("falls back to default title when empty", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: "\\# Escaped",
    })) as { title: string };

    expect(updated.title.startsWith("#")).toBe(true);

    const empty = (await invoke("note_write_draft", {
      id: created.id,
      content: "\n\n",
    })) as { title: string };
    expect(empty.title).toBe("New note");
  });

  it("falls back when content is only whitespace entities", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: "&nbsp;",
    })) as { title: string };

    expect(updated.title).toBe("New note");
  });

  it("decodes HTML entities in titles", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: "Hello&nbsp;World",
    })) as { title: string };

    expect(updated.title).toBe("Hello World");
  });

  it("strips markdown escape sequences from titles", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: "Hello \\*world\\*",
    })) as { title: string };

    expect(updated.title).toBe("Hello *world*");
  });

  it("skips non-text lines like --- for title", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const updated = (await invoke("note_write_draft", {
      id: created.id,
      content: "---\nActual title",
    })) as { title: string; preview: string };

    expect(updated.title).toBe("Actual title");
  });

  it("uses fallback save path and rejects auto-save for saved notes", async () => {
    const created = (await invoke("note_create")) as { id: string };
    await invoke("note_save_as", { id: created.id, path: "", content: "content" });
    await expect(
      invoke("note_write_draft", { id: created.id, content: "content" }),
    ).rejects.toThrow("Only drafts can be auto-saved");
  });

  it("trashes, restores, and deletes", async () => {
    const created = (await invoke("note_create")) as { id: string };

    await invoke("note_trash", { id: created.id });
    let list = (await invoke("notes_list")) as { trashed: { id: string }[] };
    expect(list.trashed.map((n) => n.id)).toContain(created.id);

    await invoke("note_restore", { id: created.id });
    list = (await invoke("notes_list")) as { active: { id: string }[] };
    expect(list.active.map((n) => n.id)).toContain(created.id);

    await invoke("note_delete_forever", { id: created.id });
    list = (await invoke("notes_list")) as { active: { id: string }[] };
    expect(list.active.map((n) => n.id)).not.toContain(created.id);
  });

  it("pins notes and enforces limits", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const created = (await invoke("note_create")) as { id: string };
      ids.push(created.id);
      await invoke("note_pin", { id: created.id, pinned: true });
    }

    const extra = (await invoke("note_create")) as { id: string };
    await expect(invoke("note_pin", { id: extra.id, pinned: true })).rejects.toThrow(
      "only pin up to 5",
    );

    const unpinned = (await invoke("note_pin", { id: ids[0], pinned: false })) as {
      isPinned: boolean;
    };
    expect(unpinned.isPinned).toBe(false);

    const same = (await invoke("note_pin", { id: ids[0], pinned: false })) as {
      isPinned: boolean;
    };
    expect(same.isPinned).toBe(false);
  });

  it("reorders notes and skips trashed entries", async () => {
    const a = (await invoke("note_create")) as { id: string };
    const b = (await invoke("note_create")) as { id: string };
    await invoke("note_trash", { id: b.id });

    await invoke("notes_reorder", { ids: [b.id, a.id, "missing"] });
    const list = (await invoke("notes_list")) as { active: { id: string }[] };
    expect(list.active.map((n) => n.id)).toContain(a.id);
  });

  it("handles settings and app state", async () => {
    const settings = (await invoke("settings_get_all")) as {
      expiryMinutes: number;
      trashRetentionDays: number;
      theme: string;
    };
    expect(settings.expiryMinutes).toBe(10_080);

    await invoke("settings_set", { key: "theme", value: "light" });
    await invoke("settings_set", { key: "expiry_minutes", value: "360" });
    await invoke("settings_set", { key: "trash_retention_days", value: "60" });
    await invoke("settings_set", { key: "theme", value: "invalid" });
    await invoke("settings_set", { key: "expiry_minutes", value: "0" });

    const next = (await invoke("settings_get_all")) as {
      expiryMinutes: number;
      trashRetentionDays: number;
      theme: string;
    };
    expect(next.theme).toBe("light");
    expect(next.expiryMinutes).toBe(360);
    expect(next.trashRetentionDays).toBe(60);

    await invoke("app_state_set", { key: "viewMode", value: "notes" });
    const appState = (await invoke("app_state_get_all")) as Record<string, string>;
    expect(appState.viewMode).toBe("notes");
  });

  it("auto-trashes expired notes", async () => {
    const created = (await invoke("note_create")) as { id: string };
    const pinned = (await invoke("note_create")) as { id: string };
    await invoke("note_pin", { id: pinned.id, pinned: true });
    const storageKey = "augenblick:webdb:v1";
    const db = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as {
      notes: Record<string, { meta: { lastInteraction: number } }>;
      settings: { expiryMinutes: number };
    };
    db.settings = { expiryMinutes: 1 };
    db.notes[created.id].meta.lastInteraction = Date.now() - 120_000;
    localStorage.setItem(storageKey, JSON.stringify(db));

    await invoke("expiry_run_now");
    const list = (await invoke("notes_list")) as { trashed: { id: string }[] };
    expect(list.trashed.map((n) => n.id)).toContain(created.id);
    expect(list.trashed.map((n) => n.id)).not.toContain(pinned.id);
  });

  it("rejects unsupported import", async () => {
    await expect(invoke("note_import_file", { path: "/tmp/file.md" })).rejects.toThrow(
      "Open/Import is not supported",
    );
  });

  it("recovers from invalid stored data", async () => {
    localStorage.setItem("augenblick:webdb:v1", "not-json");
    const settings = (await invoke("settings_get_all")) as { theme: string };
    expect(settings.theme).toBe("dark");
  });

  it("silently returns for note_set_active on missing note", async () => {
    const result = await invoke("note_set_active", { id: "nonexistent" });
    expect(result).toBeUndefined();
  });
});
