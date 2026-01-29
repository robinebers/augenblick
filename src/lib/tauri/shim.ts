import type { AppSettings, NoteMeta, NoteWithContent, NotesList } from "@/lib/types";

type WebDb = {
  notes: Record<string, { meta: NoteMeta; content: string }>;
  appState: Record<string, string>;
  settings: AppSettings;
};

const STORAGE_KEY = "augenblick:webdb:v1";

const DEFAULT_SETTINGS: AppSettings = {
  expiryMinutes: 10_080,
  trashRetentionDays: 30,
  theme: "dark",
};

function now() {
  return Date.now();
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`;
}

function deriveTitlePreview(content: string): Pick<NoteMeta, "title" | "preview"> {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sanitize = (line: string) => {
    const trimmed = line.trimStart();
    const next = trimmed[1];
    if (trimmed.startsWith("\\") && next && "#->*".includes(next)) {
      return trimmed.slice(1).trim();
    }
    return trimmed.replace(/^[#>\-*]+/, "").trim();
  };

  const decodeEntities = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const stripEscapes = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1");

  const clean = (line: string) => decodeEntities(stripEscapes(sanitize(line))).trim();

  const truncate = (s: string, maxLen: number) => (s.length <= maxLen ? s : s.slice(0, maxLen));

  const titleLine = lines.find((l) => clean(l).length > 0) ?? "";
  const titleRaw = clean(titleLine);
  const title = truncate(titleRaw.length === 0 ? "New note" : titleRaw, 80);

  const previewLine = lines.find((l) => l !== titleLine && clean(l).length > 0) ?? titleLine;
  const preview = truncate(clean(previewLine).split(/\s+/).join(" "), 140);

  return { title, preview };
}

function loadDb(): WebDb {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { notes: {}, appState: {}, settings: DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as WebDb;
    return {
      notes: parsed.notes ?? {},
      appState: parsed.appState ?? {},
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { notes: {}, appState: {}, settings: DEFAULT_SETTINGS };
  }
}

function saveDb(db: WebDb) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function nextSortOrder(db: WebDb): number {
  const activeUnpinned = Object.values(db.notes)
    .map((n) => n.meta)
    .filter((m) => !m.isTrashed && !m.isPinned);
  const max = activeUnpinned.reduce((acc, m) => Math.max(acc, m.sortOrder), 0);
  return max + 1;
}

function listNotes(db: WebDb): NotesList {
  const all = Object.values(db.notes).map((n) => n.meta);
  const active = all
    .filter((m) => !m.isTrashed)
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || a.sortOrder - b.sortOrder);
  const trashed = all
    .filter((m) => m.isTrashed)
    .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0) || a.sortOrder - b.sortOrder);
  return { active, trashed };
}

function getNote(db: WebDb, id: string): NoteWithContent {
  const entry = db.notes[id];
  if (!entry) throw new Error(`Note not found: ${id}`);
  return { meta: entry.meta, content: entry.content };
}

async function invokeWeb(cmd: string, args: Record<string, unknown> | undefined): Promise<unknown> {
  const db = loadDb();

  switch (cmd) {
    case "notes_list": {
      return listNotes(db);
    }
    case "note_create": {
      const id = uuid();
      const t = now();
      const meta: NoteMeta = {
        id,
        title: "New note",
        preview: "",
        filePath: `web://draft/${id}.md`,
        storage: "draft",
        isPinned: false,
        isTrashed: false,
        sortOrder: nextSortOrder(db),
        createdAt: t,
        lastInteraction: t,
        trashedAt: null,
      };
      db.notes[id] = { meta, content: "" };
      saveDb(db);
      return meta;
    }
    case "note_get": {
      return getNote(db, String(args?.id ?? ""));
    }
    case "note_set_active": {
      const id = String(args?.id ?? "");
      const entry = db.notes[id];
      if (!entry) return;
      entry.meta = { ...entry.meta, lastInteraction: now() };
      saveDb(db);
      return;
    }
    case "note_write_draft": {
      const id = String(args?.id ?? "");
      const content = String(args?.content ?? "");
      const entry = db.notes[id];
      if (!entry) throw new Error(`Note not found: ${id}`);
      if (entry.meta.storage !== "draft") throw new Error("Only drafts can be auto-saved.");
      const t = now();
      const { title, preview } = deriveTitlePreview(content);
      entry.content = content;
      entry.meta = { ...entry.meta, title, preview, lastInteraction: t };
      saveDb(db);
      return entry.meta;
    }
    case "note_save": {
      const id = String(args?.id ?? "");
      const content = String(args?.content ?? "");
      const entry = db.notes[id];
      if (!entry) throw new Error(`Note not found: ${id}`);
      if (entry.meta.storage !== "saved") throw new Error("Only saved notes can be saved with Cmd+S.");
      const t = now();
      const { title, preview } = deriveTitlePreview(content);
      entry.content = content;
      entry.meta = { ...entry.meta, title, preview, lastInteraction: t };
      saveDb(db);
      return entry.meta;
    }
    case "note_save_as": {
      const id = String(args?.id ?? "");
      const path = String(args?.path ?? "");
      const content = String(args?.content ?? "");
      const entry = db.notes[id];
      if (!entry) throw new Error(`Note not found: ${id}`);
      const t = now();
      const { title, preview } = deriveTitlePreview(content);
      entry.content = content;
      entry.meta = {
        ...entry.meta,
        title,
        preview,
        filePath: path || `web://saved/${id}.md`,
        storage: "saved",
        lastInteraction: t,
      };
      saveDb(db);
      return entry.meta;
    }
    case "note_import_file": {
      throw new Error("Open/Import is not supported in browser mode.");
    }
    case "note_trash": {
      const id = String(args?.id ?? "");
      const entry = db.notes[id];
      if (!entry) throw new Error(`Note not found: ${id}`);
      const t = now();
      entry.meta = {
        ...entry.meta,
        isTrashed: true,
        isPinned: false,
        trashedAt: t,
        lastInteraction: t,
      };
      saveDb(db);
      return entry.meta;
    }
    case "note_restore": {
      const id = String(args?.id ?? "");
      const entry = db.notes[id];
      if (!entry) throw new Error(`Note not found: ${id}`);
      const t = now();
      entry.meta = {
        ...entry.meta,
        isTrashed: false,
        trashedAt: null,
        sortOrder: nextSortOrder(db),
        lastInteraction: t,
      };
      saveDb(db);
      return entry.meta;
    }
    case "note_delete_forever": {
      const id = String(args?.id ?? "");
      delete db.notes[id];
      saveDb(db);
      return;
    }
    case "note_pin": {
      const id = String(args?.id ?? "");
      const pinned = Boolean(args?.pinned);
      const entry = db.notes[id];
      if (!entry) throw new Error(`Note not found: ${id}`);
      if (entry.meta.isPinned === pinned) return entry.meta;

      const activePinned = Object.values(db.notes)
        .map((n) => n.meta)
        .filter((m) => m.isPinned && !m.isTrashed);
      if (pinned && activePinned.length >= 5) throw new Error("You can only pin up to 5 notes.");

      const maxPinnedSort = activePinned.reduce((acc, m) => Math.max(acc, m.sortOrder), 0);
      const sortOrder = pinned ? maxPinnedSort + 1 : nextSortOrder(db);

      entry.meta = {
        ...entry.meta,
        isPinned: pinned,
        sortOrder,
        ...(pinned ? {} : { lastInteraction: now() }),
      };
      saveDb(db);
      return entry.meta;
    }
    case "notes_reorder": {
      const ids = (args?.ids as string[]) ?? [];
      for (let idx = 0; idx < ids.length; idx++) {
        const id = ids[idx]!;
        const entry = db.notes[id];
        if (!entry) continue;
        if (entry.meta.isTrashed) continue;
        entry.meta = { ...entry.meta, sortOrder: idx };
      }
      saveDb(db);
      return;
    }
    case "settings_get_all": {
      return { ...DEFAULT_SETTINGS, ...(db.settings ?? {}) };
    }
    case "settings_set": {
      const key = String(args?.key ?? "");
      const value = String(args?.value ?? "");
      const next: AppSettings = { ...DEFAULT_SETTINGS, ...(db.settings ?? {}) };
      if (key === "theme" && (value === "dark" || value === "light" || value === "system")) {
        next.theme = value;
      } else if (key === "expiry_minutes") {
        next.expiryMinutes = Number(value) || next.expiryMinutes;
      } else if (key === "trash_retention_days") {
        next.trashRetentionDays = Number(value) || next.trashRetentionDays;
      }
      db.settings = next;
      saveDb(db);
      return;
    }
    case "app_state_get_all": {
      return db.appState ?? {};
    }
    case "app_state_set": {
      const key = String(args?.key ?? "");
      const value = String(args?.value ?? "");
      db.appState = { ...(db.appState ?? {}), [key]: value };
      saveDb(db);
      return;
    }
    case "expiry_run_now": {
      const expiryMinutes = db.settings?.expiryMinutes ?? DEFAULT_SETTINGS.expiryMinutes;
      const cutoff = now() - Math.max(1, expiryMinutes) * 60_000;
      for (const entry of Object.values(db.notes)) {
        if (entry.meta.isTrashed) continue;
        if (entry.meta.isPinned) continue;
        if (entry.meta.lastInteraction > cutoff) continue;
        const t = now();
        entry.meta = { ...entry.meta, isTrashed: true, isPinned: false, trashedAt: t };
      }
      saveDb(db);
      return;
    }
    default: {
      throw new Error(`Unsupported command in browser mode: ${cmd}`);
    }
  }
}

export function ensureTauriInternalsShim() {
  if (typeof window === "undefined") return;
  type TauriInternals = {
    __augenblick_web?: boolean;
    invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    convertFileSrc?: (filePath: string) => string;
  };

  const w = window as Window & { __TAURI_INTERNALS__?: TauriInternals };
  if (w.__TAURI_INTERNALS__) return;

  w.__TAURI_INTERNALS__ = {
    __augenblick_web: true,
    invoke: invokeWeb,
    convertFileSrc: (filePath: string) => filePath,
  };
}

ensureTauriInternalsShim();
