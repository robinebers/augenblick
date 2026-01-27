export type NoteStorage = "draft" | "saved";

export type NoteMeta = {
  id: string;
  title: string;
  preview: string;
  filePath: string;
  storage: NoteStorage;
  isPinned: boolean;
  isTrashed: boolean;
  sortOrder: number;
  createdAt: number;
  lastInteraction: number;
  trashedAt: number | null;
};

export type NotesList = {
  active: NoteMeta[];
  trashed: NoteMeta[];
};

export type NoteWithContent = {
  meta: NoteMeta;
  content: string;
};

export type AppSettings = {
  expiryDays: number;
  trashRetentionDays: number;
  theme: "dark" | "light" | "system";
};
