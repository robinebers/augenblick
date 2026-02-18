import { EditorContent } from "@tiptap/react";
import { LinkBubbleMenu } from "@/features/editor/LinkBubbleMenu";
import { useEditorConfig } from "@/features/editor/useEditorConfig";

type Props = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
};

export function Editor({ value, onChange, readOnly = false }: Props) {
  const editor = useEditorConfig({ value, onChange, readOnly });

  return (
    <div className="h-full overflow-auto" style={{ background: "var(--bg-primary)" }}>
      <div
        className="mx-auto flex h-full max-w-[720px] flex-col px-10"
        style={{ paddingTop: "var(--titlebar-inset, 0px)", paddingBottom: 24 }}
      >
        {editor && !readOnly ? <LinkBubbleMenu editor={editor} readOnly={readOnly} /> : null}
        <div className="flex-1">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>
    </div>
  );
}
