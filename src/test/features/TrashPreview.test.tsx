import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@/test/utils/render";

vi.mock("@/features/editor/Editor", () => ({
  Editor: ({ value, readOnly }: { value: string; readOnly?: boolean }) => (
    <div data-value={value} data-readonly={String(Boolean(readOnly))} />
  ),
}));

describe("TrashPreview", () => {
  it("renders editor in read-only mode", async () => {
    const { container, unmount } = await render(
      React.createElement((await import("@/features/editor/TrashPreview")).TrashPreview, {
        content: "trashed",
      }),
    );

    const node = container.querySelector("[data-value]") as HTMLElement;
    expect(node.getAttribute("data-value")).toBe("trashed");
    expect(node.getAttribute("data-readonly")).toBe("true");

    await unmount();
  });
});
