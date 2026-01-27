import { useCallback, useEffect, useRef, useState } from "react";
import { editorViewOptionsCtx } from "@milkdown/core";
import { Editor as MilkEditor, defaultValueCtx, editorViewCtx, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm, insertTableCommand } from "@milkdown/kit/preset/gfm";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { prism, prismConfig } from "@milkdown/plugin-prism";
import { history } from "@milkdown/plugin-history";
import { blockSpec, block, BlockProvider } from "@milkdown/kit/plugin/block";
import { SlashProvider, slashFactory } from "@milkdown/kit/plugin/slash";
import { TooltipProvider, tooltipFactory } from "@milkdown/kit/plugin/tooltip";
import { nord } from "@milkdown/theme-nord";
import type { Node as ProseNode } from "@milkdown/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import {
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { imageBlockComponent } from "@milkdown/kit/component/image-block";
import { tableBlock, tableBlockConfig } from "@milkdown/kit/component/table-block";
import * as milkdownUtils from "@milkdown/utils";
import css from "refractor/lang/css.js";
import javascript from "refractor/lang/javascript.js";
import json from "refractor/lang/json.js";
import markdown from "refractor/lang/markdown.js";
import tsx from "refractor/lang/tsx.js";
import typescript from "refractor/lang/typescript.js";
import { Icon } from "@/components/icons/Icon";

type Props = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
};

type Match = { from: number; to: number };

export function Editor({ value, onChange, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorPromiseRef = useRef<Promise<MilkEditor> | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastMarkdownRef = useRef("");
  const readOnlyRef = useRef(readOnly);
  const onChangeRef = useRef(onChange);

  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [query, setQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [cursor, setCursor] = useState(0);
  const [isEmpty, setIsEmpty] = useState(value.trim().length === 0);

  const showFindRef = useRef(false);
  const queryRef = useRef("");
  const matchesRef = useRef<Match[]>([]);
  const cursorRef = useRef(0);

  const findInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);


  useEffect(() => {
    showFindRef.current = showFind;
  }, [showFind]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const prose = milkdownUtils["$prose"];
  const { callCommand, markdownToSlice } = milkdownUtils;
  const replaceAllMarkdown = milkdownUtils.replaceAll;

  const ensureView = useCallback(async () => {
    if (viewRef.current) return viewRef.current;
    const promise = editorPromiseRef.current;
    if (!promise) return null;
    const editor = await promise;
    viewRef.current = editor.action((ctx) => ctx.get(editorViewCtx));
    return viewRef.current;
  }, []);

  const findMatchesInDoc = useCallback((doc: ProseNode, q: string): Match[] => {
    if (!q) return [];
    const queryLower = q.toLowerCase();
    const out: Match[] = [];
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const haystack = node.text.toLowerCase();
      let idx = 0;
      while (true) {
        const found = haystack.indexOf(queryLower, idx);
        if (found === -1) break;
        out.push({ from: pos + found, to: pos + found + q.length });
        idx = found + Math.max(1, q.length);
      }
    });
    return out;
  }, []);

  const refreshMatches = useCallback(() => {
    const view = viewRef.current;
    const q = queryRef.current;
    if (!view || !q) {
      setMatches([]);
      setCursor(0);
      return;
    }
    const next = findMatchesInDoc(view.state.doc, q);
    setMatches(next);
    setCursor((c) => (next.length === 0 ? 0 : c >= next.length ? 0 : c));
  }, [findMatchesInDoc]);

  const selectMatch = useCallback(
    (index: number) => {
      const view = viewRef.current;
      if (!view) return;
      refreshMatches();
      const current = matchesRef.current;
      const next =
        current.length === 0 ? null : ((index % current.length) + current.length) % current.length;
      if (next == null || current.length === 0) return;
      setCursor(next);
      const match = current[next]!;
      const sel = TextSelection.create(view.state.doc, match.from, match.to);
      view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
      view.focus();
    },
    [refreshMatches],
  );

  const selectNextFrom = useCallback(
    (pos: number) => {
      const current = matchesRef.current;
      if (current.length === 0) return;
      const idx = current.findIndex((m) => m.from > pos);
      selectMatch(idx === -1 ? 0 : idx);
    },
    [selectMatch],
  );

  const selectPrevFrom = useCallback(
    (pos: number) => {
      const current = matchesRef.current;
      if (current.length === 0) return;
      let idx = -1;
      for (let i = current.length - 1; i >= 0; i--) {
        if (current[i]!.to < pos) {
          idx = i;
          break;
        }
      }
      selectMatch(idx === -1 ? current.length - 1 : idx);
    },
    [selectMatch],
  );

  const closeFind = useCallback(() => {
    setShowFind(false);
    setShowReplace(false);
    setMatches([]);
    setCursor(0);
    showFindRef.current = false;
    matchesRef.current = [];
    cursorRef.current = 0;
    viewRef.current?.focus();
  }, []);

  const openFindBar = useCallback(
    async (replace: boolean) => {
      await ensureView();
      setShowFind(true);
      setShowReplace(replace && !readOnlyRef.current);
      showFindRef.current = true;

      const view = viewRef.current;
      if (view) {
        const sel = view.state.selection;
        if (sel.from !== sel.to) {
          const selectedText = view.state.doc.textBetween(sel.from, sel.to, "\n").trim();
          if (selectedText) {
            setQuery(selectedText);
            queryRef.current = selectedText;
          }
        }
      }

      requestAnimationFrame(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      });

      refreshMatches();
      if (view && queryRef.current) selectNextFrom(view.state.selection.to);
    },
    [ensureView, refreshMatches, selectNextFrom],
  );

  const onFindInput = useCallback(
    (next: string) => {
      setQuery(next);
      queryRef.current = next;
      refreshMatches();
      const view = viewRef.current;
      if (!view || !next) return;
      selectNextFrom(view.state.selection.to);
    },
    [refreshMatches, selectNextFrom],
  );

  const replaceCurrent = useCallback(() => {
    if (readOnlyRef.current || !viewRef.current?.editable) return;
    const view = viewRef.current;
    if (!view) return;
    refreshMatches();
    const current = matchesRef.current;
    if (current.length === 0) return;
    const sel = view.state.selection;
    const idx = current.findIndex((m) => m.from === sel.from && m.to === sel.to);
    if (idx === -1) {
      selectNextFrom(sel.to);
      return;
    }
    const match = current[idx]!;
    view.dispatch(view.state.tr.insertText(replaceWith, match.from, match.to).scrollIntoView());
    requestAnimationFrame(() => {
      refreshMatches();
      if (viewRef.current) selectNextFrom(viewRef.current.state.selection.to);
    });
  }, [refreshMatches, replaceWith, selectNextFrom]);

  const replaceAll = useCallback(() => {
    if (readOnlyRef.current || !viewRef.current?.editable) return;
    const view = viewRef.current;
    if (!view) return;
    refreshMatches();
    const current = matchesRef.current;
    if (current.length === 0) return;
    let tr = view.state.tr;
    for (const match of [...current].reverse()) {
      tr = tr.insertText(replaceWith, match.from, match.to);
    }
    view.dispatch(tr.scrollIntoView());
    requestAnimationFrame(() => refreshMatches());
  }, [refreshMatches, replaceWith]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const slash = slashFactory("augenblick");
    const slashEl = document.createElement("div");
    slashEl.className = "mk-slash";

    const selectionToolbar = tooltipFactory("augenblick-selection");
    const selectionToolbarEl = document.createElement("div");
    selectionToolbarEl.className = "mk-selection-toolbar";

    const blockHandleEl = document.createElement("div");
    blockHandleEl.className = "mk-block-handle";
    blockHandleEl.innerHTML = `
      <button type="button" class="mk-block-btn" data-action="plus" aria-label="Insert block">+</button>
      <div class="mk-block-grab" data-action="drag" aria-label="Drag block" title="Drag">⋮⋮</div>
    `;

    let slashSearch = "";
    let slashIndex = 0;
    let slashItems: { id: string; label: string; keywords: string[]; run: () => void }[] = [];

    function setSlashItems(items: typeof slashItems) {
      slashItems = items;
      if (slashIndex >= slashItems.length) slashIndex = 0;
    }

    function renderSlash() {
      const rows = slashItems
        .map((item, idx) => {
          const selected = idx === slashIndex;
          return `<button type="button" class="mk-slash-item" data-id="${item.id}" ${
            selected ? 'data-selected="true"' : ""
          }>${item.label}</button>`;
        })
        .join("");
      slashEl.innerHTML = `<div class="mk-slash-inner">${rows || `<div class="mk-slash-empty">No results</div>`}</div>`;
    }

    function deleteSlashTrigger(v: EditorView, provider: SlashProvider) {
      const content = provider.getContent(v) ?? "";
      const match = content.match(/\/[\w-]*$/);
      if (!match) return;
      const from = v.state.selection.from - match[0].length;
      const to = v.state.selection.from;
      if (from < 0 || from >= to) return;
      v.dispatch(v.state.tr.delete(from, to));
    }

    function runEditorAction(fn: (editor: MilkEditor) => void) {
      if (readOnlyRef.current) return;
      const p = editorPromiseRef.current;
      if (!p) return;
      void p.then(fn);
    }

    function makeSlashCommands(v: EditorView, provider: SlashProvider) {
      const base: typeof slashItems = [
        {
          id: "text",
          label: "Text",
          keywords: ["paragraph", "text"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(turnIntoTextCommand.key));
            }),
        },
        {
          id: "h1",
          label: "Heading 1",
          keywords: ["heading", "h1", "#"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(wrapInHeadingCommand.key, 1));
            }),
        },
        {
          id: "h2",
          label: "Heading 2",
          keywords: ["heading", "h2", "##"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(wrapInHeadingCommand.key, 2));
            }),
        },
        {
          id: "bullet",
          label: "Bullet List",
          keywords: ["list", "bullet", "-"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(wrapInBulletListCommand.key));
            }),
        },
        {
          id: "task",
          label: "Task List",
          keywords: ["task", "todo", "checkbox", "list"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const slice = markdownToSlice("- [ ] ")(ctx);
                if (!slice) return;
                view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
                view.focus();
              });
            }),
        },
        {
          id: "ordered",
          label: "Numbered List",
          keywords: ["list", "ordered", "1."],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(wrapInOrderedListCommand.key));
            }),
        },
        {
          id: "quote",
          label: "Quote",
          keywords: ["blockquote", "quote", ">"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(wrapInBlockquoteCommand.key));
            }),
        },
        {
          id: "code",
          label: "Code Block",
          keywords: ["code", "```"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(createCodeBlockCommand.key));
            }),
        },
        {
          id: "hr",
          label: "Divider",
          keywords: ["divider", "hr", "---"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(insertHrCommand.key));
            }),
        },
        {
          id: "table",
          label: "Table (3×3)",
          keywords: ["table", "grid"],
          run: () =>
            runEditorAction((editor) => {
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(insertTableCommand.key, { row: 3, col: 3 }));
            }),
        },
        {
          id: "image",
          label: "Image (URL)…",
          keywords: ["image", "img", "picture"],
          run: () =>
            runEditorAction((editor) => {
              const src = window.prompt("Image URL");
              if (!src) return;
              deleteSlashTrigger(v, provider);
              editor.action(callCommand(insertImageCommand.key, { src }));
            }),
        },
      ];

      const q = slashSearch.trim().toLowerCase();
      if (!q) return base;
      return base.filter((c) => [c.label, ...c.keywords].some((p) => p.toLowerCase().includes(q)));
    }

    const slashProvider = new SlashProvider({
      content: slashEl,
      offset: 8,
      shouldShow(this: SlashProvider, view) {
        const content = this.getContent(view) ?? "";
        const m = content.match(/\/(\w[\w-]*)?$/);
        return Boolean(m);
      },
    });

    slashEl.addEventListener("mousedown", (e) => e.preventDefault());
    slashEl.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(".mk-slash-item");
      const id = target?.dataset.id;
      if (!id) return;
      const item = slashItems.find((x) => x.id === id);
      item?.run();
      ensureView().then((v) => v?.focus());
    });

    const onSlashKeyDown = (e: KeyboardEvent) => {
      if (slashEl.dataset.show !== "true") return;
      if (slashItems.length === 0) return;
      if (e.key === "Escape") {
        e.preventDefault();
        slashProvider.hide();
        ensureView().then((v) => v?.focus());
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        slashIndex = (slashIndex + 1) % slashItems.length;
        renderSlash();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        slashIndex = (slashIndex - 1 + slashItems.length) % slashItems.length;
        renderSlash();
        return;
      }
      if (e.key === "Enter") {
        const item = slashItems[slashIndex];
        if (!item) return;
        e.preventDefault();
        item.run();
        ensureView().then((v) => v?.focus());
      }
    };
    window.addEventListener("keydown", onSlashKeyDown, true);

    const selectionToolbarProvider = new TooltipProvider({
      content: selectionToolbarEl,
      offset: 8,
      shouldShow: (v) => !readOnlyRef.current && v.editable && v.state.selection.content().size > 0,
    });

    selectionToolbarEl.addEventListener("mousedown", (e) => e.preventDefault());
    selectionToolbarEl.addEventListener("click", (e) => {
      if (readOnlyRef.current) return;
      const action = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-action]")?.dataset
        .action;
      if (!action) return;
      if (action === "bold") runEditorAction((ed) => ed.action(callCommand(toggleStrongCommand.key)));
      if (action === "italic")
        runEditorAction((ed) => ed.action(callCommand(toggleEmphasisCommand.key)));
      if (action === "code")
        runEditorAction((ed) => ed.action(callCommand(toggleInlineCodeCommand.key)));
    });
    selectionToolbarEl.innerHTML = `
      <div class="mk-selection-inner">
        <button type="button" class="mk-selection-btn" data-action="bold"><strong>B</strong></button>
        <button type="button" class="mk-selection-btn" data-action="italic"><em>I</em></button>
        <button type="button" class="mk-selection-btn" data-action="code"><span>&lt;/&gt;</span></button>
      </div>
    `;

    const p = MilkEditor.make()
      .config((ctx) => {
        ctx.set(rootCtx, node);
        ctx.set(defaultValueCtx, value);
        ctx.set(prismConfig.key, {
          configureRefractor: (refractor) => {
            refractor.register(markdown);
            refractor.register(css);
            refractor.register(javascript);
            refractor.register(typescript);
            refractor.register(tsx);
            refractor.register(json);
          },
        });

        const l = ctx.get(listenerCtx);
        l.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          lastMarkdownRef.current = markdown;
          setIsEmpty(markdown.trim().length === 0);
          if (!readOnlyRef.current && markdown !== prevMarkdown) onChangeRef.current(markdown);
          if (showFindRef.current) refreshMatches();
        });

        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnlyRef.current,
        }));

        ctx.update(tableBlockConfig.key, (cfg) => ({
          ...cfg,
          renderButton: (type) => {
            switch (type) {
              case "add_row":
              case "add_col":
                return "＋";
              case "delete_row":
              case "delete_col":
                return "−";
              case "align_col_left":
                return "⟸";
              case "align_col_center":
                return "↔";
              case "align_col_right":
                return "⟹";
              case "col_drag_handle":
              case "row_drag_handle":
                return "⠿";
            }
          },
        }));

        ctx.set(blockSpec.key, {
          view: () => {
            const provider = new BlockProvider({
              ctx,
              content: blockHandleEl,
              getOffset: () => 8,
            });

            const onPlus = (ev: MouseEvent) => {
              const target = ev.target as HTMLElement | null;
              const action = target?.closest<HTMLElement>("[data-action]")?.dataset.action;
              if (action !== "plus") return;
              ev.preventDefault();
              void ensureView().then((v) => {
                if (!v) return;
                v.dispatch(v.state.tr.insertText("/"));
                v.focus();
              });
            };
            blockHandleEl.addEventListener("click", onPlus);

            return {
              update: provider.update,
              destroy: () => {
                blockHandleEl.removeEventListener("click", onPlus);
                provider.destroy();
              },
            };
          },
        });

        ctx.set(slash.key, {
          view: () => ({
            update: (v, prevState) => {
              slashProvider.update(v, prevState);
              const content = slashProvider.getContent(v) ?? "";
              const m = content.match(/\/(\w[\w-]*)?$/);
              slashSearch = m?.[1] ?? "";
              setSlashItems(makeSlashCommands(v, slashProvider));
              if (slashItems.length === 0) slashIndex = 0;
              renderSlash();
            },
            destroy: () => slashProvider.destroy(),
          }),
        });

        ctx.set(selectionToolbar.key, {
          view: () => ({
            update: selectionToolbarProvider.update,
            destroy: selectionToolbarProvider.destroy,
          }),
        });
      })
      .config(nord)
      .use(listener)
      .use(commonmark)
      .use(gfm)
      .use(prism)
      .use(
        prose((ctx: any) => {
          return new Plugin({
            key: new PluginKey("editor-interactions"),
            props: {
              handlePaste(view, event) {
                const text = event.clipboardData?.getData("text/plain");
                if (!text) return false;
                if (view.state.selection.$from.parent.type.spec.code) return false;

                const slice = markdownToSlice(text)(ctx);
                if (slice) {
                  event.preventDefault();
                  view.dispatch(view.state.tr.replaceSelection(slice));
                  return true;
                }
                return false;
              },
              handleClickOn(view, _pos, node, nodePos, event) {
                if (readOnlyRef.current || !view.editable) return false;
                if (!(event instanceof MouseEvent) || event.button !== 0) return false;
                const target = event.target as HTMLElement | null;
                const li = target?.closest?.("li[data-item-type='task']");
                if (!li) return false;
                const rect = li.getBoundingClientRect();
                const hit = event.clientX - rect.left <= 24;
                if (!hit) return false;
                const pos = view.posAtDOM(li, 0);
                if (pos == null) return false;
                const resolved = view.state.doc.resolve(pos);
                let depth = resolved.depth;
                while (depth > 0 && resolved.node(depth).type.name !== "list_item") depth -= 1;
                if (depth === 0) return false;
                const listItem = resolved.node(depth);
                if (listItem.attrs.checked == null) return false;
                const checked = !Boolean(listItem.attrs.checked);
                view.dispatch(
                  view.state.tr.setNodeMarkup(resolved.before(depth), undefined, {
                    ...listItem.attrs,
                    checked,
                  }),
                );
                return true;
              },
            },
          });
        }),
      )
      .use(history)
      .use(block)
      .use(slash)
      .use(selectionToolbar)
      .use(imageBlockComponent)
      .use(tableBlock)
      .create();

    editorPromiseRef.current = p;
    void p.then(() => {
      if (editorPromiseRef.current !== p) return;
      requestAnimationFrame(() => {
        const editorEl = node.querySelector<HTMLElement>(".editor");
        editorEl?.focus();
      });
    });
    void p.then((editor) => {
      if (editorPromiseRef.current !== p) return;
      viewRef.current = editor.action((ctx) => ctx.get(editorViewCtx));
    });

    return () => {
      slashProvider.destroy();
      selectionToolbarProvider.destroy();
      window.removeEventListener("keydown", onSlashKeyDown, true);
      const promise = editorPromiseRef.current;
      editorPromiseRef.current = null;
      viewRef.current = null;
      if (!promise) return;
      void (async () => {
        const editor = await promise;
        await editor.destroy();
      })();
    };
  }, []);

  useEffect(() => {
    const run = (task: () => Promise<void>) => () => {
      void task();
    };

    const onFind = run(() => openFindBar(false));
    const onReplace = run(() => openFindBar(true));
    const onFindNext = run(async () => {
      if (!showFindRef.current) await openFindBar(false);
      await ensureView();
      refreshMatches();
      const view = viewRef.current;
      if (!view || !queryRef.current) return;
      selectNextFrom(view.state.selection.to);
    });
    const onFindPrev = run(async () => {
      if (!showFindRef.current) await openFindBar(false);
      await ensureView();
      refreshMatches();
      const view = viewRef.current;
      if (!view || !queryRef.current) return;
      selectPrevFrom(view.state.selection.from);
    });

    window.addEventListener("augenblick:find", onFind);
    window.addEventListener("augenblick:replace", onReplace);
    window.addEventListener("augenblick:find-next", onFindNext);
    window.addEventListener("augenblick:find-prev", onFindPrev);

    return () => {
      window.removeEventListener("augenblick:find", onFind);
      window.removeEventListener("augenblick:replace", onReplace);
      window.removeEventListener("augenblick:find-next", onFindNext);
      window.removeEventListener("augenblick:find-prev", onFindPrev);
    };
  }, [ensureView, openFindBar, refreshMatches, selectNextFrom, selectPrevFrom]);

  useEffect(() => {
    if (value === lastMarkdownRef.current) return;
    lastMarkdownRef.current = value;
    setIsEmpty(value.trim().length === 0);
    const p = editorPromiseRef.current;
    if (!p) return;
    void p.then((editor) => {
      editor.action(replaceAllMarkdown(value, true));
    });
  }, [value, replaceAllMarkdown]);

  return (
    <div className="h-full overflow-auto" style={{ background: "var(--bg-primary)" }}>
      <div
        className="mx-auto flex h-full max-w-[720px] flex-col px-10"
        style={{ paddingTop: "var(--titlebar-inset, 0px)", paddingBottom: 24 }}
      >
        {showFind ? (
          <div
            className="sticky top-0 z-10 -mx-10 mb-4 border-b px-10 py-2"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-primary)" }}
          >
            <div className="flex items-center gap-2">
              <input
                ref={findInputRef}
                value={query}
                placeholder="Find"
                className="h-9 flex-1 rounded-md border px-3 text-[13px] outline-none"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
                onChange={(e) => onFindInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeFind();
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  refreshMatches();
                  const view = viewRef.current;
                  if (!view) return;
                  if (e.shiftKey) selectPrevFrom(view.state.selection.from);
                  else selectNextFrom(view.state.selection.to);
                }}
              />

              <div className="w-[56px] text-right text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {matches.length === 0 ? "0/0" : `${cursor + 1}/${matches.length}`}
              </div>

              <button
                type="button"
                className="h-9 rounded-md px-3 text-[13px] hover:bg-[var(--bg-tertiary)]"
                onClick={() => {
                  refreshMatches();
                  const view = viewRef.current;
                  if (!view) return;
                  selectPrevFrom(view.state.selection.from);
                }}
                disabled={matches.length === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="h-9 rounded-md px-3 text-[13px] hover:bg-[var(--bg-tertiary)]"
                onClick={() => {
                  refreshMatches();
                  const view = viewRef.current;
                  if (!view) return;
                  selectNextFrom(view.state.selection.to);
                }}
                disabled={matches.length === 0}
              >
                Next
              </button>

              <button
                type="button"
                className="h-9 w-9 rounded-md hover:bg-[var(--bg-tertiary)]"
                aria-label="Close Find"
                onClick={closeFind}
              >
                <Icon name="x" />
              </button>
            </div>

            {showReplace ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={replaceInputRef}
                  value={replaceWith}
                  placeholder="Replace"
                  className="h-9 flex-1 rounded-md border px-3 text-[13px] outline-none"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                  }}
                  onChange={(e) => setReplaceWith(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeFind();
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    replaceCurrent();
                  }}
                />
                <button
                  type="button"
                  className="h-9 rounded-md px-3 text-[13px] hover:bg-[var(--bg-tertiary)]"
                  onClick={replaceCurrent}
                  disabled={matches.length === 0}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="h-9 rounded-md px-3 text-[13px] hover:bg-[var(--bg-tertiary)]"
                  onClick={replaceAll}
                  disabled={matches.length === 0}
                >
                  All
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="relative flex-1">
          {isEmpty ? (
            <div
              className="pointer-events-none absolute left-0 top-0 text-[15px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Start writing...
            </div>
          ) : null}
          <div ref={containerRef} className="h-full" />
        </div>
      </div>
    </div>
  );
}
