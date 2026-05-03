import { createContext, useReducer, useContext } from 'react';
import { applyTabProcessing } from '../services/tabProcessingService';
import { createTriageTab, normalizeUrl } from '../utils/tabUtils';

export const Mode = {
  LOADING: 'LOADING',
  PERMISSION: 'PERMISSION',
  TRIAGING: 'TRIAGING',
  PICKER: 'PICKER',
  COMPLETE: 'COMPLETE',
};

const initialState = {
  mode: Mode.LOADING,
  tabs: [],
  currentIndex: 0,
  isReordering: false,
  undoStack: [],
  selfTabId: null,
  windows: new Map(),
  picker: {
    type: null,
    items: [],
    filtered: [],
    query: '',
    selectedIndex: 0,
  },
  bookmarkFolders: [],
  bookmarkTree: [],
  tabGroups: [],
};

function triageReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        tabs: action.payload.tabs,
        selfTabId: action.payload.selfTabId,
        windows: action.payload.windows,
        bookmarkFolders: action.payload.bookmarkFolders,
        bookmarkTree: action.payload.bookmarkTree ?? [],
        tabGroups: action.payload.tabGroups,
        mode: action.payload.tabs.length === 0 ? Mode.COMPLETE : Mode.TRIAGING,
      };
    case 'PROCESS_TAB': {
      const { tabId, triageAction } = action.payload; // triageAction is keep, close, bookmark, group
      const newTabs = [...state.tabs];
      const tabIndex = newTabs.findIndex(t => t.id === tabId);
      if (tabIndex === -1) return state;

      // Update current tab
      newTabs[tabIndex] = { ...newTabs[tabIndex], processed: true, action: triageAction };

      // Push to undo stack
      const newUndoStack = [...state.undoStack, { tabId, action: triageAction, previousState: state.tabs[tabIndex] }];

      // Advance to next
      let nextIndex = state.currentIndex;
      let foundNext = false;

      // Search forward
      for (let i = state.currentIndex + 1; i < newTabs.length; i++) {
        if (!newTabs[i].processed && !newTabs[i].gone) {
          nextIndex = i;
          foundNext = true;
          break;
        }
      }

      // If not found forward, search from start
      if (!foundNext) {
        for (let i = 0; i <= state.currentIndex; i++) {
          if (!newTabs[i].processed && !newTabs[i].gone) {
            nextIndex = i;
            foundNext = true;
            break;
          }
        }
      }

      return {
        ...state,
        tabs: newTabs,
        undoStack: newUndoStack,
        currentIndex: nextIndex,
        mode: foundNext ? state.mode : Mode.COMPLETE
      };
    }
    case 'PROCESS_BATCH': {
      const { tabIds, triageAction } = action.payload; // array of tabIds
      const newTabs = [...state.tabs];
      const previousStates = [];

      tabIds.forEach(tabId => {
        const tabIndex = newTabs.findIndex(t => t.id === tabId);
        if (tabIndex !== -1) {
          previousStates.push({ tabId, state: newTabs[tabIndex], originalIndex: tabIndex });
          newTabs[tabIndex] = { ...newTabs[tabIndex], processed: true, action: triageAction };
        }
      });

      if (previousStates.length === 0) return state;

      const newUndoStack = [...state.undoStack, { batch: true, previousStates, action: triageAction }];

      let nextIndex = state.currentIndex;
      let foundNext = false;
      for (let i = state.currentIndex + 1; i < newTabs.length; i++) {
        if (!newTabs[i].processed && !newTabs[i].gone) {
          nextIndex = i; foundNext = true; break;
        }
      }
      if (!foundNext) {
        for (let i = 0; i <= state.currentIndex; i++) {
          if (!newTabs[i].processed && !newTabs[i].gone) {
            nextIndex = i; foundNext = true; break;
          }
        }
      }

      return {
        ...state,
        tabs: newTabs,
        undoStack: newUndoStack,
        currentIndex: nextIndex,
        mode: foundNext ? state.mode : Mode.COMPLETE
      };
    }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const stack = [...state.undoStack];
      const lastAction = stack.pop();

      const newTabs = [...state.tabs];
      let restoredIndex = -1;

      if (lastAction.batch) {
        lastAction.previousStates.forEach(({ tabId, state: oldState, originalIndex }) => {
          const tabIndex = newTabs.findIndex(t => t.id === tabId);
          if (tabIndex !== -1) {
            newTabs[tabIndex] = { ...oldState };
            if (restoredIndex === -1 || originalIndex < restoredIndex) restoredIndex = originalIndex;
          }
        });
      } else {
        const tabIndex = newTabs.findIndex(t => t.id === lastAction.tabId);
        if (tabIndex !== -1) {
          newTabs[tabIndex] = { ...lastAction.previousState };
          restoredIndex = tabIndex;
        }
      }

      return {
        ...state,
        tabs: newTabs,
        undoStack: stack,
        currentIndex: restoredIndex !== -1 ? restoredIndex : state.currentIndex,
        mode: Mode.TRIAGING // Always go back to triaging when undoing
      };
    }
    case 'GO_BACK': {
      let nextIndex = state.currentIndex;
      for (let i = state.currentIndex - 1; i >= 0; i--) {
        if (!state.tabs[i].gone) {
          nextIndex = i;
          break;
        }
      }
      return { ...state, currentIndex: nextIndex };
    }
    case 'UPDATE_TAB_ID': {
      const { oldId, newId } = action.payload;
      const newTabs = state.tabs.map(t => {
        if (t.id === oldId) return { ...t, id: newId, originalId: t.originalId || t.id };
        if (t.duplicates) {
          const dupIndex = t.duplicates.findIndex(d => d.id === oldId);
          if (dupIndex !== -1) {
            const newDups = [...t.duplicates];
            newDups[dupIndex] = { ...newDups[dupIndex], id: newId, originalId: newDups[dupIndex].originalId || newDups[dupIndex].id };
            return { ...t, duplicates: newDups };
          }
        }
        return t;
      });
      return { ...state, tabs: newTabs };
    }
    case 'TAB_GONE': {
      let newTabs = [...state.tabs];
      for (let i = 0; i < newTabs.length; i++) {
        const tab = newTabs[i];

        if (tab.id === action.payload) {
          const activeDupIndex = tab.duplicates?.findIndex(d => !d.gone) ?? -1;
          if (activeDupIndex !== -1) {
            const newPrimary = { ...tab.duplicates[activeDupIndex] };
            const newDups = [...tab.duplicates];
            newDups[activeDupIndex] = { ...tab, gone: true };
            newPrimary.duplicates = newDups;
            newTabs[i] = newPrimary;
          } else {
            newTabs[i] = { ...tab, gone: true };
          }
          break;
        }

        if (tab.duplicates) {
          const dupIndex = tab.duplicates.findIndex(d => d.id === action.payload);
          if (dupIndex !== -1) {
            const newDups = [...tab.duplicates];
            newDups[dupIndex] = { ...newDups[dupIndex], gone: true };
            newTabs[i] = { ...tab, duplicates: newDups };
            break;
          }
        }
      }
      return { ...state, tabs: newTabs };
    }
    case 'TAB_CREATED': {
      const mappedTab = createTriageTab(action.payload);
      const normUrl = normalizeUrl(mappedTab.url);
      const newTabs = [...state.tabs];

      let foundDup = false;
      for (let i = 0; i < newTabs.length; i++) {
        if (!newTabs[i].processed && !newTabs[i].gone && normalizeUrl(newTabs[i].url) === normUrl) {
          const updatedTab = { ...newTabs[i] };
          updatedTab.duplicates = [...(updatedTab.duplicates || []), mappedTab];
          newTabs[i] = updatedTab;
          foundDup = true;
          break;
        }
      }

      if (!foundDup) {
        newTabs.push(mappedTab);
      }

      return { ...state, tabs: newTabs };
    }
    case 'TAB_UPDATED': {
      const rawTab = action.payload;
      const newTabs = [...state.tabs];

      for (let i = 0; i < newTabs.length; i++) {
        if (newTabs[i].id === rawTab.id) {
          newTabs[i] = {
            ...newTabs[i],
            title: rawTab.title || newTabs[i].title,
            url: rawTab.url || newTabs[i].url,
            favIconUrl: rawTab.favIconUrl || newTabs[i].favIconUrl,
            pinned: rawTab.pinned ?? newTabs[i].pinned,
            groupId: rawTab.groupId ?? newTabs[i].groupId
          };
          break;
        }

        if (newTabs[i].duplicates) {
          const dupIndex = newTabs[i].duplicates.findIndex(d => d.id === rawTab.id);
          if (dupIndex !== -1) {
            const newDups = [...newTabs[i].duplicates];
            newDups[dupIndex] = {
              ...newDups[dupIndex],
              title: rawTab.title || newDups[dupIndex].title,
              url: rawTab.url || newDups[dupIndex].url,
              favIconUrl: rawTab.favIconUrl || newDups[dupIndex].favIconUrl,
              pinned: rawTab.pinned ?? newDups[dupIndex].pinned,
              groupId: rawTab.groupId ?? newDups[dupIndex].groupId
            };
            newTabs[i] = { ...newTabs[i], duplicates: newDups };
            break;
          }
        }
      }

      return { ...state, tabs: newTabs };
    }
    case 'OPEN_PICKER':
      return { ...state, mode: Mode.PICKER, picker: { ...state.picker, type: action.payload } };
    case 'ADD_BOOKMARK_FOLDER': {
      // Optimistically insert new folder into flat list and tree using the exact same object reference
      const newFolder = action.payload; // { id, title, parentId }
      const newNode = { id: newFolder.id, title: newFolder.title, path: newFolder.title, children: [] };
      const newFlat = [newNode, ...state.bookmarkFolders];

      // Recursively insert into the tree under the matching parent.
      const insertIntoTree = (nodes) =>
        nodes.map(n => {
          if (n.id === newFolder.parentId) {
            return { ...n, children: [newNode, ...n.children] };
          }
          if (n.children?.length) {
            return { ...n, children: insertIntoTree(n.children) };
          }
          return n;
        });

      const newTree = newFolder.parentId
        ? insertIntoTree(state.bookmarkTree)
        : [newNode, ...state.bookmarkTree];

      return { ...state, bookmarkFolders: newFlat, bookmarkTree: newTree };
    }
    case 'ADD_TAB_GROUP': {
      return { ...state, tabGroups: [action.payload, ...state.tabGroups] };
    }
    case 'START_REORDER': {
      return { ...state, isReordering: true };
    }
    case 'REORDER_TABS': {
      const mode = action.payload;
      const reordered = applyTabProcessing(state.tabs, mode);
      const nextIndex = reordered.findIndex(t => !t.processed && !t.gone);
      return {
        ...state,
        tabs: reordered,
        currentIndex: nextIndex === -1 ? state.currentIndex : nextIndex,
        isReordering: false,
      };
    }
    default:
      return state;
  }
}

const TriageContext = createContext();

export function TriageProvider({ children }) {
  const [state, dispatch] = useReducer(triageReducer, initialState);
  return (
    <TriageContext.Provider value={{ state, dispatch }}>
      {children}
    </TriageContext.Provider>
  );
}

export function useTriage() {
  return useContext(TriageContext);
}

export function useUpcomingTabs(limit = 3, filterFn = null) {
  const { state } = useTriage();
  const upcoming = [];
  let count = 0;

  for (let i = state.currentIndex; i < state.tabs.length && count < limit; i++) {
    const tab = state.tabs[i];
    if (!tab.processed && !tab.gone && (!filterFn || filterFn(tab))) {
      upcoming.push(tab);
      count++;
    }
  }

  return upcoming;
}

export function useHasYouTubeTabs() {
  const { state } = useTriage();
  return state.tabs.some(
    (tab) => !tab.processed && !tab.gone && tab.url?.includes('youtube.com/watch')
  );
}

export function useHasSuspendedTabs() {
  const { state } = useTriage();
  return state.tabs.some(
    (tab) => !tab.processed && !tab.gone && tab.isSuspended === true
  );
}
