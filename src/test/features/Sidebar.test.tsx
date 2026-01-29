import { afterEach, describe, expect, it, vi } from "vitest";
import React, { useEffect } from "react";
import { render } from "@/test/utils/render";
import type { NoteMeta } from "@/lib/types";

vi.mock("@/components/icons/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

let dndCallIndex = 0;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragStart, onDragOver }: any) => {
    useEffect(() => {
      const id = dndCallIndex === 0 ? "p1" : "n2";
      dndCallIndex += 1;
      onDragStart?.({ active: { id } });
      onDragOver?.({ active: { id }, over: { id } });
    }, [onDragOver, onDragStart]);
    return <div>{children}</div>;
  },
  PointerSensor: class {},
  closestCenter: vi.fn(),
  useSensor: () => ({}),
  useSensors: (...sensors: any[]) => sensors,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  arrayMove: (items: any[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  },
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const noteItemSpy = vi.fn();
const trashItemSpy = vi.fn();

vi.mock("@/features/sidebar/NoteItem", () => ({
  NoteItem: (props: any) => {
    noteItemSpy(props);
    return <div data-note-item={props.note.id} />;
  },
}));

vi.mock("@/features/sidebar/TrashItem", () => ({
  TrashItem: (props: any) => {
    trashItemSpy(props);
    return <div data-trash-item={props.note.id} />;
  },
}));

describe("Sidebar", () => {
  const note = (overrides: Partial<NoteMeta>): NoteMeta => ({
    id: "n1",
    title: "Note",
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
  });

  afterEach(() => {
    noteItemSpy.mockClear();
    trashItemSpy.mockClear();
    dndCallIndex = 0;
  });

  it("renders notes view with pinned + actions", async () => {
    const onNewNote = vi.fn();
    const onToggleTrash = vi.fn();

    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/Sidebar")).Sidebar, {
        pinned: [note({ id: "p1", isPinned: true })],
        notes: [note({ id: "n2" })],
        trashed: [note({ id: "t1", isTrashed: true })],
        selectedId: "n2",
        expiryMinutes: 60,
        trashRetentionDays: 30,
        viewMode: "notes",
        onSelect: vi.fn(),
        onReorder: vi.fn(),
        onToggleTrash,
        onClearTrash: vi.fn(),
        onRestore: vi.fn(),
        onDeleteForever: vi.fn(),
        onNewNote,
      }),
    );

    expect(container.querySelectorAll("[data-note-item]").length).toBe(2);
    expect(noteItemSpy).toHaveBeenCalledWith(expect.objectContaining({ expiryMinutes: 60 }));

    const newButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("New note"),
    );
    newButton?.click();
    expect(onNewNote).toHaveBeenCalled();

    const trashButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Trash"),
    );
    trashButton?.click();
    expect(onToggleTrash).toHaveBeenCalled();

    await unmount();
  });

  it("renders notes view without pinned", async () => {
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/Sidebar")).Sidebar, {
        pinned: [],
        notes: [note({ id: "n2" })],
        trashed: [],
        selectedId: "n2",
        expiryMinutes: 60,
        trashRetentionDays: 30,
        viewMode: "notes",
        onSelect: vi.fn(),
        onReorder: vi.fn(),
        onToggleTrash: vi.fn(),
        onClearTrash: vi.fn(),
        onRestore: vi.fn(),
        onDeleteForever: vi.fn(),
        onNewNote: vi.fn(),
      }),
    );

    expect(container.textContent).toContain("NOTES");
    expect(container.textContent).not.toContain("PINNED");

    await unmount();
  });

  it("renders trash view and empty state", async () => {
    const onClearTrash = vi.fn();
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/Sidebar")).Sidebar, {
        pinned: [],
        notes: [],
        trashed: [],
        selectedId: null,
        expiryMinutes: 60,
        trashRetentionDays: 30,
        viewMode: "trash",
        onSelect: vi.fn(),
        onReorder: vi.fn(),
        onToggleTrash: vi.fn(),
        onClearTrash,
        onRestore: vi.fn(),
        onDeleteForever: vi.fn(),
        onNewNote: vi.fn(),
      }),
    );

    expect(container.textContent).toContain("Trash is empty");

    const emptyButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Empty Trash"),
    ) as HTMLButtonElement | undefined;
    expect(emptyButton?.disabled).toBe(true);

    await unmount();
  });

  it("enables clear trash when items exist", async () => {
    const onClearTrash = vi.fn();
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/Sidebar")).Sidebar, {
        pinned: [],
        notes: [],
        trashed: [note({ id: "t1", isTrashed: true })],
        selectedId: null,
        expiryMinutes: 60,
        trashRetentionDays: 30,
        viewMode: "trash",
        onSelect: vi.fn(),
        onReorder: vi.fn(),
        onToggleTrash: vi.fn(),
        onClearTrash,
        onRestore: vi.fn(),
        onDeleteForever: vi.fn(),
        onNewNote: vi.fn(),
      }),
    );

    const emptyButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Empty Trash"),
    ) as HTMLButtonElement | undefined;
    emptyButton?.click();
    expect(onClearTrash).toHaveBeenCalled();

    await unmount();
  });
});
