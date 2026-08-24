import { useCallback } from 'react';
import { useTriage } from '../store/TriageProvider';
import { useCardTransition } from './useCardTransition';
import { useMonitor } from './useMonitor';
import { useMusic } from '../store/music/MusicProvider';
import { pickQuip, TRIAGE_QUIPS } from '../constants/quips';
import { TriageTab, GroupId, UndoEntry, PickerType } from '../types';

/**
 * Module-level undo stack for Chrome API side effects. Hoisted outside the hook
 * so multiple hook instances share the same history (e.g. UI vs Hotkeys).
 */
export const globalChromeUndoStack: UndoEntry[] = [];

export interface TriageActions {
  keep: (tab: TriageTab, skipAnimation?: boolean) => void;
  keepBatch: (tabsToKeep: TriageTab[], skipAnimation?: boolean) => void;
  close: (tab: TriageTab, skipAnimation?: boolean) => void;
  closeBatch: (tabsToClose: TriageTab[], skipAnimation?: boolean) => void;
  bookmark: (tab: TriageTab, folderId: string, skipAnimation?: boolean) => void;
  bookmarkBatch: (
    tabsToBookmark: TriageTab[],
    folderId: string,
    folderName?: string,
    skipAnimation?: boolean,
  ) => void;
  group: (tab: TriageTab, groupId: GroupId, skipAnimation?: boolean) => void;
  groupBatch: (tabs: TriageTab[], groupId: GroupId) => void;
  undo: () => void;
  back: () => void;
  openPicker: (type: PickerType | null) => void;
  openTab: (tab: TriageTab) => void;
}

export function useTriageActions(): TriageActions {
  const { state, dispatch } = useTriage();
  const { delayedDispatch } = useCardTransition();
  const { postStatus } = useMonitor();
  const { onTabAction } = useMusic();

  const keepBatch = useCallback(
    (tabsToKeep: TriageTab[], skipAnimation = false) => {
      if (!tabsToKeep || tabsToKeep.length === 0) return;

      globalChromeUndoStack.push({ type: 'keepBatch' });
      postStatus(`KEPT ${tabsToKeep.length} TABS\n${pickQuip(TRIAGE_QUIPS.keep)}`, {
        ttlMs: 2500,
        icon: 'keep',
      });
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_BATCH',
        payload: { tabIds: tabsToKeep.map((t) => t.id), triageAction: 'keep' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  const keep = useCallback(
    (tab: TriageTab, skipAnimation = false) => {
      globalChromeUndoStack.push({ type: 'keep' });
      postStatus(`KEPT: ${tab.title || tab.url}\n${pickQuip(TRIAGE_QUIPS.keep)}`, {
        ttlMs: 2500,
        icon: 'keep',
      });
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_TAB',
        payload: { tabId: tab.id, triageAction: 'keep' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  const close = useCallback(
    (tab: TriageTab, skipAnimation = false) => {
      const allTabsToClose = [tab, ...(tab.duplicates || [])];
      const undoData: import('../types').UndoEntry = {
        type: 'close',
        tabs: allTabsToClose.map((t) => ({
          id: t.id,
          url: t.url,
          windowId: t.windowId,
          pinned: t.pinned,
        })),
      };
      allTabsToClose.forEach(async (t) => {
        if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => {});
        chrome?.tabs?.remove(t.id).catch(() => {});
      });
      globalChromeUndoStack.push(undoData);
      postStatus(`CLOSED: ${tab.title || tab.url}\n${pickQuip(TRIAGE_QUIPS.close)}`, {
        ttlMs: 2800,
        icon: 'close',
      });
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_TAB',
        payload: { tabId: tab.id, triageAction: 'close' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  const closeBatch = useCallback(
    (tabsToClose: TriageTab[], skipAnimation = false) => {
      if (!tabsToClose || tabsToClose.length === 0) return;

      const allTabsToClose = tabsToClose.flatMap((tab) => [tab, ...(tab.duplicates || [])]);
      const undoData: import('../types').UndoEntry = {
        type: 'close',
        tabs: allTabsToClose.map((t) => ({
          id: t.id,
          url: t.url,
          windowId: t.windowId,
          pinned: t.pinned,
        })),
      };

      allTabsToClose.forEach(async (t) => {
        if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => {});
        chrome?.tabs?.remove(t.id).catch(() => {});
      });

      globalChromeUndoStack.push(undoData);
      postStatus(`CLOSED ${allTabsToClose.length} TABS\n${pickQuip(TRIAGE_QUIPS.close)}`, {
        ttlMs: 2800,
        icon: 'close',
      });
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_BATCH',
        payload: { tabIds: tabsToClose.map((t) => t.id), triageAction: 'close' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  const bookmarkBatch = useCallback(
    (tabsToBookmark: TriageTab[], folderId: string, folderName = '', skipAnimation = false) => {
      if (!tabsToBookmark || tabsToBookmark.length === 0) return;

      const allTabsToClose = tabsToBookmark.flatMap((tab) => [tab, ...(tab.duplicates || [])]);
      const undoData: import('../types').UndoEntry = {
        type: 'bookmarkBatch',
        bookmarks: [] as { id: string }[],
        tabs: allTabsToClose.map((t) => ({
          id: t.id,
          url: t.url,
          windowId: t.windowId,
          pinned: t.pinned,
        })),
      };

      allTabsToClose.forEach(async (t) => {
        chrome?.bookmarks
          ?.create({ parentId: folderId, title: t.title, url: t.url })
          .then((bm) => {
            undoData.bookmarks.push({ id: bm.id });
          })
          .catch(() => {});
        if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => {});
        chrome?.tabs?.remove(t.id).catch(() => {});
      });

      globalChromeUndoStack.push(undoData);

      const folderText = folderName ? ` INTO "${folderName.toUpperCase()}"` : '';
      postStatus(
        `BOOKMARKED ${allTabsToClose.length} TABS${folderText}\n${pickQuip(TRIAGE_QUIPS.bookmark)}`,
        { ttlMs: 2800, icon: 'bookmark' },
      );
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_BATCH',
        payload: { tabIds: tabsToBookmark.map((t) => t.id), triageAction: 'bookmark' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  const bookmark = useCallback(
    (tab: TriageTab, folderId: string, skipAnimation = false) => {
      const allTabsToClose = [tab, ...(tab.duplicates || [])];
      const undoData: import('../types').UndoEntry = {
        type: 'bookmark',
        bookmarkId: null,
        tabs: allTabsToClose.map((t) => ({
          id: t.id,
          url: t.url,
          windowId: t.windowId,
          pinned: t.pinned,
        })),
      };
      chrome?.bookmarks
        ?.create({ parentId: folderId, title: tab.title, url: tab.url })
        .then((bm) => {
          undoData.bookmarkId = bm.id;
        })
        .catch(() => {});
      allTabsToClose.forEach(async (t) => {
        if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => {});
        chrome?.tabs?.remove(t.id).catch(() => {});
      });
      globalChromeUndoStack.push(undoData);
      postStatus(`BOOKMARKED TAB\n${pickQuip(TRIAGE_QUIPS.bookmark)}`, {
        ttlMs: 2800,
        icon: 'bookmark',
      });
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_TAB',
        payload: { tabId: tab.id, triageAction: 'bookmark' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  const group = useCallback(
    (tab: TriageTab, groupId: GroupId, skipAnimation = false) => {
      const allTabsToGroup = [tab, ...(tab.duplicates || [])];
      const tabIds = allTabsToGroup.map((t) => t.id);
      const undoData: import('../types').UndoEntry = {
        type: 'group',
        tabIds,
        previousGroupIds: allTabsToGroup.map((t) => t.groupId),
        pinnedStatus: allTabsToGroup.map((t) => t.pinned),
      };
      allTabsToGroup.forEach(async (t) => {
        if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => {});
      });
      chrome?.tabs
        ?.group({ groupId, tabIds: tabIds as unknown as [number, ...number[]] })
        .catch(() => {});
      globalChromeUndoStack.push(undoData);
      postStatus(`SENT TO GROUP\n${pickQuip(TRIAGE_QUIPS.group)}`, { ttlMs: 2800, icon: 'group' });
      onTabAction();
      const action: import('../types').TriageReducerAction = {
        type: 'PROCESS_TAB',
        payload: { tabId: tab.id, triageAction: 'group' },
      };
      if (skipAnimation) dispatch(action);
      else delayedDispatch(action);
    },
    [dispatch, delayedDispatch, postStatus, onTabAction],
  );

  // Groups a batch of tabs into an existing group, safely handling tabs spread across
  // multiple windows. Anchors to the group's own window, moves stray tabs in, then
  // calls chrome.tabs.group once for all tabs together.
  // Undo: ungrouped via chrome.tabs.ungroup. Note — the window move is not reversed.
  const groupBatch = useCallback(
    async (tabs: TriageTab[], groupId: GroupId) => {
      if (!tabs || tabs.length === 0) return;

      const allTabsToGroup = tabs.flatMap((tab) => [tab, ...(tab.duplicates || [])]);

      for (const tab of allTabsToGroup) {
        if (tab.pinned) await chrome?.tabs?.update(tab.id, { pinned: false }).catch(() => {});
      }

      const targetGroup = state.tabGroups?.find((g) => g.id === groupId);
      let targetWindowId = targetGroup?.windowId;

      if (!targetWindowId) {
        const windowCounts = new Map();
        for (const tab of allTabsToGroup) {
          windowCounts.set(tab.windowId, (windowCounts.get(tab.windowId) || 0) + 1);
        }
        let maxCount = 0;
        for (const [wId, count] of Array.from(windowCounts.entries())) {
          if (count > maxCount) {
            maxCount = count;
            targetWindowId = wId;
          }
        }
      }

      const tabsToMove = allTabsToGroup
        .filter((t) => t.windowId !== targetWindowId)
        .map((t) => t.id);
      if (tabsToMove.length > 0) {
        await chrome?.tabs
          ?.move(tabsToMove, { windowId: targetWindowId, index: -1 })
          .catch(() => {});
      }

      const allTabIds = allTabsToGroup.map((t) => t.id);
      chrome?.tabs
        ?.group({ groupId, tabIds: allTabIds as unknown as [number, ...number[]] })
        .catch(() => {});

      globalChromeUndoStack.push({
        type: 'group',
        tabIds: allTabIds,
        previousGroupIds: allTabsToGroup.map((t) => t.groupId),
        pinnedStatus: allTabsToGroup.map((t) => t.pinned),
      });

      // UI update ONLY needs parent IDs
      const parentTabIds = tabs.map((t) => t.id);
      postStatus(`SENT ${allTabsToGroup.length} TABS TO GROUP\n${pickQuip(TRIAGE_QUIPS.group)}`, {
        ttlMs: 2800,
        icon: 'group',
      });
      onTabAction();
      dispatch({ type: 'PROCESS_BATCH', payload: { tabIds: parentTabIds, triageAction: 'group' } });
    },
    [state.tabGroups, dispatch, postStatus, onTabAction],
  );

  const undo = useCallback(async () => {
    if (state.undoStack.length === 0) return;
    const chromeData = globalChromeUndoStack.pop();
    if (chromeData) {
      switch (chromeData.type) {
        case 'bookmarks_manager_custom': {
          await chromeData.undoFn();
          break;
        }
        case 'close':
        case 'bookmark':
        case 'bookmarkBatch': {
          chromeData.tabs.forEach((t) => {
            chrome?.tabs
              ?.create({ url: t.url, active: false, windowId: t.windowId, pinned: t.pinned })
              .then((newTab) => {
                if (newTab && newTab.id) {
                  dispatch({
                    type: 'UPDATE_TAB_ID',
                    payload: { oldId: t.id, newId: newTab.id as import('../types').TabId },
                  });
                }
              })
              .catch(() => {});
          });
          if (chromeData.type === 'bookmark' && chromeData.bookmarkId) {
            chrome?.bookmarks?.remove(chromeData.bookmarkId).catch(() => {});
          } else if (chromeData.type === 'bookmarkBatch' && chromeData.bookmarks) {
            chromeData.bookmarks.forEach((bm) => {
              chrome?.bookmarks?.remove(bm.id).catch(() => {});
            });
          }
          break;
        }
        case 'group': {
          if (chromeData.tabIds.length > 0) {
            chrome?.tabs
              ?.ungroup(chromeData.tabIds as unknown as [number, ...number[]])
              .catch(() => {});
          }
          if (chromeData.pinnedStatus) {
            chromeData.tabIds.forEach((id, index) => {
              if (chromeData.pinnedStatus[index]) {
                chrome?.tabs?.update(id, { pinned: true }).catch(() => {});
              }
            });
          }
          break;
        }
        // 'keep' has no Chrome-side effect to reverse
      }
    }
    postStatus(`UNDO APPLIED\n${pickQuip(TRIAGE_QUIPS.undo)}`, { ttlMs: 2200 });
    onTabAction(); // undo counts as a valid beat hit
    dispatch({ type: 'UNDO' });
  }, [state.undoStack.length, dispatch, postStatus, onTabAction]);

  const back = useCallback(() => {
    postStatus(`STEPPED BACK\n${pickQuip(TRIAGE_QUIPS.back)}`, { ttlMs: 1800 });
    dispatch({ type: 'GO_BACK' });
  }, [dispatch, postStatus]);

  const openPicker = useCallback(
    (type: PickerType | null) => {
      postStatus(
        `OPENED ${String(type || '').toUpperCase()} PICKER\n${pickQuip(TRIAGE_QUIPS.openPicker)}`,
        { ttlMs: 2200 },
      );
      dispatch({ type: 'OPEN_PICKER', payload: type as PickerType });
    },
    [dispatch, postStatus],
  );

  const openTab = useCallback((tab: TriageTab) => {
    if (!chrome?.tabs) return;
    chrome?.windows?.update(tab.windowId, { focused: true }).catch(() => {});
    chrome?.tabs?.update(tab.id, { active: true }).catch(() => {});
  }, []);

  return {
    keep,
    keepBatch,
    close,
    closeBatch,
    bookmark,
    bookmarkBatch,
    group,
    groupBatch,
    undo,
    back,
    openPicker,
    openTab,
  };
}
