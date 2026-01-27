# Choices

## 2026-01-27
- Parity-first: keep Rust backend + command names; port UI to React only.
- Preserve `identifier: "com.sunstory.augenblick"` to reuse existing app data dir (`augenblick.db`, `drafts/`, `trash/`).
- UI kit: shadcn/ui v4 docs (`v4.shadcn.com`), Tailwind v4.
- Default tooling: Bun (match `../augenblick` scripts + macOS verify CI).
- Vite: manual chunk splits for Milkdown/ProseMirror/markdown (avoid single huge bundle).
- macOS file access: don’t trust dialog `fileAccessMode` on desktop; rely on security-scoped bookmarks in SQLite.
- React events: single global `keydown` listener + handler refs (`useEffectEvent`) to survive StrictMode; avoid hotkey libraries.
- Editor loading: lazy-load Milkdown editor (Suspense) to keep initial bundle small.
- Plan docs: keep `plans/migration.md` as index; detailed parity spec lives in `plans/migration.inventory.md` + `plans/migration.editor.md`; QA lives in `plans/migration.qa.md` (file size guardrail).
- shadcn base color: Neutral.
- Tests: add Vitest + jsdom harness; port store tests for notes/settings parity.
- Task lists: keep standard Markdown `- [ ]` / `- [x]`; no standalone `[ ]` auto-convert. Slash inserts standard task list item.
- Coverage: enforce 80% global thresholds; exclude `src/components/**`, `src/app/**`, `src/features/editor/**`, entrypoints, assets, and tests from coverage scope.
- Coverage provider: use `@vitest/coverage-v8@3.2.4` to match Vitest `3.2.4`.
