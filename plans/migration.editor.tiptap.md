# Editor migration — Milkdown → Tiptap (OSS-only)

Last updated: 2026-01-28

Constraints (non-negotiable)
- no hacks, no custom editor functionality
- **official** open-source Tiptap packages only (MIT)
- keep notes as markdown on disk (`.md`) + in-memory `value: string`

---

## Current Milkdown implementation (what exists today)

Primary files
- `src/features/editor/Editor.tsx` (Milkdown editor + custom UI)
- `src/features/editor/TrashPreview.tsx` (read-only wrapper)
- `src/App.css` (Milkdown + custom UI CSS)
- `src/routes/pageHotkeys.ts` + `src/App.tsx` + `src-tauri/src/lib.rs` (find/replace wiring)
- `src/test/features/Editor.test.tsx` (Milkdown-heavy mocks)

Milkdown stack + bespoke behaviors (summary)
- markdown engine: `commonmark` + `gfm` presets; output saved as markdown
- plugins: prism highlight, history, link tooltip, image block, table block
- custom ProseMirror plugin:
  - paste: parse clipboard `text/plain` as markdown slice (except inside code)
  - task toggle: click hitbox on `li[data-item-type="task"]` flips `checked` attr
- custom UI layers (all non-Tiptap/OSS and must be removed):
  - slash menu (`.mk-slash`) + keyboard nav
  - selection toolbar (`.mk-selection-toolbar`)
  - find/replace bar (`augenblick:*` window events)
  - block handle (`.mk-block-handle`)

---

## Target Tiptap stack (OSS)

Baseline packages (pin to same version)
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/markdown` (adds `contentType: 'markdown'` + `editor.getMarkdown()`)

Needed extensions (OSS)
- `@tiptap/extension-link`
- `@tiptap/extension-task-list` + `@tiptap/extension-task-item`
- `@tiptap/extension-table` + `@tiptap/extension-table-row` + `@tiptap/extension-table-cell` + `@tiptap/extension-table-header`
- `@tiptap/extension-image`
- optional-but-nice parity: `@tiptap/extension-placeholder` (“Start writing…”)

Explicitly dropped (by constraint)
- slash commands UI
- selection toolbar UI
- find/replace UI + match navigation
- custom paste-as-markdown behavior
- custom task-checkbox hitbox toggle
- Milkdown-specific tooltips (link preview/edit UI, table controls)

---

## Migration plan (phased, low-risk)

### Phase 0 — Lock scope + update docs
- confirm “drop list” above accepted (README/features + shortcuts will change)
- add short note in `README.md`: editor = Tiptap; no find/replace, no slash menu

### Phase 1 — Add Tiptap deps (no runtime swap yet)
- add Tiptap packages (single version line)
- keep Milkdown deps temporarily (easy rollback while swapping component)

### Phase 2 — Implement new Editor (markdown-in/out)
- rewrite `src/features/editor/Editor.tsx` using `useEditor` + `<EditorContent />`
- editor config:
  - `extensions: [StarterKit, Markdown, …]`
  - `content: value`, `contentType: 'markdown'`
  - `editable: !readOnly`
  - `onUpdate`: `onChange(editor.getMarkdown())` (guard readOnly + avoid noop loops)
- prop sync:
  - if `value` changes externally, `editor.commands.setContent(value, false, { contentType: 'markdown' })`
  - keep `lastMarkdownRef`-style guard to avoid round-trip “format churn”
- styling:
  - remove Milkdown theme import
  - keep `.ProseMirror` typography rules; add/adjust selectors for Tiptap task items (`data-type="taskItem"`, `data-checked`)

### Phase 3 — Remove find/replace plumbing
- delete editor `window.addEventListener("augenblick:*")` wiring
- remove hotkeys in `src/routes/pageHotkeys.ts` for Cmd+F / Cmd+G
- remove App menu listeners in `src/App.tsx`
- remove Edit menu items + emitters in `src-tauri/src/lib.rs`
- delete related CSS (`.mk-*` + find/replace bar styles if present)

### Phase 4 — Tests
- replace `src/test/features/Editor.test.tsx` (Milkdown mocks) with:
  - mounts Editor; verifies `readOnly` blocks edits
  - typing updates calls `onChange` with markdown (smoke, not deep PM assertions)
  - prop update swaps content without double-calling `onChange`
- keep `TrashPreview` test as-is (still valid)

### Phase 5 — Remove Milkdown + cleanup
- remove Milkdown deps from `package.json` + lockfiles
- remove remaining `.milkdown-*` CSS blocks + unused prism theme import if no longer used
- run `npm test` + `npm run build`

---

## Risks / gotchas
- markdown re-serialization diffs (indentation, table formatting) → mitigate with:
  - `@tiptap/markdown` indentation config (spaces, size=2)
  - do not call `onChange` on mount; only on actual edits
- link clicking in Tauri:
  - safest default: `Link.configure({ openOnClick: false })` (avoid navigating webview)
  - if “open link externally” desired later → would require custom handling (out-of-scope per constraint)

