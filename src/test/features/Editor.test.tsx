import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { render } from "@/test/utils/render";

const shared = {
  ctx: null as any,
  lastPlugin: null as any,
  linkConfigKey: Symbol("linkTooltipConfig"),
  tableConfigKey: Symbol("tableBlockConfig"),
  blockSpecKey: Symbol("blockSpec"),
  slashKey: Symbol("slash"),
  selectionToolbarKey: Symbol("selectionToolbar"),
  editorViewOptionsKey: Symbol("editorViewOptions"),
  listenerKey: Symbol("listenerCtx"),
  slashEl: null as HTMLElement | null,
  selectionToolbarEl: null as HTMLElement | null,
  blockHandleEl: null as HTMLElement | null,
};

const mockState = {
  view: null as any,
  listener: null as any,
  ctxValues: new Map<any, any>(),
};

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => {}),
}));

vi.mock("refractor/lang/css.js", () => ({}));
vi.mock("refractor/lang/javascript.js", () => ({}));
vi.mock("refractor/lang/json.js", () => ({}));
vi.mock("refractor/lang/markdown.js", () => ({}));
vi.mock("refractor/lang/tsx.js", () => ({}));
vi.mock("refractor/lang/typescript.js", () => ({}));

vi.mock("@milkdown/core", () => ({
  editorViewOptionsCtx: shared.editorViewOptionsKey,
}));

vi.mock("@milkdown/kit/plugin/listener", () => ({
  listener: {},
  listenerCtx: shared.listenerKey,
}));

vi.mock("@milkdown/utils", () => ({
  $prose: (fn: (ctx: any) => any) => {
    const plugin = fn(shared.ctx);
    shared.lastPlugin = plugin;
    return plugin;
  },
  callCommand: () => () => {},
  markdownToSlice: (text: string) => () => (text ? { text } : null),
  replaceAll: (value: string) => (ctx: any) => {
    ctx.__replaced = value;
  },
}));

vi.mock("@milkdown/prose/state", () => ({
  Plugin: class {
    props: Record<string, any>;
    constructor(spec: { props: Record<string, any> }) {
      this.props = spec.props;
    }
  },
  PluginKey: class {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
  },
  TextSelection: {
    create: (_doc: any, from: number, to: number) => ({ from, to }),
  },
}));

vi.mock("@milkdown/kit/component/link-tooltip", () => ({
  linkTooltipPlugin: {},
  configureLinkTooltip: () => {},
  linkTooltipConfig: { key: shared.linkConfigKey },
}));

vi.mock("@milkdown/theme-nord", () => ({
  nord: {},
}));

vi.mock("@milkdown/kit/plugin/block", () => ({
  blockSpec: { key: shared.blockSpecKey },
  block: {},
  BlockProvider: class {
    update = vi.fn();
    destroy = vi.fn();
    constructor(opts: any) {
      shared.blockHandleEl = opts?.content ?? null;
      if (shared.blockHandleEl && !shared.blockHandleEl.isConnected) {
        document.body.appendChild(shared.blockHandleEl);
      }
    }
  },
}));

vi.mock("@milkdown/kit/plugin/slash", () => ({
  SlashProvider: class {
    content: HTMLElement;
    shouldShow?: (view: any) => boolean;
    constructor(opts: { content: HTMLElement; shouldShow?: (view: any) => boolean }) {
      this.content = opts.content;
      this.shouldShow = opts.shouldShow;
      shared.slashEl = opts.content;
      if (!this.content.isConnected) document.body.appendChild(this.content);
    }
    update(view: any) {
      const show = this.shouldShow ? this.shouldShow(view) : false;
      this.content.dataset.show = show ? "true" : "false";
    }
    getContent(view: any) {
      return view?.__slashContent ?? "";
    }
    hide() {
      this.content.dataset.show = "false";
    }
    destroy() {
      if (this.content.isConnected) this.content.remove();
    }
  },
  slashFactory: () => ({ key: shared.slashKey }),
}));

vi.mock("@milkdown/kit/plugin/tooltip", () => ({
  TooltipProvider: class {
    update = vi.fn();
    destroy = vi.fn();
    constructor(opts: any) {
      shared.selectionToolbarEl = opts?.content ?? null;
      if (shared.selectionToolbarEl && !shared.selectionToolbarEl.isConnected) {
        document.body.appendChild(shared.selectionToolbarEl);
      }
    }
  },
  tooltipFactory: () => ({ key: shared.selectionToolbarKey }),
}));

vi.mock("@milkdown/plugin-prism", () => ({
  prism: {},
  prismConfig: { key: Symbol("prismConfig") },
}));

vi.mock("@milkdown/kit/preset/commonmark", () => ({
  commonmark: {},
  createCodeBlockCommand: { key: "code" },
  insertHrCommand: { key: "hr" },
  insertImageCommand: { key: "img" },
  toggleEmphasisCommand: { key: "em" },
  toggleInlineCodeCommand: { key: "code-inline" },
  toggleStrongCommand: { key: "strong" },
  turnIntoTextCommand: { key: "text" },
  wrapInBlockquoteCommand: { key: "quote" },
  wrapInBulletListCommand: { key: "bullet" },
  wrapInHeadingCommand: { key: "heading" },
  wrapInOrderedListCommand: { key: "ordered" },
}));

vi.mock("@milkdown/kit/preset/gfm", () => ({
  gfm: {},
  insertTableCommand: { key: "table" },
}));

vi.mock("@milkdown/plugin-history", () => ({
  history: {},
}));

vi.mock("@milkdown/kit/component/image-block", () => ({
  imageBlockComponent: {},
}));

vi.mock("@milkdown/kit/component/table-block", () => ({
  tableBlock: {},
  tableBlockConfig: { key: shared.tableConfigKey },
}));

vi.mock("@milkdown/kit/core", async () => {
  const defaultValueCtx = Symbol("defaultValue");
  const editorViewCtx = Symbol("editorViewCtx");
  const rootCtx = Symbol("rootCtx");

  const ctx = {
    set: (key: any, value: any) => mockState.ctxValues.set(key, value),
    update: (key: any, fn: (value: any) => any) =>
      mockState.ctxValues.set(key, fn(mockState.ctxValues.get(key))),
    get: (key: any) => {
      if (key === shared.listenerKey) {
        return {
          markdownUpdated: (cb: any) => {
            mockState.listener = cb;
          },
        };
      }
      if (key === editorViewCtx) return mockState.view;
      return mockState.ctxValues.get(key);
    },
  };

  shared.ctx = ctx;

  const editor = {
    action: (fn: (ctx: any) => any) => fn(ctx),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  const builder = {
    config: (fn: any) => {
      if (typeof fn === "function") fn(ctx);
      return builder;
    },
    use: () => builder,
    create: () => Promise.resolve(editor),
  };

  return {
    Editor: { make: () => builder },
    defaultValueCtx,
    editorViewCtx,
    rootCtx,
    __setMockView: (view: any) => {
      mockState.view = view;
    },
    __getListener: () => mockState.listener,
    __getCtxValue: (key: any) => mockState.ctxValues.get(key),
    __resetMock: () => {
      mockState.ctxValues.clear();
      mockState.listener = null;
      mockState.view = null;
      shared.lastPlugin = null;
      shared.slashEl = null;
      shared.selectionToolbarEl = null;
      shared.blockHandleEl = null;
      mockState.ctxValues.set(shared.linkConfigKey, {});
      mockState.ctxValues.set(shared.tableConfigKey, {});
      mockState.ctxValues.set(shared.editorViewOptionsKey, {});
    },
  };
});

function createDoc(text: string, checked: boolean | null = false) {
  return {
    text,
    descendants: (cb: (node: any, pos: number) => void) => {
      cb({ isText: true, text }, 0);
    },
    textBetween: (from: number, to: number) => text.slice(from, to),
    resolve: (pos: number) => ({
      depth: 1,
      node: (_depth: number) => ({ type: { name: "list_item" }, attrs: { checked } }),
      before: (_depth: number) => pos,
    }),
  };
}

function createView(text: string) {
  const baseSelection = {
    from: 0,
    to: 0,
    $from: { parent: { type: { spec: { code: false } } } },
  };
  const tr: any = {
    inserted: [] as Array<{ text: string; from: number; to: number }>,
    replaced: null as any,
    selection: baseSelection,
    setSelection(sel: { from: number; to: number }) {
      this.selection = { ...sel, $from: baseSelection.$from };
      return this;
    },
    scrollIntoView() {
      return this;
    },
    insertText(textValue: string, from: number, to: number) {
      this.inserted.push({ text: textValue, from, to });
      return this;
    },
    replaceSelection(slice: any) {
      this.replaced = slice;
      return this;
    },
    setNodeMarkup(pos: number, _type: any, attrs: any) {
      this.nodeMarkup = { pos, attrs };
      return this;
    },
  };

  const view: any = {
    editable: true,
    state: {
      doc: createDoc(text),
      selection: baseSelection,
      tr,
    },
    dispatch: (nextTr: any) => {
      if (nextTr.selection) {
        view.state.selection = {
          ...nextTr.selection,
          $from: nextTr.selection.$from ?? baseSelection.$from,
        };
      }
      view.lastDispatch = nextTr;
    },
    focus: vi.fn(),
    posAtDOM: () => 3,
  };

  return view;
}

describe("Editor", () => {
  beforeEach(async () => {
    const { __resetMock } = await import("@milkdown/kit/core");
    __resetMock();
    if (!globalThis.requestAnimationFrame) {
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };
    }
    (navigator as any).clipboard = { writeText: vi.fn(async () => {}) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    shared.slashEl?.remove();
    shared.selectionToolbarEl?.remove();
    shared.blockHandleEl?.remove();
  });

  it("opens find/replace and navigates matches", async () => {
    const view = createView("hello world hello");
    view.state.selection = { from: 0, to: 5, $from: view.state.selection.$from };

    const { __setMockView } = await import("@milkdown/kit/core");
    __setMockView(view);

    const onChange = vi.fn();
    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello world hello",
        onChange,
      }),
    );

    await act(async () => {
      window.dispatchEvent(new Event("augenblick:find"));
      await Promise.resolve();
    });

    const findInput = container.querySelector("input[placeholder=\"Find\"]") as HTMLInputElement;
    expect(findInput).toBeTruthy();
    expect(findInput.value).toBe("hello");

    await act(async () => {
      findInput.value = "hello";
      findInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const next = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Next"),
    ) as HTMLButtonElement;
    await act(async () => {
      next.click();
    });
    expect(view.focus).toHaveBeenCalled();

    const prev = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Prev"),
    ) as HTMLButtonElement;
    await act(async () => {
      prev.click();
    });

    await act(async () => {
      window.dispatchEvent(new Event("augenblick:replace"));
      await Promise.resolve();
    });

    const replaceInput = container.querySelector(
      "input[placeholder=\"Replace\"]",
    ) as HTMLInputElement;
    expect(replaceInput).toBeTruthy();
    await act(async () => {
      replaceInput.value = "hi";
      replaceInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const replaceBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Replace"),
    ) as HTMLButtonElement;
    await act(async () => {
      replaceBtn.click();
    });
    expect(view.state.tr.inserted.length).toBeGreaterThan(0);

    const allBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("All"),
    ) as HTMLButtonElement;
    await act(async () => {
      allBtn.click();
    });
    expect(view.state.tr.inserted.length).toBeGreaterThan(1);

    const closeBtn = container.querySelector("button[aria-label=\"Close Find\"]") as HTMLButtonElement;
    await act(async () => {
      closeBtn.click();
    });
    expect(container.querySelector("input[placeholder=\"Find\"]")).toBeNull();

    await unmount();
  });

  it("respects read-only for replace", async () => {
    const view = createView("hello");
    const { __setMockView } = await import("@milkdown/kit/core");
    __setMockView(view);

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange: vi.fn(),
        readOnly: true,
      }),
    );

    await act(async () => {
      window.dispatchEvent(new Event("augenblick:replace"));
      await Promise.resolve();
    });

    expect(container.querySelector("input[placeholder=\"Replace\"]")).toBeNull();

    await unmount();
  });

  it("handles markdown updates and link tooltip actions", async () => {
    const view = createView("hello");
    const { __setMockView, __getListener, __getCtxValue } = await import("@milkdown/kit/core");
    __setMockView(view);

    const onChange = vi.fn();
    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange,
      }),
    );

    const listener = __getListener();
    await act(async () => {
      listener?.({}, "updated", "prev");
    });
    expect(onChange).toHaveBeenCalledWith("updated");

    const config = __getCtxValue(shared.linkConfigKey) as { onCopyLink?: (link: string) => void };
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await config.onCopyLink?.("https://example.com");
    expect(openUrl).toHaveBeenCalledWith("https://example.com");

    await config.onCopyLink?.("mailto:test@example.com");
    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith("mailto:test@example.com");

    await unmount();
  });

  it("handles paste + task toggle interactions", async () => {
    const view = createView("hello");
    const { __setMockView } = await import("@milkdown/kit/core");
    __setMockView(view);

    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "hello",
        onChange: vi.fn(),
      }),
    );

    const plugin = shared.lastPlugin;
    const pasteEvent = {
      clipboardData: { getData: () => "pasted" },
      preventDefault: vi.fn(),
    } as any;
    const handled = plugin.props.handlePaste(view, pasteEvent);
    expect(handled).toBe(true);
    expect(pasteEvent.preventDefault).toHaveBeenCalled();
    expect(view.state.tr.replaced).toEqual({ text: "pasted" });

    view.state.selection.$from.parent.type.spec.code = true;
    const handledCode = plugin.props.handlePaste(view, pasteEvent);
    expect(handledCode).toBe(false);
    view.state.selection.$from.parent.type.spec.code = false;

    const emptyEvent = {
      clipboardData: { getData: () => "" },
    } as any;
    expect(plugin.props.handlePaste(view, emptyEvent)).toBe(false);

    const li = document.createElement("li");
    li.dataset.itemType = "task";
    li.getBoundingClientRect = () => ({ left: 0 }) as any;
    const clickEvent = new MouseEvent("click", { button: 0 }) as any;
    Object.defineProperty(clickEvent, "target", { value: li });

    const clicked = plugin.props.handleClickOn(view, 0, {}, 0, clickEvent);
    expect(clicked).toBe(true);
    expect(view.state.tr.nodeMarkup).toBeTruthy();

    await unmount();
    expect(container.querySelector(".editor")).toBeNull();
  });

  it("handles slash commands and toolbar actions", async () => {
    const view = createView("slash content");
    view.state.selection.from = 1;
    view.state.selection.to = 1;
    view.__slashContent = "/";

    const { __setMockView, __getCtxValue } = await import("@milkdown/kit/core");
    __setMockView(view);

    window.prompt = vi.fn(() => "https://img");

    const { unmount } = await render(
      React.createElement((await import("@/features/editor/Editor")).Editor, {
        value: "slash content",
        onChange: vi.fn(),
      }),
    );

    const slashConfig = __getCtxValue(shared.slashKey) as { view: () => { update: (v: any) => void } };
    const slashView = slashConfig.view();
    await act(async () => {
      slashView.update(view);
    });

    const items = Array.from(document.querySelectorAll(".mk-slash-item"));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      await act(async () => {
        (item as HTMLElement).click();
      });
    }

    if (shared.slashEl) {
      shared.slashEl.dataset.show = "true";
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
    }

    const toolbar = shared.selectionToolbarEl;
    if (toolbar) {
      const bold = toolbar.querySelector("[data-action=\"bold\"]") as HTMLButtonElement;
      const italic = toolbar.querySelector("[data-action=\"italic\"]") as HTMLButtonElement;
      const code = toolbar.querySelector("[data-action=\"code\"]") as HTMLButtonElement;
      await act(async () => {
        bold?.click();
        italic?.click();
        code?.click();
      });
    }

    const plus = shared.blockHandleEl?.querySelector("[data-action=\"plus\"]") as HTMLElement | null;
    if (plus) {
      await act(async () => {
        plus.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(view.state.tr.inserted.length).toBeGreaterThan(0);
    }

    await unmount();
  });
});
