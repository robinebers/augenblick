import { create } from "zustand";

export type DialogActionVariant = "default" | "secondary" | "destructive";

export type DialogAction = {
  id: string;
  label: string;
  variant?: DialogActionVariant;
};

export type DialogRequest = {
  title: string;
  description?: string;
  actions: DialogAction[];
  cancelId?: string;
};

type DialogState = {
  request: DialogRequest | null;
  setRequest: (req: DialogRequest | null) => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));

let resolveCurrent: ((id: string) => void) | null = null;

export function openDialog(req: DialogRequest): Promise<string> {
  const prev = useDialogStore.getState().request;
  if (prev && resolveCurrent) resolveCurrent(prev.cancelId ?? "cancel");

  useDialogStore.getState().setRequest(req);
  return new Promise((resolve) => {
    resolveCurrent = resolve;
  });
}

export function resolveDialog(id: string) {
  const resolver = resolveCurrent;
  resolveCurrent = null;
  useDialogStore.getState().setRequest(null);
  resolver?.(id);
}

export function cancelDialog() {
  const req = useDialogStore.getState().request;
  resolveDialog(req?.cancelId ?? "cancel");
}

export async function confirmDialog(opts: {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const result = await openDialog({
    title: opts.title,
    description: opts.description,
    cancelId: "cancel",
    actions: [
      {
        id: "confirm",
        label: opts.confirmText ?? "Confirm",
        variant: opts.destructive ? "destructive" : "default",
      },
      { id: "cancel", label: opts.cancelText ?? "Cancel", variant: "secondary" },
    ],
  });
  return result === "confirm";
}
