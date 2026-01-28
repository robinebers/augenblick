import {
  Bold,
  Code,
  FileText,
  FolderOpen,
  Italic,
  Link,
  Pin,
  RotateCcw,
  Search,
  Save,
  Settings,
  Strikethrough,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

export type IconName =
  | "bold"
  | "code"
  | "file-text"
  | "folder-open"
  | "italic"
  | "link"
  | "pin"
  | "restore"
  | "search"
  | "save"
  | "settings"
  | "strike"
  | "trash"
  | "undo"
  | "x";

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 18, className = "", label, strokeWidth = 1.75 }: Props) {
  const shared = {
    size,
    strokeWidth,
    className,
    "aria-label": label,
    "aria-hidden": label ? undefined : "true",
  } as const;

  if (name === "bold") return <Bold {...shared} />;
  if (name === "code") return <Code {...shared} />;
  if (name === "file-text") return <FileText {...shared} />;
  if (name === "folder-open") return <FolderOpen {...shared} />;
  if (name === "italic") return <Italic {...shared} />;
  if (name === "link") return <Link {...shared} />;
  if (name === "pin") return <Pin {...shared} />;
  if (name === "strike") return <Strikethrough {...shared} />;
  if (name === "search") return <Search {...shared} />;
  if (name === "save") return <Save {...shared} />;
  if (name === "settings") return <Settings {...shared} />;
  if (name === "trash") return <Trash2 {...shared} />;
  if (name === "restore") return <RotateCcw {...shared} />;
  if (name === "undo") return <Undo2 {...shared} />;
  if (name === "x") return <X {...shared} />;
  return null;
}
