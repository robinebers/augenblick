import { useEffect, useRef } from "react";
import { Extension } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { getMarkdownFromClipboard, shouldHandleMarkdownPaste } from "@/features/editor/clipboardPolicy";

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

type Params = {
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
};

export function useEditorConfig({ value, onChange, readOnly }: Params) {
  const onChangeRef = useRef(onChange);
  const readOnlyRef = useRef(readOnly);
  const lastMarkdownRef = useRef(value);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

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
            event.preventDefault();
            if ((metaKey || ctrlKey) && href) {
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
            const markdown = getMarkdownFromClipboard(clipboardData);
            if (!markdown) return false;
            event.preventDefault();
            const parsed = editorInstance.markdown.parse(markdown);
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

  return editor;
}

