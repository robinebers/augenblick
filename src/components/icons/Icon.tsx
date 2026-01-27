import {
  FileText,
  FolderOpen,
  Pin,
  RotateCcw,
  Search,
  Save,
  Settings,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

export type IconName =
  | "file-text"
  | "folder-open"
  | "pin"
  | "restore"
  | "search"
  | "save"
  | "settings"
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

  if (name === "file-text") return <FileText {...shared} />;
  if (name === "folder-open") return <FolderOpen {...shared} />;
  if (name === "pin") return <Pin {...shared} />;
  if (name === "search") return <Search {...shared} />;
  if (name === "save") return <Save {...shared} />;
  if (name === "settings") return <Settings {...shared} />;
  if (name === "trash") return <Trash2 {...shared} />;
  if (name === "restore") return <RotateCcw {...shared} />;
  if (name === "undo") return <Undo2 {...shared} />;
  if (name === "x") return <X {...shared} />;
  return null;
}
