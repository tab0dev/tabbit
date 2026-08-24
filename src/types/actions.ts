import { TabId, WindowId, TriageAction, TriageTab } from './tab';
import { BookmarkFolder } from './bookmark';
import { ChromeTabGroup } from './tabGroup';
import { PickerType, TabProcessingMode } from './storage';

export type TriageReducerAction =
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'SET_INITIAL_DATA'; payload: InitialDataPayload }
  | { type: 'PROCESS_TAB'; payload: { tabId: TabId; triageAction: TriageAction } }
  | { type: 'PROCESS_BATCH'; payload: { tabIds: TabId[]; triageAction: TriageAction } }
  | { type: 'PROCESS_BOOKMARKS_MANAGER_ACTION'; payload: { batchSize: number } }
  | { type: 'UNDO' }
  | { type: 'GO_BACK' }
  | { type: 'UPDATE_TAB_ID'; payload: { oldId: TabId; newId: TabId } }
  | { type: 'TAB_GONE'; payload: TabId }
  | { type: 'TAB_CREATED'; payload: chrome.tabs.Tab }
  | { type: 'TAB_UPDATED'; payload: Partial<chrome.tabs.Tab> & { id: TabId } }
  | { type: 'OPEN_PICKER'; payload: PickerType }
  | { type: 'ADD_BOOKMARK_FOLDER'; payload: { id: string; title: string; parentId: string } }
  | { type: 'ADD_TAB_GROUP'; payload: ChromeTabGroup }
  | { type: 'START_REORDER' }
  | { type: 'REORDER_TABS'; payload: TabProcessingMode };

/** The global application mode. */
export type AppMode = 'LOADING' | 'PERMISSION' | 'TRIAGING' | 'PICKER' | 'COMPLETE';

export interface InitialDataPayload {
  tabs: TriageTab[];
  selfTabId: TabId | null;
  windows: Map<WindowId, string>;
  bookmarkFolders: BookmarkFolder[];
  bookmarkTree: BookmarkFolder[];
  tabGroups: ChromeTabGroup[];
}
