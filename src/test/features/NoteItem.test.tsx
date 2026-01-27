import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@/test/utils/render";
import type { NoteMeta } from "@/lib/types";

vi.mock("@/features/sidebar/ExpiryRing", () => ({
  ExpiryRing: () => <div data-expiry-ring />,
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
        expiryMinutes: 60,
        onSelect,
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
        expiryMinutes: 60,
        onSelect,
      }),
    );

    expect(container.querySelector("[data-expiry-ring]")).toBeNull();

    await unmount();
  });
});
