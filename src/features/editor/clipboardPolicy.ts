const MARKDOWN_MIME_TYPES = ["text/markdown", "text/x-markdown"] as const;

type ClipboardDataLike = {
  getData: (type: string) => string;
};

export function getMarkdownFromClipboard(clipboardData: ClipboardDataLike | null | undefined) {
  if (!clipboardData) return null;

  for (const type of MARKDOWN_MIME_TYPES) {
    const value = clipboardData.getData(type);
    if (typeof value !== "string") continue;
    if (value.trim().length === 0) continue;
    return value;
  }

  return null;
}

export function shouldHandleMarkdownPaste(clipboardData: ClipboardDataLike | null | undefined) {
  return getMarkdownFromClipboard(clipboardData) !== null;
}

