import { AppMode } from './actions';
import { TriageTab, TabId, WindowId } from './tab';

import { BookmarkFolder } from './bookmark';
import { ChromeTabGroup } from './tabGroup';
import { PickerType } from './storage';
import { TriageReducerAction } from './actions';

export interface TriageState {
  mode: AppMode;
  tabs: TriageTab[];
  currentIndex: number;
  isReordering: boolean;
  undoStack: UndoStackEntry[]; // React-side undo stack (tab state snapshots)
  selfTabId: TabId | null;
  windows: Map<WindowId, string>;
  picker: PickerState;
  bookmarkFolders: BookmarkFolder[];
  bookmarkTree: BookmarkFolder[];
  tabGroups: ChromeTabGroup[];
}

export interface PickerState {
  type: PickerType | null;
  items: unknown[];
  filtered: unknown[];
  query: string;
  selectedIndex: number;
}

export interface TriageContextValue {
  state: TriageState;
  dispatch: React.Dispatch<TriageReducerAction>;
}

export interface PickerContextValue {
  activePicker: PickerType | null;
  setActivePicker: (type: PickerType | null) => void;
  registerPicker: (type: PickerType, handlers: PickerHandlers) => () => void;
  navigatePicker: (direction: 'up' | 'down') => void;
  confirmPicker: () => void;
  deactivatePicker: () => void;
  batchTarget: { tabs: TriageTab[] } | null;
  setBatchTarget: (target: { tabs: TriageTab[] } | null) => void;
}

export interface PickerHandlers {
  onNavigate?: (direction: 'up' | 'down') => void;
  onConfirm?: () => void;
  onDeactivate?: () => void;
}

/** Represents a single item pushed to the in-memory React undo stack.
 * Contrast with the `UndoEntry` which represents Chrome-side effects. */
export type UndoStackEntry =
  | {
      batch: true;
      action: string;
      previousStates: { tabId: TabId; state: TriageTab; originalIndex: number }[];
    }
  | { tabId: TabId; action: string; previousState: TriageTab }
  | { type: 'BOOKMARKS_MANAGER_ACTION'; batchSize: number };
