# Augenblick → React migration — manual QA checklist

Last updated: 2026-01-27

Goal

- parity gate before “done”

---

## Notes

- Cmd+N creates draft; selects; placeholder disappears
- Typing autosaves draft after ~500ms idle; title/preview update
- Cmd+S on draft opens Save dialog; path gets `.md`; converts to saved
- Edit saved note; Cmd+S saves to same path (no dialog)
- Cmd+Shift+S opens Save As; respects existing `.md`
- Cmd+O opens file; imports; re-open same file selects existing note (no duplicate)
- Saved dirty close prompts “Trash note?” with Save / Don't Save / Cancel

## Trash + retention

- Cmd+W moves current to trash; toast “Moved to Trash”
- Delete/Backspace (not typing) trashes current
- Trash view shows countdown (“Deletes …”); restore works; delete forever confirms
- Delete forever never deletes user file for saved notes
- Empty Trash confirms and clears; stays in trash view

## Pinning + reorder

- Cmd+P toggles pin; pinned section appears
- Pin 6th note → error toast (max 5)
- Drag reorder pinned; drag reorder notes; persists after restart
- Cmd+Z / Cmd+Shift+Z undo/redo reorder (not while typing)

## Editor

- Empty note shows “Start writing...” placeholder
- Cmd+F opens find bar; selection seeds query; counts show `i/total`
- Cmd+Alt+F opens replace; replace current/all works
- Cmd+G next; Cmd+Shift+G prev
- Slash menu `/` works; Table insert; Image URL prompt inserts image
- Task list checkbox toggles on click near checkbox (~22px hit target)
- Paste plain text markdown into non-code block preserves structure

## Settings

- Cmd+, opens Settings; outside click closes
- Theme: Light/Dark/System; system follows OS changes
- Note Expiry: options 1/3/7/14/30 days; expiry ring timing updates
- Trash Retention: options 7/14/30/60/90 days; trash countdown updates

## Window + chrome

- Titlebar region drag moves window; double-click toggles maximize
- Window state persists (pos/size) and clamps to visible monitor on reopen
- Menu items trigger correct actions (Open/New/Save/Save As/Trash/Settings/Find/Replace)
- Cmd+Alt+I toggles devtools (desktop)

