import type { NoteMeta } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils/time";
import { ExpiryRing } from "@/features/sidebar/ExpiryRing";
import { Icon } from "@/components/icons/Icon";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type Props = {
  note: NoteMeta;
  selected: boolean;
  expiryMinutes: number;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onTrash: (id: string) => void;
};

export function NoteItem({ note, selected, expiryMinutes, onSelect, onTogglePin, onTrash }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-selected={selected || undefined}
          className="note-item-btn flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors"
          style={{ color: "var(--foreground)" }}
          onClick={() => onSelect(note.id)}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{note.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {formatRelativeTime(note.lastInteraction)}
            </div>
          </div>

          {!note.isTrashed && !note.isPinned ? (
            <ExpiryRing lastInteraction={note.lastInteraction} expiryMinutes={expiryMinutes} />
          ) : null}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onTogglePin(note.id)}>
          <Icon name="pin" size={14} className="text-muted-foreground" />
          {note.isPinned ? "Unpin" : "Pin"}
          <ContextMenuShortcut>⌘P</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onTrash(note.id)}>
          <Icon name="trash" size={14} className="text-muted-foreground" />
          Trash
          <ContextMenuShortcut>Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
