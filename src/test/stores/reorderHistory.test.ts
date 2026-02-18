import { beforeEach, describe, expect, it, vi } from "vitest";

describe("reorderHistory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("stores undo entries and trims at max history", async () => {
    const history = await import("@/stores/notes/reorderHistory");

    for (let i = 0; i < 25; i += 1) {
      history.pushReorderUndo("notes", [`n-${i}`]);
    }

    const first = history.popReorderUndo();
    expect(first?.ids[0]).toBe("n-24");

    let count = 1;
    while (history.popReorderUndo()) count += 1;
    expect(count).toBe(20);
    expect(history.popReorderUndo()).toBeNull();
  });

  it("tracks redo and undo-from-redo stacks", async () => {
    const history = await import("@/stores/notes/reorderHistory");

    history.pushReorderRedo("pinned", ["a", "b"]);
    const redo = history.popReorderRedo();
    expect(redo).toEqual({ section: "pinned", ids: ["a", "b"] });
    expect(history.popReorderRedo()).toBeNull();

    history.pushUndoFromRedo("notes", ["x", "y"]);
    const undo = history.popReorderUndo();
    expect(undo).toEqual({ section: "notes", ids: ["x", "y"] });
  });
});

