# Augenblick editor (Milkdown) — parity spec

Last updated: 2026-01-27

Source-of-truth

- `../augenblick/src/lib/components/Editor/Editor.svelte`
- `../augenblick/src/lib/components/Editor/TrashPreview.svelte`
- `../augenblick/src/app.css` (mk UI styling)

---

## Lifecycle + layout

Mount/destroy

- Svelte uses `{#key note.id}` → editor instance must be destroyed + recreated on note id change
- destroy must:
  - `slashProvider.destroy()`, `selectionToolbarProvider.destroy()`
  - remove `window.keydown` capture listener (slash nav)
  - `await editor.destroy()` once promise resolves

Layout + placeholder

- outer: `overflow-auto`, bg `var(--bg-primary)`
- inner: `max-w-[720px]`, `px-10`, `padding-top: var(--titlebar-inset, 0px)`, `padding-bottom:24px`
- placeholder `"Start writing..."` when `value.trim().length === 0`
  - absolute; `pointer-events:none`; color `var(--text-tertiary)`

Read-only mode (trash preview)

- Trash preview = `<Editor readOnly value={content} onChange={noop} />`
- behavior requirements
  - no editing
  - find works; replace UI suppressed
  - task checkbox click disabled
  - slash commands disabled (guarded by `readOnly`)

---

## Milkdown stack (parity)

- `.config(nord)`
- `.use(listener)`
- `.use(commonmark)` + `.use(gfm)` + `.use(prism)`
- `.use(prose(new Plugin({ key:"editor-interactions", props:{ … } })))`
  - `handlePaste`: if clipboard `text/plain` and selection not in code block → preventDefault; `parser(text)`; if slice → `replaceSelection(slice)`
  - `handleClickOn`: task list checkbox toggle
    - node type `list_item` with `checked` attr
    - only left mouse button; `li[data-item-type='task']`
    - hit target: `event.clientX - rect.left <= 22`
    - toggles `checked` via `tr.setNodeMarkup(nodePos, …)`
- `.use(history)`
- `.use(block)` (BlockProvider exists but hidden by CSS; plus-action inserts `/`)
- `.use(slash)` (custom `SlashProvider` content)
- `.use(selectionToolbar)` (custom `SelectionToolbarProvider`)
- `.use(imageBlockComponent)`
- `.use(tableBlock)` (custom glyphs)

Table block control glyphs (`tableBlockConfig.renderButton`)

- add row/col: `＋`; delete row/col: `−`
- align left: `⟸`; center: `↔`; right: `⟹`
- drag handle: `⠿`

Block handle

- built, but hidden by CSS (`display:none !important`)

---

## Slash menu (custom)

Show condition

- `content.match(/\\/(\\w[\\w-]*)?$/)` (provider content)
- `slashSearch = m?.[1] ?? ""`
- provider `offset: 8`

Items (labels)

- Text, Heading 1, Heading 2, Bullet List, Numbered List, Quote, Code Block, Divider, Table (3×3), Image (URL)…
- Image inserts via prompt `"Image URL"` (cancel/no input → no-op)

Execution

- delete trigger text via `/\\/[\\w-]*$/` then run command
- filtering: substring match across label + keywords (lowercased)

UI/DOM contract

- container: `.mk-slash` with `.mk-slash-inner`
- items: `<button class="mk-slash-item" data-id="…">`
- selected item attribute: `data-selected="true"`
- empty state: `<div class="mk-slash-empty">No results</div>`

Keyboard handling (capture)

- active only when `slashEl.dataset.show === "true"`
- Esc: hide + refocus editor
- ArrowUp/Down: cycle selection (wrap)
- Enter: run selected + refocus

---

## Selection toolbar (custom)

Show condition

- `selection.content().size > 0`
- editable + not `readOnly`

Buttons

- bold (`B`), italic (`I`), inline code (`</>`)
- mousedown prevented; click runs command
- provider offset: 8

---

## Find/replace bar

Open triggers

- `window` events: `augenblick:find`, `augenblick:replace`, `augenblick:find-next`, `augenblick:find-prev`

UI strings

- placeholders: `"Find"`, `"Replace"`
- counter: `"0/0"` or `${cursor + 1}/${matches.length}`
- buttons: `"Prev"`, `"Next"`, `"Replace"`, `"All"`
- close aria-label: `"Close Find"`

Key handling

- Escape closes find
- Enter in Find input
  - refresh matches; Shift+Enter = prev, Enter = next
- Enter in Replace input = replace current

Read-only behavior

- replace UI hidden when `readOnly=true` (Find-only)

