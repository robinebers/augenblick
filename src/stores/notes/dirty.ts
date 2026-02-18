import type { NotesList } from "@/lib/types";

export type DirtyStateSnapshot = {
  list: NotesList;
  contentById: Record<string, string>;
  lastSavedContentById: Record<string, string>;
};

export function isNoteDirty(state: DirtyStateSnapshot, id: string): boolean {
  const meta = state.list.active.find((note) => note.id === id);
  if (!meta || meta.storage !== "saved" || meta.isTrashed) return false;
  const saved = state.lastSavedContentById[id];
  if (typeof saved !== "string") return false;
  const current = state.contentById[id] ?? "";
  return current !== saved;
}

export function getDirtySavedIds(state: DirtyStateSnapshot): string[] {
  return state.list.active
    .filter((note) => note.storage === "saved" && !note.isTrashed)
    .map((note) => note.id)
    .filter((id) => isNoteDirty(state, id));
}

export function getDirtySavedMap(state: DirtyStateSnapshot): Record<string, true> {
  const dirty: Record<string, true> = {};
  for (const id of getDirtySavedIds(state)) dirty[id] = true;
  return dirty;
}

export function getDirtySavedCount(state: DirtyStateSnapshot): number {
  return getDirtySavedIds(state).length;
}
