import type { ReorderSection } from "@/stores/notes/helpers";

type ReorderEntry = {
  section: ReorderSection;
  ids: string[];
};

const MAX_HISTORY = 20;

const reorderUndoStack: ReorderEntry[] = [];
const reorderRedoStack: ReorderEntry[] = [];

function trimHistory(history: ReorderEntry[]) {
  if (history.length <= MAX_HISTORY) return;
  history.splice(0, history.length - MAX_HISTORY);
}

export function pushReorderUndo(section: ReorderSection, ids: string[]) {
  reorderUndoStack.push({ section, ids });
  trimHistory(reorderUndoStack);
  reorderRedoStack.length = 0;
}

export function popReorderUndo() {
  return reorderUndoStack.pop() ?? null;
}

export function pushReorderRedo(section: ReorderSection, ids: string[]) {
  reorderRedoStack.push({ section, ids });
  trimHistory(reorderRedoStack);
}

export function popReorderRedo() {
  return reorderRedoStack.pop() ?? null;
}

export function pushUndoFromRedo(section: ReorderSection, ids: string[]) {
  reorderUndoStack.push({ section, ids });
  trimHistory(reorderUndoStack);
}

