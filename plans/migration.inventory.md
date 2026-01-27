# Augenblick (current app) — parity inventory
Last updated: 2026-01-27
Purpose
- behavior spec for React rewrite; must match (quirks included)
- editor deep spec: `plans/migration.editor.md`
- QA gate: `plans/migration.qa.md`
Primary code truth
- Frontend: `../augenblick/src/routes/+layout.svelte`, `../augenblick/src/routes/+page.svelte`
- Stores: `../augenblick/src/lib/stores/notes.ts`, `../augenblick/src/lib/stores/settings.ts`
- Editor: `../augenblick/src/lib/components/Editor/Editor.svelte`
- Sidebar: `../augenblick/src/lib/components/Sidebar/Sidebar.svelte`
- Actions/hotkeys: `../augenblick/src/routes/pageActions.ts`, `../augenblick/src/routes/pageHotkeys.ts`
- Tauri: `../augenblick/src-tauri/src/lib.rs`, `../augenblick/src-tauri/src/commands.rs`
- Rust notes: `../augenblick/src-tauri/src/notes/*`, `../augenblick/src-tauri/src/scoped_file.rs`
- Window state/clamp: `../augenblick/src-tauri/src/window_state.rs`
- DB schema: `../augenblick/src-tauri/src/db.rs`
---
## Data model + persistence
`NoteMeta` (frontend, camelCase)
- `id,title,preview,filePath,storage,isPinned,isTrashed,sortOrder,createdAt,lastInteraction,trashedAt`
SQLite (`app_data_dir/augenblick.db`)
- schema version: `user_version = 1`
- `notes` columns
  - `id TEXT PRIMARY KEY`
  - `title TEXT NOT NULL`, `preview TEXT NOT NULL`
  - `file_path TEXT NOT NULL`
  - `storage TEXT NOT NULL` (`"draft"`/`"saved"`)
  - `bookmark BLOB` (macOS security-scoped bookmark; saved notes only)
  - `is_pinned INTEGER NOT NULL DEFAULT 0`
  - `is_trashed INTEGER NOT NULL DEFAULT 0`
  - `sort_order INTEGER NOT NULL`
  - `created_at INTEGER NOT NULL` (ms epoch)
  - `last_interaction INTEGER NOT NULL` (ms epoch)
  - `trashed_at INTEGER` (ms epoch, nullable)
- indices: `idx_notes_last_interaction`, `idx_notes_trashed_at`
- `app_state(key,value)` + `settings(key,value)`
App data dir layout (Tauri)
- `app_data_dir/`
  - `augenblick.db`
  - `drafts/<uuid>.md`
  - `trash/<uuid>.md`
  - `debug.log`

List ordering (backend truth)
- Active: `ORDER BY is_pinned DESC, sort_order ASC`
- Trashed: `ORDER BY trashed_at DESC, sort_order ASC`
---
## Derivations + formatting (string parity)
Title + preview derivation (Rust + web shim)
- take `content.lines().map(trim).filter(non-empty)`
- `first = next() || ""`
- `sanitize_heading(line)`:
  - trim **only** leading chars in `[# - > *]` (repeat) then `trim()`
- title
  - `sanitize_heading(first)`
  - if empty → `"New Note"`
  - else truncate to 80 chars
- preview
  - `preview_source = next() || first`
  - `sanitize_heading(preview_source)`
  - compact whitespace to single spaces
  - truncate to 140 chars

Relative time formatting (frontend truth; no Intl)
- `formatRelativeTime(fromMs, toMs=Date.now())`
  - `<10s` → `"just now"`
  - `<60s` → `"{s}s ago"`
  - `<60m` → `"{m}m ago"`
  - `<24h` → `"{h}h ago"`
  - else `"{d}d ago"`
- `formatRelativeTimeFromNow(targetMs, nowMs=Date.now())` (ceil rounding)
  - `<=0` → `"now"`
  - `<10s` → `"in a moment"`
  - `<60s` → `"in {s}s"`
  - `<60m` → `"in {m}m"`
  - `<24h` → `"in {h}h"`
  - else `"in {d}d"`

Where used
- sidebar NoteItem subtitle: `formatRelativeTime(note.lastInteraction)`
- expiry ring tooltip: `Trashed ${formatRelativeTimeFromNow(expiryAt)}`
- trash item subtitle: `Deletes ${formatRelativeTimeFromNow(deleteAt)}`
---
## Note lifecycle
Create note
- backend creates draft file empty + inserts row
  - `storage=draft`, `file_path=.../drafts/<uuid>.md`
  - `created_at=last_interaction=now`
  - `sort_order = max(unpinned active sort_order)+1`
- frontend selects immediately; forces `viewMode="notes"`; caches `contentById[id]=""`
- calls `note_set_active(id)` after create

Select note
- sets `selectedId`
- if note is in trashed list (snapshot), forces `viewMode="trash"` immediately
- content load: single-load cache
  - if `contentById[id]` is already string → skip `note_get`
  - else `note_get(id)` then cache `contentById[id]=content`
- always calls `note_set_active(id)` after select (even when using cached content)
- if `note_get` returns `meta.isTrashed=true`, forces `viewMode="trash"` even if you were in notes view
- heartbeat: every 30s calls `note_set_active(selectedId)` even when window unfocused (best-effort; logs console errors)

App-state persistence quirk
- `selectedNoteId` is only written when non-null → never cleared in SQLite
- writes debounced ~250ms; keys: `sidebarWidth`, `selectedNoteId` (only if non-null), `viewMode`
- on boot: if stored id not in active/trashed lists, UI clears `selectedId` in memory (but does not rewrite app_state)

Draft autosave (frontend)
- per-note debounce timer (`Map<id, timeout>`)
- on edit: schedules `note_write_draft(id, content)` after 500ms idle
- disabled for trashed notes
- on save-as/delete/clear-trash: clears any pending draft timer for that id

Saved edits (frontend)
- edits never write to disk automatically
- editing saved + active note sets `dirtySavedById[id]=true`
- `dirtySavedById` cleared on Save, trash, delete forever, clear trash

Save behaviors
- Cmd+S on draft → Save As… flow
- Cmd+S on saved → `note_save(id, content)` (writes file at stored path via bookmark)
- Save As…
  - file dialog title `"Save Note"`
  - defaultPath `${title || "Note"}.md`
  - forces `.md` extension by appending if missing
  - backend `note_save_as` converts draft→saved and deletes the old draft file (best-effort)

Import markdown file (“Open…”)
- file dialog options: filters `Markdown (*.md)`, `multiple:false`, `directory:false`, `fileAccessMode:"scoped"`
- single-flight: ignores repeated Open while dialog active
- backend import
  - reads file via `with_scoped_file(path, None, read_file)`
  - resolves effective path (bookmark resolved path may differ) and may persist it
  - if note already exists (match on original path, else effective path):
    - if trashed: restore (draft: move file back; saved: clear trashed flags)
    - if saved: update bookmark (if refreshed) + update file_path to effective path
    - update title/preview/last_interaction + `note_set_active`
  - else create new saved note (bookmark maybe set) with `sort_order = max(unpinned active)+1`

---
## Pinning + ordering
Pin/unpin (backend truth)
- max 5 pinned notes (error: `"You can only pin up to 5 notes."`)
- pin
  - sets `is_pinned=1`
  - sets `sort_order = max(pinned sort_order)+1`
  - does **not** change `last_interaction`
- unpin
  - sets `is_pinned=0`
  - sets `sort_order = max(unpinned active sort_order)+1`
  - resets `last_interaction=now` (fresh expiry window)

Reorder (frontend + backend)
- two independent sections: `pinned` and `notes` (unpinned)
- frontend sends `notes_reorder(ids)` with ids for that section only
- backend transaction: `UPDATE notes SET sort_order = idx WHERE id=? AND is_trashed=0`
- undo/redo stacks (depth 20), only for reorders; Cmd+Z / Cmd+Shift+Z when not typing

Selection move hotkeys (Cmd/Ctrl+Shift+ArrowUp/Down)
- notes view: list = pinned first then unpinned
- trash view: list = trashed list
- clamp at ends (no wrap)

---
## Trash + retention
Trash action (“Move to Trash”)
- default close behavior; no confirm unless dirty saved note
- backend trash
  - sets `is_trashed=1`, `trashed_at=now`, `is_pinned=0`
  - does **not** change `last_interaction`
  - idempotent if already trashed (returns meta unchanged)
  - draft: moves file into app `trash/` dir and updates `file_path`
  - saved: does not touch user file; only DB row
- frontend trash
  - clears `dirtySavedById[id]`
  - if trashing currently selected note: sets `selectedId=null` (note closes)
  - does not clear cached content
  - quirk: Cmd+W while viewing an already-trashed note just “closes” it (clears selection) but still shows “Moved to Trash” toast

Restore
- backend restore
  - sets `is_trashed=0`, `trashed_at=NULL`
  - draft: moves file back `trash/` → `drafts/` and updates `file_path`
  - does **not** change `last_interaction`
- frontend restore
  - does not change `selectedId` (so restoring the selected trashed note immediately opens it in editor)
  - forces `viewMode="notes"`

Delete forever
- confirm dialog (custom): title `"Delete forever?"`, description `"This cannot be undone."`, confirmText `"Delete"`, cancelText `"Cancel"`, destructive
- backend: deletes row; draft also deletes local file (best-effort); saved never deletes user file
- frontend:
  - clears pending autosave timer
  - removes content cache + dirty flag
  - clears selection if selected

Clear trash
- confirm dialog (custom): title `"Clear trash?"`, description `"Permanently delete {n} note(s)?"`, confirmText `"Clear trash"`, cancelText `"Cancel"`, destructive
- frontend deletes each trashed note via `note_delete_forever` (sequential) then clears list.trashed locally
- stays in trash view mode after clearing (no auto-switch)

Trash view UI strings
- empty state: `"Trash is empty"`
- list subtitle: `"Deletes ${formatRelativeTimeFromNow(deleteAt)}"` where `deleteAt = trashedAt + max(1, trashRetentionDays)*86400000`
- footer buttons: `"Empty Trash"` (disabled if empty), `"Back to Notes"`

---
## Expiry ring + auto-retention
Auto sweeper (Rust thread)
- background thread; runs every 60s
- reads settings each sweep: `expiry_days`, `trash_retention_days`
- auto-trash
  - query: unpinned active notes with `last_interaction <= now - expiry_days`
  - calls `notes::trash` (same behavior as manual trash)
- auto-delete
  - query: trashed notes with `trashed_at <= now - trash_retention_days`
  - deletes DB row; draft also deletes local file at `file_path`

Expiry ring UI
- visible only for active, unpinned notes
- progress: `clamp01(1 - elapsed/total)` where total = `max(1, expiryDays)*86400000`
- thresholds (percent remaining): fresh ≥50, aging ≥25, warning ≥10, danger <10
- tooltip: `"Trashed ${formatRelativeTimeFromNow(expiryAt)}"`
- update cadence: recompute `now` every 60s (setInterval)

---
## UI shell + strings
App shell
- sidebar width default 260; clamp 200–400
- resize handle: mouse drag + keyboard ArrowLeft/ArrowRight (10px steps)

Main pane
- no selection: icon + text `"Press ⌘N to create a note"`
- selection not loaded: `"Loading note…"`
- selected active: editor
- selected trashed: read-only editor preview

Editor
- see: `plans/migration.editor.md` (Milkdown config + slash/selection/find/replace + paste/task quirks)

Sidebar UI
- headings: `"PINNED"`, `"NOTES"`, `"TRASH"`
- footer buttons (notes view): `"New Note"`, `"Trash"` (+ count badge)
- footer buttons (trash view): `"Empty Trash"`, `"Back to Notes"`
- trash row hover actions
  - restore button aria-label `"Restore"`
  - delete button aria-label `"Delete forever"`

Command palette
- dialog max width ~520; list max height ~320
- input placeholder: `"Type a command or search…"`
- group headings: `"Commands"`, `"Notes"`
- commands:
  - New Note (⌘N), Pin / Unpin Current (⌘P), Save (⌘S), Save As… (⇧⌘S), Open… (⌘O), Settings (⌘,), Trash (⌘W)
- empty: `"No results found."`

Toasts
- Toaster layout: bottom-right; `expand=true`, `richColors=true`, `closeButton=true`
- Sonner theme uses `mode-watcher` (`theme={mode.current}`)
- class overrides via `toastOptions.classes` (toast/description/action/cancel)

Dialogs (custom)
- app-owned `openDialog/confirmDialog`, single-flight (new dialog cancels prior with cancelId or `"cancel"`)
- “Trash note?” (dirty saved close): `"Save changes before moving this note to Trash?"` + Save / Don't Save / Cancel
- “Quit Augenblick?” (close window): `"You have unsaved changes in {n} note(s)."` + Save / Don't Save / Cancel

Settings dialog
- title: `"Settings"`
- description: `"Preferences for appearance, expiry, and trash."`
- size: max width 380; closes on outside click + overlay pointerdown
- Appearance: Light/Dark/System (active button styled “secondary”)
- Note Expiry: select options 1/3/7/14/30 days (default 7), caret `"⌄"`
- Trash Retention: select options 7/14/30/60/90 days (default 30), caret `"⌄"`
- Theme default: `"dark"`; `"system"` uses matchMedia watcher; toggles root `.dark`/`.light`

---
## Hotkeys (global)
- Cmd/Ctrl+N: new note
- Cmd/Ctrl+K: command palette
- Cmd/Ctrl+,: settings
- Cmd/Ctrl+O: open/import markdown
- Cmd/Ctrl+S: save (draft → Save As)
- Cmd/Ctrl+Shift+S: save as
- Cmd/Ctrl+W: move to Trash (“close note”)
- Cmd/Ctrl+P: pin/unpin current
- Cmd/Ctrl+Shift+ArrowUp/ArrowDown: move selection (notes view: pinned→notes; trash view: trashed list)
- Delete/Backspace (when not typing): move to Trash
- Escape: close command palette; if in Trash view → back to Notes
- Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z (when not typing): undo/redo reorder
- Cmd/Ctrl+F: find; Cmd/Ctrl+Alt+F: replace
- Cmd/Ctrl+G: find next; Cmd/Ctrl+Shift+G: find prev

Typing target guard
- hotkeys suppressed when target is `input`, `textarea`, or `[contenteditable='true']`

---
## Tauri window + menus + permissions
Titlebar drag region
- only on desktop (`hasRealTauri()`)
- window config (Tauri): title `"Augenblick"`, default size 800×600, `dragDropEnabled:false`, `hiddenTitle:true`, `titleBarStyle:"Overlay"`
- CSS: `.tauri-titlebar-drag-region { position:fixed; left:80px; right:0; top:0; height:52px; z-index:70 }`
- `--titlebar-inset = 38px` in desktop mode; `0px` in shim/web mode
- mousedown handler
  - ignore non-left click (`e.buttons !== 1`)
  - double click (`e.detail===2`) → `toggleMaximize()`
  - else `startDragging()`
- `data-tauri-drag-region` attribute: does not inherit to children

Menus (labels + accelerators) + emitted events
- App
  - `"Settings…"` (CmdOrCtrl+Comma) → `menu-settings`
  - Quit (predefined)
- File
  - `"New Note"` (CmdOrCtrl+KeyN) → `menu-new-note`
  - `"Open…"` (CmdOrCtrl+KeyO) → `menu-open-markdown`
  - `"Save"` (CmdOrCtrl+KeyS) → `menu-save`
  - `"Save As…"` (CmdOrCtrl+Shift+KeyS) → `menu-save-as`
  - `"Move to Trash"` (CmdOrCtrl+KeyW) → `menu-trash`
- Edit
  - `"Find…"` (CmdOrCtrl+KeyF) → `menu-find`
  - `"Find and Replace…"` (CmdOrCtrl+Alt+KeyF) → `menu-replace`
  - `"Find Next"` (CmdOrCtrl+KeyG) → `menu-find-next`
  - `"Find Previous"` (CmdOrCtrl+Shift+KeyG) → `menu-find-prev`
- View
  - `"Toggle Developer Tools"` (CmdOrCtrl+Alt+KeyI) → open/close devtools directly (no event)
  - fullscreen item: `"Enter Full Screen"`
- Window
  - predefined minimize/maximize/close

Capabilities (Tauri 2)
- `capabilities/default.json` (main window)
  - `core:default`
  - `core:window:allow-start-dragging`
  - `core:window:allow-toggle-maximize`
  - `dialog:default`
  - `opener:default`
- `capabilities/desktop.json` (desktop only)
  - `window-state:default`

Security/CSP
- current CSP is permissive (`'unsafe-inline'` + `'unsafe-eval'`); keep parity first, tighten later

Window state persistence + clamp
- restore on launch: `window.restore_state(StateFlags::all())` (ignore errors)
- clamp algorithm
  - uses window outer position/size
  - picks monitor by window center, else current, else primary
  - clamps size to monitor bounds (never larger than monitor)
  - clamps position so window is fully on-screen
  - saves sanitized state: `app.save_window_state(StateFlags::all())`

Close-window prompt (frontend)
- `getCurrentWindow().onCloseRequested`
- if no dirty saved notes → allow close
- else preventDefault; show dialog “Quit Augenblick?” (Save / Don't Save / Cancel)
- single-flight guard: `isClosing` prevents double prompts

IPC commands (Rust `invoke`)
- `notes_list`, `note_create`, `note_get`, `note_set_active`, `note_write_draft`, `note_save`, `note_save_as`, `note_import_file`, `note_trash`, `note_restore`, `note_delete_forever`, `note_pin`, `notes_reorder`, `settings_get_all`, `settings_set`, `app_state_get_all`, `app_state_set`, `expiry_run_now`

---
## macOS security-scoped bookmarks + logging
Scoped file behavior (`with_scoped_file`)
- non-macOS: direct filesystem ops; no bookmark; no resolved path
- macOS:
  - rejects non-UTF8 path (errors + logs)
  - if bookmark exists:
    - resolve with `WithSecurityScope|WithoutUI|WithoutMounting`
    - if stale → refresh bookmark
  - if no bookmark:
    - build file URL from path; wants bookmark refresh
  - calls `startAccessingSecurityScopedResource()`; logs if returns false (still runs op)
  - if resolved path differs from input path:
    - returns `resolved_path` and forces bookmark refresh
  - bookmark refresh failure behaviors:
    - if `had_bookmark=false` → fail loud
    - if `had_bookmark=true` and `started=true` → fail loud
    - else ignore refresh failure

Bookmark/path persistence
- after read/write, backend may update DB via `apply_scoped_updates(bookmark?, resolved_path?)`

Debug logging
- `AUGENBLICK_LOG_PATH` set to `app_data_dir/debug.log` at startup
- `read_file` logs rich metadata (exists/file/dir/symlink/size/err.kind) to stderr + debug.log
- `scoped_file` logs stages (`resolve_bookmark`, `start_access`, `op_failed`, `refresh_bookmark`) to debug.log

---
## Web (non-Tauri) shim mode
`src/lib/tauri/shim.ts`
- installs `window.__TAURI_INTERNALS__` with `invoke(cmd,args)` backed by `localStorage`
- storage key: `augenblick:webdb:v1`
- marks shim: `__TAURI_INTERNALS__.__augenblick_web=true` so `hasRealTauri()` returns false
- Open/Import markdown not supported in shim mode (throws)
