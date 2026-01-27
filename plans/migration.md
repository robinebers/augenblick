# Augenblick → React migration plan

Last updated: 2026-01-27

Goal

- React rewrite of `../augenblick` (Tauri 2 + Svelte 5) with **complete feature parity**
- **No Svelte / bits-ui** in final codebase
- UI: same layout + feel; upgraded implementation via **shadcn/ui v4** (docs: `v4.shadcn.com`)

Definition of done

- Feature parity vs `../augenblick` (behavior + shortcuts + menus + data model)
- No `svelte`, `@sveltejs/*`, `bits-ui`, `svelte-*` deps
- UI matches pixel-for-pixel (allowed: subtle polish, not layout changes)
- shadcn/ui v4 CLI + components used everywhere
- Tauri permissions/capabilities parity (drag window, maximize, dialogs, window-state, opener)
- Icons + bundle config parity (macOS + Windows + Linux)
- Existing user data preserved (same app identifier → same app data dir)

Source-of-truth (read this first)

- Frontend shell + behaviors: `../augenblick/src/routes/+layout.svelte`, `../augenblick/src/routes/+page.svelte`
- Hotkeys: `../augenblick/src/routes/pageHotkeys.ts`
- Page actions (dialogs, open/save, trash): `../augenblick/src/routes/pageActions.ts`
- Notes store (timers, caching, reorder undo/redo): `../augenblick/src/lib/stores/notes.ts`
- Settings store (theme/system watcher): `../augenblick/src/lib/stores/settings.ts`
- Editor (Milkdown config + find/replace): `../augenblick/src/lib/components/Editor/Editor.svelte`
- Sidebar (dnd, sections): `../augenblick/src/lib/components/Sidebar/Sidebar.svelte`
- Dialog system (single-flight, AlertDialog host): `../augenblick/src/lib/components/ui/dialog/dialog.ts`, `../augenblick/src/lib/components/ui/dialog/DialogHost.svelte`
- Tauri menus + emitted events: `../augenblick/src-tauri/src/lib.rs`
- Tauri commands + persistence: `../augenblick/src-tauri/src/commands.rs`, `../augenblick/src-tauri/src/db.rs`, `../augenblick/src-tauri/src/notes/*`, `../augenblick/src-tauri/src/expiry.rs`
- Tauri window state + clamp: `../augenblick/src-tauri/src/window_state.rs`
- Capabilities/permissions: `../augenblick/src-tauri/capabilities/*.json`, `../augenblick/src-tauri/tauri.conf.json`
- Visual tokens: `../augenblick/src/app.css`
- Historical decisions/quirks: `../augenblick/docs/choices.md`
- App icon source/config (if you regenerate icons): `../augenblick/resources/app-icon.icon/icon.json` + `../augenblick/resources/exports/*`

---

## 1) Parity inventory

- Living behavior spec: `plans/migration.inventory.md`
- Editor deep spec: `plans/migration.editor.md`

---

## 2) Target architecture (React)

Guiding principles

- keep Rust backend as-is initially (fastest parity; preserves data)
- mirror Svelte module boundaries 1:1 first; refactor later
- prefer small, explicit state machines; avoid “smart” abstractions

Suggested module map

- `src/lib/api.ts` (typed Tauri `invoke` wrapper; same command names)
- `src/lib/tauri/runtime.ts` (desktop detection; optional web shim later)
- `src/stores/notesStore.ts` (Zustand or equivalent)
- `src/stores/settingsStore.ts`
- `src/stores/dialogStore.tsx` (promise-based `openDialog/confirmDialog` + host component)
- `src/app/AppShell.tsx` (layout; titlebar drag region; Toaster; DialogHost)
- `src/features/sidebar/*` (Sidebar, NoteItem, TrashItem, ExpiryRing)
- `src/features/editor/Editor.tsx` (Milkdown)
- `src/features/command/CommandPalette.tsx`
- `src/features/settings/SettingsDialog.tsx`
- `src/routes/pageActions.ts` + `src/routes/pageHotkeys.ts` (ported as pure functions/hooks)

State parity requirements (notesStore)

- app_state persistence: sidebarWidth, selectedNoteId, viewMode (debounce 250ms)
- draft autosave timers per note id (debounce 500ms)
- dirtySavedById tracking for saved+active notes only
- reorder undo/redo stacks per section, depth 20
- cached content by id; `note_get` only once per id (unless manual refresh added later)

UI parity requirements (React)

- reuse CSS vars + values from `../augenblick/src/app.css`
- keep exact sizing
  - sidebar default 260; clamp 200–400
  - titlebar inset 38; drag region height 52; drag region left inset 80
  - editor max width 720; sidebar padding, typography
- replicate “no confirm” trash behavior for non-destructive closes

shadcn/ui v4 requirements

- Use v4 docs + CLI (`v4.shadcn.com/docs/cli`)
- Tailwind v4 support: verify whether `shadcn@latest` is sufficient; otherwise use `shadcn@canary` per Tailwind v4 docs
- Use shadcn primitives for: dialog/alert-dialog, button, select, command, tooltip, toast/sonner
- No custom bespoke components where shadcn exists (wrap allowed to match styling)

React perf + event handling (Vercel React Best Practices)

- Heavy components: lazy-load Milkdown editor (code-split) and mount only when a note is selected.
- Avoid barrel imports in hot paths; import direct (`bundle-barrel-imports`).
- Optional polish: preload editor chunk on hover/select to reduce perceived delay (`bundle-preload`).
- Global listeners: exactly 1 `window.keydown` handler; stable subscription via `useEffectEvent` (React 19) or handler-in-ref pattern.
- Store reads: don’t subscribe just to read inside callbacks; prefer `notesStore.getState()` in key/menu handlers to avoid render cascades.
- Tauri listeners: ensure `listen()` unlisten cleanup is idempotent (handles React StrictMode double-mount in dev).

Tauri security (no local skill found; follow Tauri docs)

- Capabilities: keep minimal; explicitly allow only needed `core:window:*`, `dialog:*`, `window-state:*`, etc.
- IPC trust boundary: treat frontend as untrusted; validate `path` inputs in Rust commands (`save_as`, `import_file`, etc.) and fail loud.
- Command scopes exist (allow/deny); for app-defined commands you must enforce scope checks inside command implementation (consider for path-based commands on non-macOS platforms).
- CSP: start parity-first (current app uses permissive CSP); after parity, tighten per Tauri CSP docs and remove `'unsafe-eval'` if possible.
- Window state: plugin docs recommend creating window with `visible:false` to avoid “flash” before restore; consider post-parity (or if it doesn’t change perceived behavior)
- Titlebar: follow Tauri v2 “Window Customization” docs (`data-tauri-drag-region` + required capabilities) and keep drag region minimal to avoid mouseup/focus quirks on Windows

---

## 3) Migration phases (detailed checklist)

### Phase 0 — Baseline capture (1–2h)

- Build/run `../augenblick` (local) and record:
  - screenshots: empty state, note selected, command palette, settings, trash view
  - short screen recording: create→type→autosave→trash→restore→expiry ring hover
- export hotkey list + menu list (already in code; verify in app)
- verify pin limit UI behavior (backend error → toast)
- confirm restore ordering behavior (Rust keeps prior sort_order; decide if keep)

### Phase 1 — Port Tauri backend (preserve data) (0.5–1d)

- Copy `../augenblick/src-tauri/src/`** → `src-tauri/src/**` (React repo)
- Copy `../augenblick/src-tauri/Cargo.toml` deps (dialog + window-state + rusqlite + objc2*)
  - keep `tauri` crate `features = ["devtools"]` if you want the in-app “Toggle Developer Tools” menu to work
- Copy `../augenblick/src-tauri/capabilities/*`* (merge with existing)
- Copy `../augenblick/src-tauri/tauri.conf.json` and adjust:
  - `build.frontendDist` to React output (`../dist`)
  - keep window settings: `dragDropEnabled:false`, `hiddenTitle:true`, `titleBarStyle:"Overlay"`
  - keep `productName: "Augenblick"` + window title capitalization (matches app/dmg naming)
  - keep CSP (or tighten later; start parity-first)
- Copy `../augenblick/src-tauri/Entitlements.plist`, `Info.plist`, `tauri.appstore.conf.json`
  - entitlements parity: App Sandbox + user-selected read/write + bookmarks app-scope
- Icons: copy full `../augenblick/src-tauri/icons/**` over
- App icon sources (optional): copy `../augenblick/resources/app-icon.icon/**` + `../augenblick/resources/exports/**` for future icon regeneration/marketing assets
- Sanity: `cargo check` (via `tauri dev`) and confirm commands register

### Phase 2 — React + Tailwind v4 + shadcn v4 scaffold (0.5–1d)

- Decide package manager (default: Bun for parity with `../augenblick` scripts + CI)
- Add Tailwind v4 (match old tokens approach)
  - move/replace `src/App.css` with ported `app.css` tokens + Milkdown styles
  - ensure fonts: Geist Sans + JetBrains Mono Variable
- Initialize shadcn/ui v4
  - `shadcn@latest init` (v4 docs) or `shadcn@canary init` if Tailwind v4 requires it
  - commit `components.json` + base styles
  - Add needed components: Button, Dialog, AlertDialog, Select, Command, Tooltip, Sonner
- Add `lucide-react` icons + wrapper `Icon` component (same icon names)
- Port static assets: favicon + any app icons needed by `index.html` / `public/`
- Vite build perf: port manual chunk splitting for Milkdown/ProseMirror/markdown deps (see `../augenblick/vite.config.js`)
  - dev server parity for Tauri: `port:1420`, `strictPort:true`, `clearScreen:false`, ignore `src-tauri/**`, HMR host via `TAURI_DEV_HOST` (ws port 1421)
- CI (optional but recommended): port `../augenblick/.github/workflows/verify.yml` equivalent for React repo

### Phase 3 — Data layer + stores (1–2d)

- Implement `api` wrapper (same commands as Svelte app)
- Implement `notesStore` parity
  - init: load `notes_list` + `app_state_get_all`; hydrate sidebarWidth/viewMode/selectedId
  - guard: clear selectedId if not present in either list
  - select(id): cached content short-circuit; else `note_get`; force trash view if trashed
  - createNote(): `note_create` + set selected + setActive
  - updateContent(): cache; draft autosave timer; saved dirty tracking
  - save/saveAs/saveAllDirty/import/trash/restore/deleteForever/clearTrash
  - pin: `note_pin` error propagation (toast at callsite)
  - reorder + undo/redo stacks (depth 20) + refresh after persist
  - heartbeatSelected() every 30s
- Implement `settingsStore` parity (theme + system watcher)
- Implement `dialogStore` parity (`openDialog/confirmDialog` returning Promise)
  - dialog single-flight: opening a new dialog auto-resolves the previous one with its `cancelId` (prevents stranded Promises)

### Phase 4 — UI build (React) (2–4d)

- AppShell
  - titlebar drag region (desktop only) + `--titlebar-inset` handling
  - Toaster + DialogHost mount once
- Sidebar + sections
  - pinned + notes sections
  - dnd reorder (recommend `@dnd-kit/*`) with drop indicator line
  - NoteItem: title + relative time + expiry ring (unpinned only)
  - Trash view: TrashItem with hover actions + “Deletes in …”
  - Footer buttons: New Note, Trash toggle, Empty Trash, Back to Notes
- Sidebar resize handle (mouse drag + keyboard arrows)
- Editor (Milkdown) parity
  - React integration (Milkdown core, not a wrapper until parity done)
  - lazy-load editor bundle (Suspense) to keep initial bundle small
  - port custom find/replace bar UI + matching behavior
  - port slash menu + selection toolbar + task toggle + paste parser behavior
  - readOnly mode for trashed note preview
- Command palette (Dialog + Command)
  - focus input on open
  - close on Escape + backdrop click
  - commands + notes groups
- Settings dialog parity
  - theme segmented control
  - selects with exact option sets

### Phase 5 — Tauri integration parity (1–2d)

- Menu events
  - `@tauri-apps/api/event.listen` for menu-* events; wire to same handlers
  - editor events: dispatch `augenblick:`* window events for find/replace/next/prev
- Window close prompt
  - onCloseRequested: if dirty saved notes exist → dialog “Quit Augenblick?” with Save/Don’t Save/Cancel
  - Save path saves all dirty notes, then closes window
- Capabilities verification
  - startDragging + toggleMaximize permitted
  - dialog open/save options parity (filters, defaultPath; keep `fileAccessMode:"scoped"` flag but rely on bookmark flow on macOS)
  - window-state plugin enabled + restore/clamp on startup
- Security follow-ups (post-parity)
  - tighten CSP per Tauri docs (reduce inline/eval allowances)
  - re-audit capabilities: remove unused permissions
  - Rust hardening: validate/save paths (canonicalize when safe), enforce `.md` where appropriate, and ensure no path traversal on non-macOS platforms

### Phase 6 — Parity tests + QA (1–3d)

- Port/replace unit tests from `../augenblick/src/test/**`
  - store tests: autosave, dirty tracking, view mode, reorder undo/redo
  - hotkeys tests: typing-target guard, navigation, editor event emits
  - actions tests: open/save/trash confirm flows
- Run manual QA checklist: `plans/migration.qa.md`
- Optional: screenshot baseline tests (only if fast; otherwise manual)

### Phase 7 — Cleanup + hard DoD checks (0.5–1d)

- Remove template code (greet, etc)
- Ensure no Svelte/bits-ui deps in `package.json` / lockfile
- Ensure all UI uses shadcn components (no leftover custom dialogs/select/tooltips)
- Verify Tauri build + macOS entitlements (App Sandbox + scoped bookmarks)
- Confirm data compatibility: existing `augenblick.db` reused; drafts/trash dirs reused

---

## 4) Manual QA checklist (parity gate)

- Checklist: `plans/migration.qa.md`

---

## 5) Risks / gotchas (track as they appear)

- macOS scoped bookmarks: must preserve `notes.bookmark` handling exactly (Rust side)
- `fileAccessMode` in Tauri dialog: treat as non-authoritative on desktop; rely on bookmark flow
- CSP: strictness might break Milkdown plugins or devtools; parity-first then tighten
- Restore ordering + timestamps: follow Rust (keeps prior `sort_order`; doesn’t bump `last_interaction` on restore/trash)
- App-state: `selectedNoteId` not cleared (reopen-trashed behavior)
- DnD feel: match Svelte dnd animation + shadow indicator line
- Milkdown React lifecycle: ensure editor destroyed/recreated on note id change (Svelte uses `{#key id}`)
- React StrictMode: dev double-mount can double-register listeners/timers; ensure cleanups are correct (or disable StrictMode)
- Link handling inside editor: verify click behavior in Tauri (open externally vs navigate inside webview); keep opener capability if needed
- Titlebar drag region: `position:fixed; z-index:70` overlay can steal clicks; keep `--titlebar-inset` + region geometry exact

