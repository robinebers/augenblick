import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "@/test/utils/render";
import type { AppSettings } from "@/lib/types";

const selectHandlers: Array<(value: string) => void> = [];
const tabsHandlers: Array<(value: string) => void> = [];

vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: any) => {
    if (onValueChange) selectHandlers.push(onValueChange);
    return <div>{children}</div>;
  },
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, onOpenChange }: any) => (
    <div>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        close-dialog
      </button>
      {children}
    </div>
  ),
  DialogContent: ({ children, onInteractOutside }: any) => (
    <div>
      <button type="button" onClick={() => onInteractOutside?.()}>
        outside
      </button>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ onValueChange, children }: any) => {
    if (onValueChange) tabsHandlers.push(onValueChange);
    return <div>{children}</div>;
  },
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ value, children }: any) => <button data-value={value}>{children}</button>,
}));

describe("SettingsDialog", () => {
  afterEach(() => {
    selectHandlers.length = 0;
    tabsHandlers.length = 0;
  });

  it("wires theme + expiry + trash handlers", async () => {
    const onClose = vi.fn();
    const onTheme = vi.fn();
    const onExpiryMinutes = vi.fn();
    const onTrashDays = vi.fn();
    const onCheckUpdates = vi.fn();

    const settings: AppSettings = {
      expiryMinutes: 10_080,
      trashRetentionDays: 30,
      theme: "dark",
    };

    const { container, unmount } = await render(
      React.createElement((await import("@/features/settings/SettingsDialog")).SettingsDialog, {
        settings,
        onClose,
        onTheme,
        onExpiryMinutes,
        onTrashDays,
        isCheckingUpdates: false,
        onCheckUpdates,
      }),
    );

    expect(selectHandlers.length).toBe(2);
    selectHandlers[0]?.("360");
    expect(onExpiryMinutes).toHaveBeenCalledWith(360);

    selectHandlers[1]?.("60");
    expect(onTrashDays).toHaveBeenCalledWith(60);

    tabsHandlers[0]?.("light");
    expect(onTheme).toHaveBeenCalledWith("light");

    const checkUpdatesButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Check for updates"),
    );
    checkUpdatesButton?.click();
    expect(onCheckUpdates).toHaveBeenCalled();

    const closeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("close-dialog"),
    );
    closeButton?.click();
    expect(onClose).toHaveBeenCalled();

    await unmount();
  });
});
