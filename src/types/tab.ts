export type TabId = number & { readonly __brand: 'TabId' };
export type WindowId = number & { readonly __brand: 'WindowId' };
export type GroupId = number & { readonly __brand: 'GroupId' };

/** The four possible triage decisions a user can make on a tab. */
export type TriageAction = 'keep' | 'close' | 'bookmark' | 'group';

/** The canonical tab representation used throughout the React app. */
export interface TriageTab {
  id: TabId;
  windowId: WindowId;
  groupId: GroupId; // -1 if ungrouped
  index: number; // original position within its window
  title: string; // '(Untitled)' if blank
  url: string;
  favIconUrl: string;
  pinned: boolean;
  lastAccessed: number | null; // ms timestamp, null if unavailable
  openerTabId: TabId | null;

  // Triage state (app-managed, not from Chrome)
  processed: boolean;
  gone: boolean;
  action: TriageAction | null;

  // Suspended tab fields
  isSuspended: boolean;
  suspendedUrl: string | null;

  // Duplicate tracking (optional — only populated by triageLoader)
  duplicates?: TriageTab[];

  // Resurrection tracking (only set after undo re-creates a tab)
  originalId?: TabId;
}
