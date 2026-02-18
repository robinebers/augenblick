import { describe, expect, it } from "vitest";
import { getMarkdownFromClipboard, shouldHandleMarkdownPaste } from "@/features/editor/clipboardPolicy";

describe("clipboardPolicy", () => {
  it("returns markdown from text/markdown", () => {
    const clipboardData = {
      getData: (type: string) => (type === "text/markdown" ? "# Title\n\n- item" : ""),
    };

    expect(getMarkdownFromClipboard(clipboardData)).toBe("# Title\n\n- item");
    expect(shouldHandleMarkdownPaste(clipboardData)).toBe(true);
  });

  it("returns markdown from text/x-markdown fallback", () => {
    const clipboardData = {
      getData: (type: string) => (type === "text/x-markdown" ? "## Heading" : ""),
    };

    expect(getMarkdownFromClipboard(clipboardData)).toBe("## Heading");
    expect(shouldHandleMarkdownPaste(clipboardData)).toBe(true);
  });

  it("ignores whitespace-only markdown payloads", () => {
    const clipboardData = {
      getData: () => "   ",
    };

    expect(getMarkdownFromClipboard(clipboardData)).toBeNull();
    expect(shouldHandleMarkdownPaste(clipboardData)).toBe(false);
  });

  it("handles missing clipboard payload", () => {
    expect(getMarkdownFromClipboard(null)).toBeNull();
    expect(shouldHandleMarkdownPaste(null)).toBe(false);
  });
});

