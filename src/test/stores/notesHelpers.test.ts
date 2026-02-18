import { describe, expect, it } from "vitest";
import type { NoteMeta, NotesList } from "@/lib/types";
import {
  bumpLastInteraction,
  findMetaById,
  getSectionIds,
  listIds,
  pruneByIds,
  removeMeta,
  replaceOrAppendActive,
  sortActive,
  sortTrashed,
  upsertMeta,
} from "@/stores/notes/helpers";

function meta(overrides: Partial<NoteMeta>): NoteMeta {
  return {
    id: "n1",
    title: "Title",
    preview: "",
    filePath: "/tmp/n1.md",
    storage: "draft",
    isPinned: false,
    isTrashed: false,
    sortOrder: 1,
    createdAt: 1,
    lastInteraction: 1,
    trashedAt: null,
    ...overrides,
  };
}

describe("notes helpers", () => {
  it("upserts and removes metadata across active/trashed lists", () => {
    const list: NotesList = { active: [meta({ id: "a1" })], trashed: [meta({ id: "t1", isTrashed: true })] };
    const updated = upsertMeta(list, meta({ id: "a1", title: "Updated" }));
    expect(updated.active.find((n) => n.id === "a1")?.title).toBe("Updated");

    const moved = upsertMeta(updated, meta({ id: "a1", isTrashed: true, trashedAt: 2 }));
    expect(moved.active.find((n) => n.id === "a1")).toBeUndefined();
    expect(moved.trashed.find((n) => n.id === "a1")).toBeTruthy();

    const removed = removeMeta(moved, "a1");
    expect(removed.trashed.find((n) => n.id === "a1")).toBeUndefined();
  });

  it("replaces active notes and computes ids/maps", () => {
    const list: NotesList = { active: [meta({ id: "a1" })], trashed: [meta({ id: "t1", isTrashed: true })] };
    const replaced = replaceOrAppendActive(list, meta({ id: "a1", title: "R" }));
    expect(replaced.active).toHaveLength(1);
    expect(replaced.active[0]?.title).toBe("R");

    const appended = replaceOrAppendActive(replaced, meta({ id: "a2", sortOrder: 2 }));
    expect(appended.active.map((n) => n.id)).toEqual(["a1", "a2"]);
    expect(Array.from(listIds(appended))).toEqual(expect.arrayContaining(["a1", "a2", "t1"]));
    expect(pruneByIds({ a1: "x", ghost: "y" }, new Set(["a1"]))).toEqual({ a1: "x" });
  });

  it("sorts notes and finds metadata by id", () => {
    const active = sortActive([
      meta({ id: "n2", isPinned: false, sortOrder: 2 }),
      meta({ id: "n1", isPinned: true, sortOrder: 3 }),
      meta({ id: "n3", isPinned: true, sortOrder: 1 }),
    ]);
    expect(active.map((n) => n.id)).toEqual(["n3", "n1", "n2"]);

    const trashed = sortTrashed([
      meta({ id: "t1", isTrashed: true, trashedAt: 1, sortOrder: 3 }),
      meta({ id: "t2", isTrashed: true, trashedAt: 2, sortOrder: 2 }),
      meta({ id: "t3", isTrashed: true, trashedAt: 2, sortOrder: 1 }),
    ]);
    expect(trashed.map((n) => n.id)).toEqual(["t3", "t2", "t1"]);

    const list: NotesList = { active, trashed };
    expect(findMetaById(list, "n2")?.id).toBe("n2");
    expect(findMetaById(list, "missing")).toBeNull();
    expect(findMetaById(list, null)).toBeNull();
  });

  it("handles section ids and last interaction bumps", () => {
    const list: NotesList = {
      active: [
        meta({ id: "p1", isPinned: true }),
        meta({ id: "n1", isPinned: false }),
      ],
      trashed: [],
    };

    expect(getSectionIds(list, "pinned")).toEqual(["p1"]);
    expect(getSectionIds(list, "notes")).toEqual(["n1"]);

    const bumped = bumpLastInteraction(list, "n1", 100);
    expect(bumped.active.find((n) => n.id === "n1")?.lastInteraction).toBe(100);

    const unchanged = bumpLastInteraction(bumped, "n1", 100);
    expect(unchanged).toBe(bumped);
  });
});

