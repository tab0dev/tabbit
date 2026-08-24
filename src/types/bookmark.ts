/** Lightweight folder node for the picker panel (triageLoader output). */
export interface BookmarkFolder {
  id: string; // Chrome bookmark node ID
  title: string;
  path: string; // e.g. "Bookmarks bar / Dev / Tools"
  children: BookmarkFolder[];
}

/** Full bookmark tree node (used by BookmarkManager). */
export interface BookmarkNode {
  id: string;
  parentId: string | null;
  index: number | null;
  title: string;
  url: string | null; // null for folders
  isFolder: boolean;
  dateAdded: number | null;
  dateLastUsed: number | null; // Chrome 114+
  folderType: string | null; // "bookmarks-bar" | "other" | "mobile"
  path: string;
  children: BookmarkNode[];
}

/** Cold storage archive format (serialized to JSON file). */
export interface BookmarkArchive {
  version: number;
  filename: string;
  lastModified: string; // ISO 8601
  bookmarks: ArchivedBookmark[];
}

export interface ArchivedBookmark {
  id: string;
  parentId: string | null;
  index: number | null;
  title: string;
  url: string;
  dateAdded: number | null;
  dateLastUsed: number | null;
  path: string;
  folderPath: string;
  archivedAt: string; // ISO 8601
}

/** Resolved selection output from bookmarkService.resolveSelection(). */
export interface ResolvedSelection {
  toAction: BookmarkNode[];
  toOrphan: (BookmarkNode & { rescueTo: { parentId: string; index: number } })[];
  foldersToRemove: BookmarkNode[];
}
