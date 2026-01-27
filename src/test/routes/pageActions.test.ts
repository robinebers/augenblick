import { describe, expect, it, vi } from "vitest";

import { createPageActions } from "@/routes/pageActions";

describe("pageActions", () => {
  it("openMarkdown imports picked file", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn() },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => "/tmp/a.md"),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.openMarkdown();
    expect(notesStore.importFile).toHaveBeenCalledWith("/tmp/a.md");
  });

  it("openMarkdown no-ops when cancelled", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn() },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.openMarkdown();
    expect(notesStore.importFile).not.toHaveBeenCalled();
  });

  it("openMarkdown ignores multi-select and guards in-flight", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    let resolveOpen: ((value: string | string[] | null) => void) | null = null;
    const openFile = vi.fn(
      () =>
        new Promise<string | string[] | null>((resolve) => {
          resolveOpen = resolve;
        }),
    );

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn() },
      toast: { success: vi.fn() },
      openFile,
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    const first = actions.openMarkdown();
    const second = actions.openMarkdown();
    expect(openFile).toHaveBeenCalledTimes(1);
    resolveOpen?.(["/tmp/a.md"]);
    await Promise.all([first, second]);
    expect(notesStore.importFile).not.toHaveBeenCalled();
  });

  it("saveCurrent routes drafts through Save As", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn(async () => true) },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => "/tmp/n.md"),
      getSelectedId: () => "n1",
      getSelectedMeta: () =>
        ({
          id: "n1",
          title: "Note",
          preview: "",
          filePath: "/tmp/n1.md",
          storage: "draft",
          isPinned: false,
          isTrashed: false,
          sortOrder: 1,
          createdAt: 1,
          lastInteraction: 1,
          trashedAt: null,
        }) as never,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.saveCurrent();
    expect(notesStore.save).not.toHaveBeenCalled();
    expect(notesStore.saveAs).toHaveBeenCalledWith("n1", "/tmp/n.md");
  });

  it("saveCurrent saves non-draft notes", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn(async () => true) },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => "s1",
      getSelectedMeta: () =>
        ({
          id: "s1",
          title: "Saved",
          preview: "",
          filePath: "/tmp/s1.md",
          storage: "saved",
          isPinned: false,
          isTrashed: false,
          sortOrder: 1,
          createdAt: 1,
          lastInteraction: 1,
          trashedAt: null,
        }) as never,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.saveCurrent();
    expect(notesStore.save).toHaveBeenCalledWith("s1");
  });

  it("saveAs no-ops without id and appends extension", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const saveFile = vi.fn(async () => "/tmp/note");

    const baseDeps = {
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn(async () => true) },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile,
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    };

    const actions = createPageActions(baseDeps);

    await actions.saveAs();
    expect(notesStore.saveAs).not.toHaveBeenCalled();

    const withId = createPageActions({
      ...baseDeps,
      getSelectedId: () => "n1",
      getSelectedMeta: () =>
        ({
          id: "n1",
          title: "",
          preview: "",
          filePath: "/tmp/n1.md",
          storage: "draft",
          isPinned: false,
          isTrashed: false,
          sortOrder: 1,
          createdAt: 1,
          lastInteraction: 1,
          trashedAt: null,
        }) as never,
    });

    await withId.saveAs();
    expect(notesStore.saveAs).toHaveBeenCalledWith("n1", "/tmp/note.md");
  });

  it("closeCurrent can discard dirty saved note", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const openDialog = vi.fn(async () => "discard");
    const toastSuccess = vi.fn();

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog, confirmDialog: vi.fn(async () => true) },
      toast: { success: toastSuccess },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => "s1",
      getSelectedMeta: () =>
        ({
          id: "s1",
          title: "Saved",
          preview: "",
          filePath: "/tmp/s1.md",
          storage: "saved",
          isPinned: false,
          isTrashed: false,
          sortOrder: 1,
          createdAt: 1,
          lastInteraction: 1,
          trashedAt: null,
        }) as never,
      isDirtySaved: () => true,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.closeCurrent();
    expect(openDialog).toHaveBeenCalled();
    expect(notesStore.trash).toHaveBeenCalledWith("s1");
    expect(toastSuccess).toHaveBeenCalledWith("Moved to Trash");
  });

  it("closeCurrent handles cancel + save flows", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const openDialog = vi.fn(async () => "cancel");
    const actions = createPageActions({
      notesStore,
      dialog: { openDialog, confirmDialog: vi.fn(async () => true) },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => "s1",
      getSelectedMeta: () =>
        ({
          id: "s1",
          title: "Saved",
          preview: "",
          filePath: "/tmp/s1.md",
          storage: "saved",
          isPinned: false,
          isTrashed: false,
          sortOrder: 1,
          createdAt: 1,
          lastInteraction: 1,
          trashedAt: null,
        }) as never,
      isDirtySaved: () => true,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.closeCurrent();
    expect(notesStore.trash).not.toHaveBeenCalled();

    openDialog.mockResolvedValueOnce("save");
    await actions.closeCurrent();
    expect(notesStore.save).toHaveBeenCalledWith("s1");
    expect(notesStore.trash).toHaveBeenCalledWith("s1");
  });

  it("closeCurrent skips dialog for non-dirty notes", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn(async () => true) },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => "d1",
      getSelectedMeta: () =>
        ({
          id: "d1",
          title: "Draft",
          preview: "",
          filePath: "/tmp/d1.md",
          storage: "draft",
          isPinned: false,
          isTrashed: false,
          sortOrder: 1,
          createdAt: 1,
          lastInteraction: 1,
          trashedAt: null,
        }) as never,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.closeCurrent();
    expect(notesStore.trash).toHaveBeenCalledWith("d1");
  });

  it("deleteForeverFromTrash confirms before deleting", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const confirmDialog = vi.fn(async () => true);
    const toastSuccess = vi.fn();

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog },
      toast: { success: toastSuccess },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.deleteForeverFromTrash("t1");
    expect(confirmDialog).toHaveBeenCalled();
    expect(notesStore.deleteForever).toHaveBeenCalledWith("t1");
    expect(toastSuccess).toHaveBeenCalledWith("Deleted");
  });

  it("deleteForeverFromTrash no-ops when cancelled", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const confirmDialog = vi.fn(async () => false);
    const toastSuccess = vi.fn();

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog },
      toast: { success: toastSuccess },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.deleteForeverFromTrash("t1");
    expect(notesStore.deleteForever).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("clearTrash no-ops when empty", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn() },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    await actions.clearTrash();
    expect(notesStore.clearTrash).not.toHaveBeenCalled();
  });

  it("clearTrash respects confirmation", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const confirmDialog = vi.fn(async () => false);
    const toastSuccess = vi.fn();

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog },
      toast: { success: toastSuccess },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 2,
    });

    await actions.clearTrash();
    expect(notesStore.clearTrash).not.toHaveBeenCalled();

    confirmDialog.mockResolvedValueOnce(true);
    await actions.clearTrash();
    expect(notesStore.clearTrash).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Trash cleared");
  });

  it("clearTrash uses singular text", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const confirmDialog = vi.fn(async () => false);
    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 1,
    });

    await actions.clearTrash();
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Permanently delete 1 note?" }),
    );
  });

  it("onEditorChange updates when selection exists", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn() },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => "n1",
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth: vi.fn(),
      getTrashedCount: () => 0,
    });

    actions.onEditorChange("hello");
    expect(notesStore.updateContent).toHaveBeenCalledWith("n1", "hello");
  });

  it("startResize clamps sidebar width", async () => {
    const notesStore = {
      importFile: vi.fn(async () => {}),
      save: vi.fn(async () => {}),
      saveAs: vi.fn(async () => {}),
      trash: vi.fn(async () => {}),
      updateContent: vi.fn(),
      deleteForever: vi.fn(async () => {}),
      clearTrash: vi.fn(async () => {}),
    };

    const setSidebarWidth = vi.fn();

    const actions = createPageActions({
      notesStore,
      dialog: { openDialog: vi.fn(), confirmDialog: vi.fn() },
      toast: { success: vi.fn() },
      openFile: vi.fn(async () => null),
      saveFile: vi.fn(async () => null),
      getSelectedId: () => null,
      getSelectedMeta: () => null,
      isDirtySaved: () => false,
      getSidebarWidth: () => 260,
      setSidebarWidth,
      getTrashedCount: () => 0,
    });

    actions.startResize({ preventDefault: vi.fn(), clientX: 100 } as unknown as MouseEvent);

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 0 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 1000 }));
    window.dispatchEvent(new MouseEvent("mouseup"));

    expect(setSidebarWidth).toHaveBeenCalledWith(200);
    expect(setSidebarWidth).toHaveBeenCalledWith(400);
  });
});
