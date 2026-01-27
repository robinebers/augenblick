import { Editor } from "@/features/editor/Editor";

type Props = {
  content: string;
};

export function TrashPreview({ content }: Props) {
  return <Editor value={content} onChange={() => {}} readOnly />;
}
