import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { Icon } from "@/components/icons/Icon";

type Props = {
  editor: TiptapEditor;
  readOnly: boolean;
};

export function LinkBubbleMenu({ editor, readOnly }: Props) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkSelectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });
  const linkActiveRef = useRef(false);

  useEffect(() => {
    if (!showLinkInput) return;
    requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });
  }, [showLinkInput]);

  const closeLinkInput = () => {
    linkActiveRef.current = false;
    setShowLinkInput(false);
    setLinkValue("");
  };

  const openLinkInput = () => {
    if (readOnly) return;
    const { from, to } = editor.state.selection;
    linkSelectionRef.current = { from, to };
    const previous = editor.getAttributes("link").href as string | undefined;
    linkActiveRef.current = Boolean(previous);
    setLinkValue(previous ?? "");
    setShowLinkInput(true);
  };

  const applyLink = () => {
    if (readOnly) return;
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
    if (readOnly) return;
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
  );
}

