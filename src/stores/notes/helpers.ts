import type { NoteMeta, NotesList } from "@/lib/types";

export type ReorderSection = "pinned" | "notes";

export function upsertMeta(list: NotesList, meta: NoteMeta): NotesList {
  const target = meta.isTrashed ? "trashed" : "active";
  const other = target === "active" ? "trashed" : "active";

  const nextTarget = list[target].some((n) => n.id === meta.id)
    ? list[target].map((n) => (n.id === meta.id ? meta : n))
    : [...list[target], meta];

  const nextOther = list[other].filter((n) => n.id !== meta.id);

  return target === "active"
    ? { active: nextTarget, trashed: nextOther }
    : { active: nextOther, trashed: nextTarget };
}

export function removeMeta(list: NotesList, id: string): NotesList {
  return {
    active: list.active.filter((n) => n.id !== id),
    trashed: list.trashed.filter((n) => n.id !== id),
  };
}

export function replaceOrAppendActive(list: NotesList, meta: NoteMeta): NotesList {
  const without = list.active.filter((n) => n.id !== meta.id);
  return { ...list, active: [...without, meta] };
}

export function listIds(list: NotesList) {
  return new Set([...list.active, ...list.trashed].map((note) => note.id));
}

export function pruneByIds<T>(map: Record<string, T>, ids: Set<string>) {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(map)) {
    if (ids.has(key)) next[key] = value;
  }
  return next;
}

export function sortActive(notes: NoteMeta[]) {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

export function sortTrashed(notes: NoteMeta[]) {
  return [...notes].sort((a, b) => {
    const aTrashed = a.trashedAt ?? 0;
    const bTrashed = b.trashedAt ?? 0;
    if (aTrashed !== bTrashed) return bTrashed - aTrashed;
    return a.sortOrder - b.sortOrder;
  });
}

export function findMetaById(list: NotesList, id: string | null) {
  if (!id) return null;
  return list.active.find((n) => n.id === id) ?? list.trashed.find((n) => n.id === id) ?? null;
}

export function bumpLastInteraction(list: NotesList, id: string, now: number): NotesList {
  let changed = false;
  const update = (note: NoteMeta) => {
    if (note.id !== id) return note;
    if (note.lastInteraction === now) return note;
    changed = true;
    return { ...note, lastInteraction: now };
  };
  const active = list.active.map(update);
  const trashed = list.trashed.map(update);
  return changed ? { active, trashed } : list;
}

export function getSectionIds(list: NotesList, section: ReorderSection) {
  return list.active
    .filter((n) => (section === "pinned" ? n.isPinned : !n.isPinned))
    .map((n) => n.id);
}

