import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteMeta } from "@/lib/types";
import { NoteItem } from "@/features/sidebar/NoteItem";
import { TrashItem } from "@/features/sidebar/TrashItem";
import { Icon } from "@/components/icons/Icon";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  pinned: NoteMeta[];
  notes: NoteMeta[];
  trashed: NoteMeta[];
  selectedId: string | null;
  dirtyIds: Record<string, true>;
  expiryMinutes: number;
  trashRetentionDays: number;
  viewMode: "notes" | "trash";
  onSelect: (id: string) => void;
  onReorder: (section: "pinned" | "notes", ids: string[]) => void;
  onToggleTrash: () => void;
  onClearTrash: () => void;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onTogglePin: (id: string) => void;
  onTrash: (id: string) => void;
  onNewNote: () => void;
};

type SortableRowProps = {
  note: NoteMeta;
  selected: boolean;
  dirty: boolean;
  expiryMinutes: number;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onTrash: (id: string) => void;
};

function SortableRow({ note, selected, dirty, expiryMinutes, onSelect, onTogglePin, onTrash }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <NoteItem
        note={note}
        selected={selected}
        dirty={dirty}
        expiryMinutes={expiryMinutes}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
        onTrash={onTrash}
      />
    </div>
  );
}

function useDndList(items: NoteMeta[]) {
  const [list, setList] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const startOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!activeId) setList(items);
  }, [items, activeId]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    startOrderRef.current = items.map((n) => n.id);
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.id ? String(event.over.id) : null;
    setOverId(over);
    if (!over) return;
    const active = String(event.active.id);
    if (active === over) return;
    setList((current) => {
      const oldIndex = current.findIndex((i) => i.id === active);
      const newIndex = current.findIndex((i) => i.id === over);
      if (oldIndex === -1 || newIndex === -1) return current;
      if (oldIndex === newIndex) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over) return { reordered: null };
    const currentOrder = list.map((n) => n.id);
    const startOrder = startOrderRef.current;
    if (startOrder.length === 0) return { reordered: currentOrder };
    const changed =
      startOrder.length !== currentOrder.length ||
      startOrder.some((id, idx) => id !== currentOrder[idx]);
    return { reordered: changed ? currentOrder : null };
  }

  return {
    list,
    activeId,
    overId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}

export function Sidebar({
  pinned,
  notes,
  trashed,
  selectedId,
  dirtyIds,
  expiryMinutes,
  trashRetentionDays,
  viewMode,
  onSelect,
  onReorder,
  onToggleTrash,
  onClearTrash,
  onRestore,
  onDeleteForever,
  onTogglePin,
  onTrash,
  onNewNote,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const pinnedDnd = useDndList(pinned);
  const notesDnd = useDndList(notes);

  const pinnedIds = useMemo(() => pinnedDnd.list.map((n) => n.id), [pinnedDnd.list]);
  const noteIds = useMemo(() => notesDnd.list.map((n) => n.id), [notesDnd.list]);

  return (
    <div
      className="flex h-full flex-col select-none"
      style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border-default)" }}
    >
      <div className="flex-1 overflow-auto px-1.5 pb-2" style={{ paddingTop: "var(--titlebar-inset, 0px)" }}>
        {viewMode === "notes" ? (
          <>
            {pinned.length > 0 ? (
              <>
                <div className="px-3 pb-1 text-[11px] font-semibold text-[var(--text-tertiary)]">
                  PINNED
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={pinnedDnd.handleDragStart}
                  onDragOver={pinnedDnd.handleDragOver}
                  onDragEnd={(event) => {
                    const result = pinnedDnd.handleDragEnd(event);
                    if (result.reordered) onReorder("pinned", result.reordered);
                  }}
                >
                  <SortableContext items={pinnedIds} strategy={verticalListSortingStrategy}>
                    <div className="sidebar-notes-list flex flex-col gap-0.5">
                      {pinnedDnd.list.map((note) => (
                        <div key={note.id}>
                          {pinnedDnd.activeId && pinnedDnd.overId === note.id ? (
                            <div className="px-2 py-1">
                              <div
                                className="h-[2px] w-full rounded-full"
                                style={{ background: "var(--accent-blue)" }}
                              />
                            </div>
                          ) : null}
                          <SortableRow
                            note={note}
                            selected={note.id === selectedId}
                            dirty={!!dirtyIds[note.id]}
                            expiryMinutes={expiryMinutes}
                            onSelect={onSelect}
                            onTogglePin={onTogglePin}
                            onTrash={onTrash}
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            ) : null}

            <div
              className={`px-3 pb-1 text-[11px] font-semibold text-[var(--text-tertiary)] ${
                pinned.length > 0 ? "mt-4" : ""
              }`}
            >
              NOTES
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={notesDnd.handleDragStart}
              onDragOver={notesDnd.handleDragOver}
              onDragEnd={(event) => {
                const result = notesDnd.handleDragEnd(event);
                if (result.reordered) onReorder("notes", result.reordered);
              }}
            >
              <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
                <div className="sidebar-notes-list flex flex-col gap-0.5">
                  {notesDnd.list.map((note) => (
                    <div key={note.id}>
                      {notesDnd.activeId && notesDnd.overId === note.id ? (
                        <div className="px-2 py-1">
                          <div
                            className="h-[2px] w-full rounded-full"
                            style={{ background: "var(--accent-blue)" }}
                          />
                        </div>
                      ) : null}
                      <SortableRow
                        note={note}
                        selected={note.id === selectedId}
                        dirty={!!dirtyIds[note.id]}
                        expiryMinutes={expiryMinutes}
                        onSelect={onSelect}
                        onTogglePin={onTogglePin}
                        onTrash={onTrash}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <>
            <div className="px-3 pb-1 text-[11px] font-semibold text-[var(--text-tertiary)]">
              TRASH
            </div>
            <div className="flex flex-col gap-0.5">
              {trashed.map((note) => (
                <TrashItem
                  key={note.id}
                  note={note}
                  selected={note.id === selectedId}
                  trashRetentionDays={trashRetentionDays}
                  onSelect={onSelect}
                  onRestore={onRestore}
                  onDeleteForever={onDeleteForever}
                />
              ))}
              {trashed.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
                  Trash is empty
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="border-t px-2 py-2" style={{ borderColor: "var(--border-default)" }}>
        {viewMode === "notes" ? (
          <>
            <button
              type="button"
              className="group flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              onClick={onNewNote}
            >
              <Icon name="file-text" className="group-hover:text-[var(--text-primary)]" />
              New note
            </button>

            <button
              type="button"
              className="group flex h-9 w-full items-center justify-between rounded-md px-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              onClick={onToggleTrash}
            >
              <span className="flex items-center gap-2">
                <Icon name="trash" className="group-hover:text-[var(--text-primary)]" />
                Trash
              </span>
              {trashed.length > 0 ? (
                <span className="text-[11px] text-[var(--text-secondary)]">{trashed.length}</span>
              ) : null}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="group flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] text-[var(--ring-red)]/70 hover:text-[var(--ring-red)] disabled:opacity-50"
              onClick={onClearTrash}
              disabled={trashed.length === 0}
            >
              <Icon name="trash" className="text-[var(--ring-red)]/70 group-hover:text-[var(--ring-red)]" />
              Empty trash
            </button>

            <button
              type="button"
              className="group flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              onClick={onToggleTrash}
            >
              <Icon name="undo" className="group-hover:text-[var(--text-primary)]" />
              Back to notes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
