import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { render } from "@/test/utils/render";

vi.mock("@/components/icons/Icon", () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

let bubbleProps: any = null;

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: (props: { children: React.ReactNode }) => {
    bubbleProps = props;
    return <div>{props.children}</div>;
  },
}));

function createEditor(options: { collapsed?: boolean; href?: string } = {}) {
  const chainOps = {
    focus: vi.fn(() => chainOps),
    setTextSelection: vi.fn(() => chainOps),
    extendMarkRange: vi.fn(() => chainOps),
    setLink: vi.fn(() => chainOps),
    unsetLink: vi.fn(() => chainOps),
    insertContent: vi.fn(() => chainOps),
    toggleBold: vi.fn(() => chainOps),
    toggleItalic: vi.fn(() => chainOps),
    toggleStrike: vi.fn(() => chainOps),
    toggleCode: vi.fn(() => chainOps),
    run: vi.fn(() => true),
  };

  const editor = {
    chain: vi.fn(() => chainOps),
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({ href: options.href })),
    state: {
      selection: {
        from: 2,
        to: options.collapsed ? 2 : 6,
      },
    },
  };

  return { editor, chainOps };
}

describe("LinkBubbleMenu", () => {
  afterEach(() => {
    bubbleProps = null;
  });

  it("runs inline format commands from bubble buttons", async () => {
    const { editor, chainOps } = createEditor();

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/LinkBubbleMenu")).LinkBubbleMenu, {
        editor: editor as never,
        readOnly: false,
      }),
    );

    (container.querySelector('button[aria-label="Bold"]') as HTMLButtonElement).click();
    (container.querySelector('button[aria-label="Italic"]') as HTMLButtonElement).click();
    (container.querySelector('button[aria-label="Strike"]') as HTMLButtonElement).click();
    (container.querySelector('button[aria-label="Code"]') as HTMLButtonElement).click();

    expect(chainOps.toggleBold).toHaveBeenCalled();
    expect(chainOps.toggleItalic).toHaveBeenCalled();
    expect(chainOps.toggleStrike).toHaveBeenCalled();
    expect(chainOps.toggleCode).toHaveBeenCalled();
    expect(chainOps.run).toHaveBeenCalled();

    await unmount();
  });

  it("clears link when apply is submitted with empty value", async () => {
    const { editor, chainOps } = createEditor({ collapsed: true });

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/LinkBubbleMenu")).LinkBubbleMenu, {
        editor: editor as never,
        readOnly: false,
      }),
    );

    await act(async () => {
      (container.querySelector('button[aria-label="Link"]') as HTMLButtonElement).click();
    });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(chainOps.extendMarkRange).toHaveBeenCalledWith("link");
    expect(chainOps.unsetLink).toHaveBeenCalled();

    await unmount();
  });

  it("updates and removes links from selected text", async () => {
    const { editor, chainOps } = createEditor({ href: "https://old.example" });

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/LinkBubbleMenu")).LinkBubbleMenu, {
        editor: editor as never,
        readOnly: false,
      }),
    );

    await act(async () => {
      (container.querySelector('button[aria-label="Link"]') as HTMLButtonElement).click();
    });
    const input = container.querySelector('input[type="url"]') as HTMLInputElement;
    await act(async () => {
      (container.querySelector('button[aria-label="Apply link"]') as HTMLButtonElement).click();
    });

    expect(chainOps.setLink).toHaveBeenCalledWith({ href: "https://old.example" });

    await act(async () => {
      (container.querySelector('button[aria-label="Link"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('button[aria-label="Remove link"]') as HTMLButtonElement).click();
    });
    expect(chainOps.unsetLink).toHaveBeenCalled();

    await unmount();
  });

  it("does not open link controls in read-only mode", async () => {
    const { editor } = createEditor();

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/LinkBubbleMenu")).LinkBubbleMenu, {
        editor: editor as never,
        readOnly: true,
      }),
    );

    await act(async () => {
      (container.querySelector('button[aria-label="Link"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('input[type="url"]')).toBeNull();

    await unmount();
  });

  it("applies bubble show rules for selections and link marks", async () => {
    const { editor } = createEditor();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/LinkBubbleMenu")).LinkBubbleMenu, {
        editor: editor as never,
        readOnly: false,
      }),
    );

    const linkMark = { name: "link" };

    expect(
      bubbleProps.shouldShow({
        state: {
          selection: { empty: false, from: 0, to: 4 },
          doc: { textContent: "text", textBetween: () => "text" },
          schema: { marks: { link: linkMark } },
        },
      }),
    ).toBe(true);

    expect(
      bubbleProps.shouldShow({
        state: {
          selection: { empty: true, from: 0, to: 0, $from: { marks: () => [{ type: linkMark }] } },
          doc: { textContent: "text", textBetween: () => "" },
          schema: { marks: { link: linkMark } },
        },
      }),
    ).toBe(true);

    expect(
      bubbleProps.shouldShow({
        state: {
          selection: { empty: true, from: 0, to: 0, $from: { marks: () => [] } },
          doc: { textContent: "", textBetween: () => "" },
          schema: { marks: {} },
        },
      }),
    ).toBe(false);

    await unmount();
  });
});

