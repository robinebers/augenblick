import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@/test/utils/render";
import type { NoteMeta } from "@/lib/types";

vi.mock("@/components/icons/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

describe("TrashItem", () => {
  const base: NoteMeta = {
    id: "t1",
    title: "Trashed",
    preview: "",
    filePath: "/tmp/t1.md",
    storage: "draft",
    isPinned: false,
    isTrashed: true,
    sortOrder: 1,
    createdAt: 1,
    lastInteraction: 1,
    trashedAt: 1_000_000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles selection and actions", async () => {
    const onSelect = vi.fn();
    const onRestore = vi.fn();
    const onDeleteForever = vi.fn();

    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/TrashItem")).TrashItem, {
        note: base,
        selected: false,
        trashRetentionDays: 30,
        onSelect,
        onRestore,
        onDeleteForever,
      }),
    );

    const row = container.querySelector('[role="button"]') as HTMLElement;
    row.click();
    expect(onSelect).toHaveBeenCalledWith("t1");

    const restore = container.querySelector('button[aria-label="Restore"]') as HTMLButtonElement;
    restore.click();
    expect(onRestore).toHaveBeenCalledWith("t1");

    const del = container.querySelector('button[aria-label="Delete forever"]') as HTMLButtonElement;
    del.click();
    expect(onDeleteForever).toHaveBeenCalledWith("t1");

    await unmount();
  });

  it("handles keyboard selection", async () => {
    const onSelect = vi.fn();
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/TrashItem")).TrashItem, {
        note: base,
        selected: false,
        trashRetentionDays: 30,
        onSelect,
        onRestore: vi.fn(),
        onDeleteForever: vi.fn(),
      }),
    );

    const row = container.querySelector('[role="button"]') as HTMLElement;
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith("t1");

    await unmount();
  });

  it("shows em dash when missing trashedAt", async () => {
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/TrashItem")).TrashItem, {
        note: { ...base, id: "t2", trashedAt: null },
        selected: false,
        trashRetentionDays: 30,
        onSelect: vi.fn(),
        onRestore: vi.fn(),
        onDeleteForever: vi.fn(),
      }),
    );

    expect(container.textContent).toContain("Deletes —");
    await unmount();
  });
});
