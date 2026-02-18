import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@/test/utils/render";
import type { NoteMeta } from "@/lib/types";

vi.mock("@/features/sidebar/ExpiryRing", () => ({
  ExpiryRing: () => <div data-expiry-ring />,
}));

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  ContextMenuShortcut: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("NoteItem", () => {
  const base: NoteMeta = {
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
  };

  it("renders expiry ring and handles select", async () => {
    const onSelect = vi.fn();
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/NoteItem")).NoteItem, {
        note: base,
        selected: false,
        dirty: false,
        expiryMinutes: 60,
        onSelect,
        onTogglePin: vi.fn(),
        onTrash: vi.fn(),
      }),
    );

    expect(container.querySelector("[data-expiry-ring]")).toBeTruthy();
    (container.querySelector("button") as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith("n1");

    await unmount();
  });

  it("hides expiry ring when pinned or trashed", async () => {
    const onSelect = vi.fn();
    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/NoteItem")).NoteItem, {
        note: { ...base, isPinned: true },
        selected: false,
        dirty: false,
        expiryMinutes: 60,
        onSelect,
        onTogglePin: vi.fn(),
        onTrash: vi.fn(),
      }),
    );

    expect(container.querySelector("[data-expiry-ring]")).toBeNull();

    await unmount();
  });

  it("triggers context menu actions", async () => {
    const onTogglePin = vi.fn();
    const onTrash = vi.fn();

    const { container, unmount } = await render(
      React.createElement((await import("@/features/sidebar/NoteItem")).NoteItem, {
        note: base,
        selected: false,
        dirty: false,
        expiryMinutes: 60,
        onSelect: vi.fn(),
        onTogglePin,
        onTrash,
      }),
    );

    const buttons = Array.from(container.querySelectorAll("button"));
    const pinButton = buttons.find((button) => button.textContent?.includes("Pin"));
    const trashButton = buttons.find((button) => button.textContent?.includes("Trash"));

    pinButton?.click();
    trashButton?.click();

    expect(onTogglePin).toHaveBeenCalledWith("n1");
    expect(onTrash).toHaveBeenCalledWith("n1");

    await unmount();
  });
});
