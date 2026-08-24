import { TabId, WindowId, GroupId } from './tab';

export type UndoEntry =
  | KeepUndoEntry
  | CloseUndoEntry
  | BookmarkUndoEntry
  | BookmarkBatchUndoEntry
  | GroupUndoEntry
  | BookmarkManagerUndoEntry;

export interface KeepUndoEntry {
  type: 'keep' | 'keepBatch';
}

export interface CloseUndoEntry {
  type: 'close';
  tabs: TabSnapshot[];
}

export interface BookmarkUndoEntry {
  type: 'bookmark';
  bookmarkId: string | null; // filled async after chrome.bookmarks.create
  tabs: TabSnapshot[];
}

export interface BookmarkBatchUndoEntry {
  type: 'bookmarkBatch';
  bookmarks: { id: string }[]; // filled async
  tabs: TabSnapshot[];
}

export interface GroupUndoEntry {
  type: 'group';
  tabIds: TabId[];
  previousGroupIds: GroupId[];
  pinnedStatus: boolean[];
}

export interface BookmarkManagerUndoEntry {
  type: 'bookmarks_manager_custom';
  undoFn: () => Promise<void>;
}

/** Minimal snapshot of a tab needed for undo restoration. */
export interface TabSnapshot {
  id: TabId;
  url: string;
  windowId: WindowId;
  pinned: boolean;
}
