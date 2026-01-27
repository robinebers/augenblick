import { useEffect, useMemo, useState } from "react";
import type { NoteMeta } from "@/lib/types";
import { formatRelativeTimeFromNow } from "@/lib/utils/time";
import { Icon } from "@/components/icons/Icon";

type Props = {
  note: NoteMeta;
  selected: boolean;
  trashRetentionDays: number;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
};

export function TrashItem({
  note,
  selected,
  trashRetentionDays,
  onSelect,
  onRestore,
  onDeleteForever,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const deleteAt = useMemo(
    () =>
      note.trashedAt ? note.trashedAt + Math.max(1, trashRetentionDays) * 86_400_000 : null,
    [note.trashedAt, trashRetentionDays],
  );
  const timeLeft = deleteAt ? formatRelativeTimeFromNow(deleteAt, now) : "—";

  return (
    <div
      className={`group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[13px] text-[var(--text-primary)] ${
        selected ? "bg-[var(--bg-tertiary)]" : "hover:bg-[var(--bg-tertiary)]"
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(note.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(note.id);
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{note.title}</div>
        <div className="truncate text-[11px] text-[var(--text-secondary)]">
          Deletes {timeLeft}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Restore"
          onClick={(e) => {
            e.stopPropagation();
            onRestore(note.id);
          }}
        >
          <Icon name="restore" size={14} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--ring-red)]"
          aria-label="Delete forever"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteForever(note.id);
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}
