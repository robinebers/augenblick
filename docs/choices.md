# Choices

## 2026-01-27
- Parity-first: keep Rust backend + command names; port UI to React only.
- Preserve `identifier: "com.sunstory.augenblick"` to reuse existing app data dir (`augenblick.db`, `drafts/`, `trash/`).
- UI kit: shadcn/ui v4 docs (`v4.shadcn.com`), Tailwind v4.
- Default tooling: Bun (match `../augenblick` scripts + macOS verify CI).
- Vite: manual chunk splits for Tiptap/ProseMirror/markdown (avoid single huge bundle).
- macOS file access: don’t trust dialog `fileAccessMode` on desktop; rely on security-scoped bookmarks in SQLite.
- React events: single global `keydown` listener + handler refs (`useEffectEvent`) to survive StrictMode; avoid hotkey libraries.
- Editor loading: lazy-load Tiptap editor (Suspense) to keep initial bundle small.
- Plan docs: keep `plans/migration.md` as index; detailed parity spec lives in `plans/migration.inventory.md` + `plans/migration.editor.md`; QA lives in `plans/migration.qa.md` (file size guardrail).
- shadcn base color: Neutral.
- Tests: add Vitest + jsdom harness; port store tests for notes/settings parity.
- Task lists: keep standard Markdown `- [ ]` / `- [x]`; no standalone `[ ]` auto-convert. Slash inserts standard task list item.
- Coverage: enforce 80% global thresholds; exclude `src/components/**`, `src/app/**`, `src/features/editor/**`, entrypoints, assets, and tests from coverage scope.
- Coverage provider: use `@vitest/coverage-v8@3.2.4` to match Vitest `3.2.4`.

## 2026-01-28
- Branch: `robinebers/macos-auto-update` for GH release/updater fixes.
- Editor markdown IO: `@tiptap/markdown` with `contentType: "markdown"`, GFM enabled, 2-space indentation.
- Links: `openOnClick: false` to prevent in-app navigation.
- Links: open on Cmd/Ctrl-click via editor `handleClick`.
- Code blocks: `CodeBlockLowlight` + `lowlight/lib/common` + `highlight.js` nord theme.
- Placeholder: Tiptap placeholder extension with "Start writing...".
- Link UI: bubble-menu inline URL input (no `window.prompt` in Tauri).
- Disable tables/images: remove Tiptap table/image extensions; keep raw markdown via `table`/`image` token handlers + `white-space: pre-wrap`.
- Link opening: use Tauri `plugin-opener` on Cmd/Ctrl-click; fallback to `window.open`.
- Paste: intercept plain-text paste and insert as markdown (`contentType: "markdown"`).

## 2026-01-29
- Expiry sync: run `expiry_run_now` before initial notes load; schedule next sweep at nearest unpinned note expiry to keep UI list in sync.
