import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Icon } from "@/components/icons/Icon";
import { getMarkdownFromClipboard, shouldHandleMarkdownPaste } from "@/features/editor/clipboardPolicy";

type Props = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
};

const lowlight = createLowlight(common);
const MarkdownImageText = Extension.create({
  name: "markdownImageText",
  markdownTokenName: "image",
  parseMarkdown: (token, helpers) => {
    const raw = (token.raw ?? token.text ?? "").toString();
    if (!raw) return null;
    return helpers.createTextNode(raw);
  },
});

const MarkdownTableText = Extension.create({
  name: "markdownTableText",
  markdownTokenName: "table",
  parseMarkdown: (token, helpers) => {
    const raw = (token.raw ?? "").toString().replace(/\n$/, "");
    if (!raw) return null;
    return helpers.createNode("paragraph", null, [helpers.createTextNode(raw)]);
  },
});

async function openLink(href: string) {
  try {
    await openUrl(href);
  } catch (error) {
    console.debug("tiptap:link-open-fallback", { href, error });
    window.open(href, "_blank");
  }
}

export function Editor({ value, onChange, readOnly = false }: Props) {
  const onChangeRef = useRef(onChange);
  const readOnlyRef = useRef(readOnly);
  const lastMarkdownRef = useRef(value);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkSelectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });
  const linkActiveRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: {
            openOnClick: false,
            autolink: true,
            linkOnPaste: true,
          },
        }),
        CodeBlockLowlight.configure({ lowlight }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        MarkdownImageText,
        MarkdownTableText,
        Placeholder.configure({
          placeholder: "Start writing...",
        }),
        Markdown.configure({
          indentation: { style: "space", size: 2 },
          markedOptions: { gfm: true },
        }),
      ],
      content: value,
      contentType: "markdown",
      editable: !readOnly,
      onUpdate: ({ editor }) => {
        const next = editor.getMarkdown();
        if (next === lastMarkdownRef.current) return;
        lastMarkdownRef.current = next;
        if (!readOnlyRef.current) onChangeRef.current(next);
      },
      editorProps: {
        handleDOMEvents: {
          click: (_view, event) => {
            const target = event.target as HTMLElement | null;
            const anchor = target?.closest?.("a");
            if (!anchor) return false;
            const href = anchor.getAttribute("href") ?? "";
            const mouseEvent = event as MouseEvent;
            const metaKey = mouseEvent.metaKey;
            const ctrlKey = mouseEvent.ctrlKey;
            const shiftKey = mouseEvent.shiftKey;
            const altKey = mouseEvent.altKey;
            console.debug("tiptap:link-click", { href, metaKey, ctrlKey, shiftKey, altKey });
            event.preventDefault();
            if ((metaKey || ctrlKey) && href) {
              console.debug("tiptap:link-open", { href });
              void openLink(href);
            }
            return false;
          },
          paste: (_view, event) => {
            if (readOnlyRef.current) return false;
            const editorInstance = editorRef.current;
            if (!editorInstance) return false;
            if (!editorInstance.markdown) return false;
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;
            if (!shouldHandleMarkdownPaste(clipboardData)) return false;
            const text = getMarkdownFromClipboard(clipboardData);
            if (!text) return false;
            event.preventDefault();
            const parsed = editorInstance.markdown.parse(text);
            const content = Array.isArray(parsed.content) ? parsed.content : [];
            editorInstance.commands.insertContent(content);
            return true;
          },
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastMarkdownRef.current) return;
    lastMarkdownRef.current = value;
    editor.commands.setContent(value, { contentType: "markdown" });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    const onFocusEditor = () => {
      editor.commands.focus("end");
    };
    window.addEventListener("augenblick:focus-editor", onFocusEditor);
    return () => {
      window.removeEventListener("augenblick:focus-editor", onFocusEditor);
    };
  }, [editor]);

  useEffect(() => {
    if (!showLinkInput) return;
    requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });
  }, [showLinkInput]);

  const openLinkInput = () => {
    if (!editor || readOnlyRef.current) return;
    const { from, to } = editor.state.selection;
    linkSelectionRef.current = { from, to };
    const previous = editor.getAttributes("link").href as string | undefined;
    linkActiveRef.current = Boolean(previous);
    setLinkValue(previous ?? "");
    setShowLinkInput(true);
  };

  const closeLinkInput = () => {
    linkActiveRef.current = false;
    setShowLinkInput(false);
    setLinkValue("");
  };

  const applyLink = () => {
    if (!editor || readOnlyRef.current) return;
    const trimmed = linkValue.trim();
    const { from, to } = linkSelectionRef.current;
    const chain = editor.chain().focus().setTextSelection({ from, to });
    if (!trimmed) {
      chain.extendMarkRange("link").unsetLink().run();
      closeLinkInput();
      return;
    }
    if (from === to && !linkActiveRef.current) {
      chain
        .insertContent({
          type: "text",
          text: trimmed,
          marks: [{ type: "link", attrs: { href: trimmed } }],
        })
        .run();
      closeLinkInput();
      return;
    }
    chain.extendMarkRange("link").setLink({ href: trimmed }).run();
    closeLinkInput();
  };

  const removeLink = () => {
    if (!editor || readOnlyRef.current) return;
    const { from, to } = linkSelectionRef.current;
    editor.chain().focus().setTextSelection({ from, to }).extendMarkRange("link").unsetLink().run();
    closeLinkInput();
  };

  const onLinkInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLink();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeLinkInput();
    }
  };

  return (
    <div className="h-full overflow-auto" style={{ background: "var(--bg-primary)" }}>
      <div
        className="mx-auto flex h-full max-w-[720px] flex-col px-10"
        style={{ paddingTop: "var(--titlebar-inset, 0px)", paddingBottom: 24 }}
      >
        {editor && !readOnly ? (
          <BubbleMenu
            editor={editor}
            className="tiptap-bubble"
            options={{
              duration: 150,
              interactive: true,
              onHide: closeLinkInput,
            }}
            shouldShow={({ state }) => {
              if (showLinkInput) return true;
              const { selection } = state;
              const { from, to, empty } = selection;

              if (!empty) {
                const selectedText = state.doc.textBetween(from, to, " ", " ");
                return selectedText.trim().length > 0;
              }

              if (!state.doc.textContent.trim().length) return false;

              const linkMark = state.schema.marks.link;
              if (!linkMark || !("$from" in selection)) return false;

              return selection.$from.marks().some((mark) => mark.type === linkMark);
            }}
          >
            <button
              type="button"
              className="tiptap-bubble-btn"
              data-active={editor.isActive("bold") || undefined}
              aria-pressed={editor.isActive("bold")}
              aria-label="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Icon name="bold" size={16} />
            </button>
            <button
              type="button"
              className="tiptap-bubble-btn"
              data-active={editor.isActive("italic") || undefined}
              aria-pressed={editor.isActive("italic")}
              aria-label="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Icon name="italic" size={16} />
            </button>
            <button
              type="button"
              className="tiptap-bubble-btn"
              data-active={editor.isActive("strike") || undefined}
              aria-pressed={editor.isActive("strike")}
              aria-label="Strike"
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Icon name="strike" size={16} />
            </button>
            <button
              type="button"
              className="tiptap-bubble-btn"
              data-active={editor.isActive("code") || undefined}
              aria-pressed={editor.isActive("code")}
              aria-label="Code"
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Icon name="code" size={16} />
            </button>
            {showLinkInput ? null : (
              <button
                type="button"
                className="tiptap-bubble-btn"
                data-active={editor.isActive("link") || undefined}
                aria-pressed={editor.isActive("link")}
                aria-label="Link"
                onClick={openLinkInput}
              >
                <Icon name="link" size={16} />
              </button>
            )}
            {showLinkInput ? (
              <div className="tiptap-link-input-wrap">
                <input
                  ref={linkInputRef}
                  className="tiptap-link-input"
                  type="url"
                  placeholder="Paste link"
                  value={linkValue}
                  onChange={(event) => setLinkValue(event.target.value)}
                  onKeyDown={onLinkInputKeyDown}
                />
                <button type="button" className="tiptap-bubble-btn" aria-label="Apply link" onClick={applyLink}>
                  <Icon name="save" size={14} />
                </button>
                <button type="button" className="tiptap-bubble-btn" aria-label="Remove link" onClick={removeLink}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ) : null}
          </BubbleMenu>
        ) : null}
        <div className="flex-1">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  );
}
