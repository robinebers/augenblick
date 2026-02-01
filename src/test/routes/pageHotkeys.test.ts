import { describe, expect, it, vi } from "vitest";

import { createPageKeydownHandler } from "@/routes/pageHotkeys";

describe("pageHotkeys", () => {
  it("toggles command palette on Cmd+K", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = new KeyboardEvent("keydown", { key: "k", metaKey: true }) as unknown as KeyboardEvent;
    handler(e);
    expect(deps.toggleCommandPalette).toHaveBeenCalled();
  });

  it("closes command palette on Escape (no modifier)", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = new KeyboardEvent("keydown", { key: "Escape" }) as unknown as KeyboardEvent;
    handler(e);
    expect(deps.closeCommandPalette).toHaveBeenCalled();
  });

  it("escapes from trash view on Escape (no modifier)", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "trash" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = new KeyboardEvent("keydown", { key: "Escape" }) as unknown as KeyboardEvent;
    handler(e);
    expect(deps.setViewMode).toHaveBeenCalledWith("notes");
  });

  it("does not hijack Cmd+Z when typing", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const input = document.createElement("input");
    const e = {
      key: "z",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      target: input,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;

    handler(e);
    expect(deps.undoReorder).not.toHaveBeenCalled();
  });

  it("undoes/redo reorder on Cmd+Z / Cmd+Shift+Z when not typing", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);

    const e1 = {
      key: "z",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      target: document.body,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;
    handler(e1);
    expect(deps.undoReorder).toHaveBeenCalled();

    const e2 = {
      key: "z",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      target: document.body,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;
    handler(e2);
    expect(deps.redoReorder).toHaveBeenCalled();
  });

  it("moves selection with Cmd+Shift+ArrowDown", () => {
    let selectedId: string | null = "p1";
    const deps = {
      getNotesSnapshot: () => ({
        list: { active: [{ id: "p1", isPinned: true }, { id: "a", isPinned: false }], trashed: [] },
        selectedId,
        viewMode: "notes" as const,
      }),
      getSelectedId: () => selectedId,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn((id: string) => {
        selectedId = id;
      }),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = {
      key: "ArrowDown",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      target: document.body,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;
    handler(e);
    expect(deps.selectNote).toHaveBeenCalledWith("a");
  });

  it("routes Cmd+S / Cmd+Shift+S and Cmd+O", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      quit: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };
    const handler = createPageKeydownHandler(deps);

    handler(
      {
        key: "s",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: document.body,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
    );
    expect(deps.saveCurrent).toHaveBeenCalled();

    handler(
      {
        key: "s",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        target: document.body,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
    );
    expect(deps.saveAs).toHaveBeenCalled();

    handler(
      {
        key: "o",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: document.body,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
    );
    expect(deps.openMarkdown).toHaveBeenCalled();
  });

  it("quits on Cmd+Q", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      quit: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };
    const handler = createPageKeydownHandler(deps);

    const e = {
      key: "q",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: document.body,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    handler(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(deps.quit).toHaveBeenCalled();
  });

  it("trashes note on Delete when not typing", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = {
      key: "Delete",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      target: document.body,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;

    handler(e);
    expect(deps.closeCurrent).toHaveBeenCalled();
  });

  it("creates note on Cmd+N", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = {
      key: "n",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      target: document.body,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;

    handler(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(deps.createNote).toHaveBeenCalled();
  });

  it("toggles pin on Cmd+P", () => {
    const deps = {
      getNotesSnapshot: () => ({ list: { active: [], trashed: [] }, selectedId: null, viewMode: "notes" as const }),
      getSelectedId: () => null,
      toggleCommandPalette: vi.fn(),
      closeCommandPalette: vi.fn(),
      openSettings: vi.fn(),
      setViewMode: vi.fn(),
      createNote: vi.fn(),
      togglePinCurrent: vi.fn(),
      closeCurrent: vi.fn(),
      openMarkdown: vi.fn(),
      saveCurrent: vi.fn(),
      saveAs: vi.fn(),
      selectNote: vi.fn(),
      undoReorder: vi.fn(),
      redoReorder: vi.fn(),
    };

    const handler = createPageKeydownHandler(deps);
    const e = {
      key: "p",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      target: document.body,
      preventDefault: vi.fn(),
      altKey: false,
    } as unknown as KeyboardEvent;

    handler(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(deps.togglePinCurrent).toHaveBeenCalled();
  });
});
