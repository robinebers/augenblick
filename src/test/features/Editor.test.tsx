import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { render } from "@/test/utils/render";

let lastConfig: any = null;
let editorMock: any = null;
let bubbleProps: any = null;
const openExternalMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: (props: { children: React.ReactNode }) => {
    bubbleProps = props;
    return <div>{props.children}</div>;
  },
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openExternalMock(...args),
}));

vi.mock("@tiptap/react", () => ({
  EditorContent: ({ editor, className }: { editor: unknown; className?: string }) => (
    <div data-editor={String(Boolean(editor))} className={className} />
  ),
  useEditor: (config: any) => {
    lastConfig = config;
    return editorMock;
  },
}));

describe("Editor", () => {
  beforeEach(() => {
    lastConfig = null;
    editorMock = {
      markdown: {
        parse: vi.fn(() => ({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Title" }],
            },
          ],
        })),
      },
      state: {
        selection: { from: 1, to: 4 },
      },
      isActive: vi.fn(() => false),
      getAttributes: vi.fn(() => ({})),
      getMarkdown: vi.fn(() => "next"),
      setEditable: vi.fn(),
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: vi.fn() }),
          toggleItalic: () => ({ run: vi.fn() }),
          toggleStrike: () => ({ run: vi.fn() }),
          toggleCode: () => ({ run: vi.fn() }),
          extendMarkRange: () => ({
            setLink: () => ({ run: vi.fn() }),
            unsetLink: () => ({ run: vi.fn() }),
          }),
          insertContent: () => ({ run: vi.fn() }),
        }),
      }),
      commands: {
        setContent: vi.fn(),
        insertContent: vi.fn(),
        focus: vi.fn(),
      },
    };
    openExternalMock.mockClear();
    bubbleProps = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls onChange on updates when editable", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    expect(lastConfig?.contentType).toBe("markdown");

    await act(async () => {
      lastConfig.onUpdate({ editor: editorMock });
    });

    expect(onChange).toHaveBeenCalledWith("next");
    await unmount();
  });

  it("skips onChange when read-only", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
        readOnly: true,
      }),
    );

    await act(async () => {
      lastConfig.onUpdate({ editor: editorMock });
    });

    expect(onChange).not.toHaveBeenCalled();
    await unmount();
  });

  it("syncs external value changes and focuses on event", async () => {
    const onChange = vi.fn();

    const { rerender, unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "one",
        onChange,
      }),
    );

    await rerender(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "two",
        onChange,
      }),
    );

    expect(editorMock.commands.setContent).toHaveBeenCalledWith("two", { contentType: "markdown" });

    await act(async () => {
      window.dispatchEvent(new Event("augenblick:focus-editor"));
    });

    expect(editorMock.commands.focus).toHaveBeenCalledWith("end");

    await unmount();
  });

  it("opens a link input instead of using window.prompt", async () => {
    const onChange = vi.fn();
    const promptSpy = vi.spyOn(window, "prompt");

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const linkButton = container.querySelector('button[aria-label="Link"]') as HTMLButtonElement | null;
    expect(linkButton).not.toBeNull();

    await act(async () => {
      linkButton?.click();
    });

    const linkInput = container.querySelector('input[type="url"]');
    expect(linkInput).not.toBeNull();
    expect(promptSpy).not.toHaveBeenCalled();

    promptSpy.mockRestore();
    await unmount();
  });

  it("hides bubble menu on empty doc even if link mark is active", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "",
        onChange,
      }),
    );

    const shouldShow = bubbleProps?.shouldShow;
    const linkMark = { name: "link" };
    expect(
      shouldShow({
        state: {
          selection: { empty: true, from: 0, to: 0, $from: { marks: () => [] } },
          doc: { textContent: "", textBetween: () => "" },
          schema: { marks: { link: linkMark } },
        },
      }),
    ).toBe(false);

    await unmount();
  });

  it("opens links only on modifier click", async () => {
    const onChange = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://example.com");
    const event = {
      target: anchor,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: vi.fn(),
    };
    const handled = lastConfig.editorProps.handleDOMEvents.click({}, event);

    expect(handled).toBe(false);
    expect(openExternalMock).toHaveBeenCalledWith("https://example.com");
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
    debugSpy.mockRestore();
    await unmount();
  });

  it("pastes markdown as parsed content", async () => {
    const onChange = vi.fn();
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const clipboardData = {
      getData: (type: string) => (type === "text/plain" ? "# Title\n\n- item" : ""),
    };
    const event = {
      clipboardData,
      preventDefault: vi.fn(),
    };

    const handled = lastConfig.editorProps.handleDOMEvents.paste({}, event);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(editorMock.markdown.parse).toHaveBeenCalledWith("# Title\n\n- item");
    expect(editorMock.commands.insertContent).toHaveBeenCalledWith([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Title" }],
      },
    ]);

    debugSpy.mockRestore();
    await unmount();
  });
});
