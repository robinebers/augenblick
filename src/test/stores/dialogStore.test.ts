import { describe, expect, it } from "vitest";
import { cancelDialog, confirmDialog, openDialog, resolveDialog, useDialogStore } from "@/stores/dialogStore";

describe("dialogStore", () => {
  it("opens and resolves dialog", async () => {
    const promise = openDialog({
      title: "Confirm",
      actions: [{ id: "ok", label: "OK" }],
    });

    expect(useDialogStore.getState().request?.title).toBe("Confirm");

    resolveDialog("ok");
    await expect(promise).resolves.toBe("ok");
    expect(useDialogStore.getState().request).toBeNull();
  });

  it("cancels previous dialog when opening a new one", async () => {
    const first = openDialog({
      title: "First",
      cancelId: "nope",
      actions: [{ id: "ok", label: "OK" }],
    });

    const second = openDialog({
      title: "Second",
      actions: [{ id: "ok", label: "OK" }],
    });

    await expect(first).resolves.toBe("nope");
    resolveDialog("ok");
    await expect(second).resolves.toBe("ok");
  });

  it("cancelDialog uses cancelId fallback", async () => {
    const promise = openDialog({
      title: "Cancel",
      actions: [{ id: "confirm", label: "Confirm" }],
    });

    cancelDialog();
    await expect(promise).resolves.toBe("cancel");
  });

  it("confirmDialog resolves to boolean", async () => {
    const confirmPromise = confirmDialog({ title: "Sure?" });
    resolveDialog("confirm");
    await expect(confirmPromise).resolves.toBe(true);

    const cancelPromise = confirmDialog({ title: "Nope?" });
    resolveDialog("cancel");
    await expect(cancelPromise).resolves.toBe(false);
  });

  it("confirmDialog uses destructive variant when specified", async () => {
    const promise = confirmDialog({ title: "Delete?", destructive: true });
    const req = useDialogStore.getState().request;
    expect(req?.actions[0]?.variant).toBe("destructive");
    resolveDialog("confirm");
    await promise;
  });
});
