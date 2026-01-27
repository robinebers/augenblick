import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteMeta } from "@/lib/types";
import { Icon } from "@/components/icons/Icon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type Props = {
  notes: NoteMeta[];
  onClose: () => void;
  onNewNote: () => void;
  onTogglePinCurrent: () => void;
  onCloseNote: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSelectNote: (id: string) => void;
  onOpenSettings: () => void;
};

type CommandItemDef = {
  id: string;
  label: string;
  icon: "file-text" | "folder-open" | "pin" | "save" | "settings" | "trash";
  shortcut?: string;
  keywords: string[];
  onSelect: () => void;
};

export function CommandPalette({
  notes,
  onClose,
  onNewNote,
  onTogglePinCurrent,
  onCloseNote,
  onOpenFile,
  onSave,
  onSaveAs,
  onSelectNote,
  onOpenSettings,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(true);

  const commands = useMemo<CommandItemDef[]>(
    () => [
      {
        id: "new-note",
        label: "New Note",
        icon: "file-text",
        shortcut: "⌘N",
        keywords: ["new", "note"],
        onSelect: () => {
          onNewNote();
          onClose();
        },
      },
      {
        id: "pin-current",
        label: "Pin / Unpin Current",
        icon: "pin",
        shortcut: "⌘P",
        keywords: ["pin", "unpin"],
        onSelect: () => {
          onTogglePinCurrent();
          onClose();
        },
      },
      {
        id: "save",
        label: "Save",
        icon: "save",
        shortcut: "⌘S",
        keywords: ["save"],
        onSelect: () => {
          onSave();
          onClose();
        },
      },
      {
        id: "save-as",
        label: "Save As…",
        icon: "save",
        shortcut: "⇧⌘S",
        keywords: ["save", "as"],
        onSelect: () => {
          onSaveAs();
          onClose();
        },
      },
      {
        id: "open",
        label: "Open…",
        icon: "folder-open",
        shortcut: "⌘O",
        keywords: ["open", "import", "markdown", "md"],
        onSelect: () => {
          onOpenFile();
          onClose();
        },
      },
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        shortcut: "⌘,",
        keywords: ["settings", "preferences"],
        onSelect: () => {
          onOpenSettings();
          onClose();
        },
      },
      {
        id: "trash",
        label: "Trash",
        icon: "trash",
        shortcut: "⌘W",
        keywords: ["trash", "close"],
        onSelect: () => {
          onCloseNote();
          onClose();
        },
      },
    ],
    [onClose, onCloseNote, onNewNote, onOpenFile, onOpenSettings, onSave, onSaveAs, onTogglePinCurrent],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function requestClose() {
    if (!open) return;
    setOpen(false);
    onClose();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) return requestClose();
        setOpen(true);
      }}
    >
      <CommandInput ref={inputRef} placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Commands">
          {commands.map((item) => (
            <CommandItem
              key={item.id}
              value={item.id}
              keywords={[item.label, ...item.keywords]}
              onSelect={item.onSelect}
            >
              <Icon name={item.icon} className="text-muted-foreground" />
              <span>{item.label}</span>
              {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Notes">
          {notes.map((note) => (
            <CommandItem
              key={note.id}
              value={note.id}
              keywords={[note.title, note.preview]}
              onSelect={() => {
                onSelectNote(note.id);
                onClose();
              }}
            >
              <Icon name="file-text" className="text-muted-foreground" />
              <span className="truncate">{note.title}</span>
              <CommandShortcut>{note.storage === "draft" ? "Draft" : "Saved"}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
