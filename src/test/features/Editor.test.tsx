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
        serialize: vi.fn(() => "Copy **me**"),
      },
      state: {
        selection: { from: 1, to: 4 },
        doc: {
          cut: vi.fn(() => ({
            toJSON: () => ({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Copy me" }],
                },
              ],
            }),
          })),
        },
      },
      view: {
        state: {
          selection: {
            empty: false,
            content: vi.fn(() => "slice"),
          },
        },
        serializeForClipboard: vi.fn(() => ({
          dom: { innerHTML: "<h2>Copy me</h2>" },
          text: "Copy me",
          slice: "slice",
        })),
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
        deleteSelection: vi.fn(),
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

  it("shows bubble menu when text is selected", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const shouldShow = bubbleProps?.shouldShow;
    expect(
      shouldShow({
        state: {
          selection: { empty: false, from: 0, to: 5 },
          doc: { textContent: "hello", textBetween: () => "hello" },
          schema: { marks: { link: { name: "link" } } },
        },
      }),
    ).toBe(true);

    await unmount();
  });

  it("hides bubble menu when selection is whitespace only", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const shouldShow = bubbleProps?.shouldShow;
    expect(
      shouldShow({
        state: {
          selection: { empty: false, from: 0, to: 3 },
          doc: { textContent: "   world", textBetween: () => "   " },
          schema: { marks: { link: { name: "link" } } },
        },
      }),
    ).toBe(false);

    await unmount();
  });

  it("shows bubble menu when cursor is on link mark", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const shouldShow = bubbleProps?.shouldShow;
    const linkMark = { name: "link" };
    expect(
      shouldShow({
        state: {
          selection: { empty: true, from: 2, to: 2, $from: { marks: () => [{ type: linkMark }] } },
          doc: { textContent: "hello", textBetween: () => "" },
          schema: { marks: { link: linkMark } },
        },
      }),
    ).toBe(true);

    await unmount();
  });

  it("hides bubble menu when no link mark in schema", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const shouldShow = bubbleProps?.shouldShow;
    expect(
      shouldShow({
        state: {
          selection: { empty: true, from: 2, to: 2, $from: { marks: () => [] } },
          doc: { textContent: "hello", textBetween: () => "" },
          schema: { marks: {} },
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

  it("delegates copy and cut to native editor behavior", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    expect(lastConfig.editorProps.handleDOMEvents.copy).toBeUndefined();
    expect(lastConfig.editorProps.handleDOMEvents.cut).toBeUndefined();

    await unmount();
  });

  it("delegates plain/html paste to native behavior", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const clipboardData = {
      getData: (type: string) => {
        if (type === "text/html") return "<p><strong>Title</strong></p>";
        if (type === "text/plain") return "# Title\n\n- item";
        return "";
      },
    };
    const event = {
      clipboardData,
      preventDefault: vi.fn(),
    };

    const handled = lastConfig.editorProps.handleDOMEvents.paste({}, event);

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editorMock.markdown.parse).not.toHaveBeenCalled();
    expect(editorMock.commands.insertContent).not.toHaveBeenCalled();

    await unmount();
  });

  it("pastes explicit markdown mime content as parsed content", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const clipboardData = {
      getData: (type: string) => (type === "text/markdown" ? "# Title\n\n- item" : ""),
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

    await unmount();
  });

  it("skips custom markdown paste while read-only", async () => {
    const onChange = vi.fn();

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
        readOnly: true,
      }),
    );

    const clipboardData = {
      getData: (type: string) => (type === "text/markdown" ? "# Title\n\n- item" : ""),
    };
    const event = {
      clipboardData,
      preventDefault: vi.fn(),
    };

    const handled = lastConfig.editorProps.handleDOMEvents.paste({}, event);

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(editorMock.markdown.parse).not.toHaveBeenCalled();

    await unmount();
  });
});
