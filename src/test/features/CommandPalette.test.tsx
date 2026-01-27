import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { render } from "@/test/utils/render";
import type { NoteMeta } from "@/lib/types";

vi.mock("@/components/icons/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

const dialogHandlers: Array<(next: boolean) => void> = [];

vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({ open, onOpenChange, children }: any) => {
    if (onOpenChange) dialogHandlers.push(onOpenChange);
    return (
      <div data-open={open}>
        {children}
      </div>
    );
  },
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ heading, children }: any) => (
    <section data-heading={heading}>{children}</section>
  ),
  CommandInput: React.forwardRef((props: any, ref) => <input ref={ref} {...props} />),
  CommandItem: ({ value, onSelect, children }: any) => (
    <button type="button" data-value={value} onClick={() => onSelect?.(value)}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
  CommandSeparator: () => <hr />,
  CommandShortcut: ({ children }: any) => <span>{children}</span>,
}));

describe("CommandPalette", () => {
  afterEach(() => {
    dialogHandlers.length = 0;
  });

  it("runs command actions and closes", async () => {
    const onClose = vi.fn();
    const onNewNote = vi.fn();
    const onTogglePinCurrent = vi.fn();
    const onCloseNote = vi.fn();
    const onOpenFile = vi.fn();
    const onSave = vi.fn();
    const onSaveAs = vi.fn();
    const onSelectNote = vi.fn();
    const onOpenSettings = vi.fn();

    const notes: NoteMeta[] = [
      {
        id: "n1",
        title: "Note 1",
        preview: "preview",
        filePath: "/tmp/n1.md",
        storage: "draft",
        isPinned: false,
        isTrashed: false,
        sortOrder: 1,
        createdAt: 1,
        lastInteraction: 1,
        trashedAt: null,
      },
      {
        id: "n2",
        title: "Saved Note",
        preview: "saved",
        filePath: "/tmp/n2.md",
        storage: "saved",
        isPinned: false,
        isTrashed: false,
        sortOrder: 2,
        createdAt: 1,
        lastInteraction: 1,
        trashedAt: null,
      },
    ];

    const { container, unmount } = await render(
      <React.Fragment>
        {React.createElement((await import("@/features/command/CommandPalette")).CommandPalette, {
          notes,
          onClose,
          onNewNote,
          onTogglePinCurrent,
          onCloseNote,
          onOpenFile,
          onSave,
          onSaveAs,
          onSelectNote,
          onOpenSettings,
        })}
      </React.Fragment>,
    );

    const newNote = container.querySelector('button[data-value="new-note"]') as HTMLButtonElement;
    newNote.click();
    expect(onNewNote).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    const noteItem = container.querySelector('button[data-value="n1"]') as HTMLButtonElement;
    noteItem.click();
    expect(onSelectNote).toHaveBeenCalledWith("n1");

    expect(container.textContent).toContain("Draft");
    expect(container.textContent).toContain("Saved");

    const settings = container.querySelector('button[data-value="settings"]') as HTMLButtonElement;
    settings.click();
    expect(onOpenSettings).toHaveBeenCalled();

    await unmount();
  });

  it("closes on dialog open change", async () => {
    const onClose = vi.fn();
    const { unmount } = await render(
      React.createElement((await import("@/features/command/CommandPalette")).CommandPalette, {
        notes: [],
        onClose,
        onNewNote: vi.fn(),
        onTogglePinCurrent: vi.fn(),
        onCloseNote: vi.fn(),
        onOpenFile: vi.fn(),
        onSave: vi.fn(),
        onSaveAs: vi.fn(),
        onSelectNote: vi.fn(),
        onOpenSettings: vi.fn(),
      }),
    );

    const handler = dialogHandlers.at(-1);
    if (handler) {
      await act(async () => {
        handler(false);
      });
      await act(async () => {
        handler(false);
      });
    }
    expect(onClose).toHaveBeenCalled();

    await unmount();
  });
});
