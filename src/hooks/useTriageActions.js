import { useCallback } from 'react';
import { useTriage } from '../store/TriageProvider';
import { useCardTransition } from './useCardTransition';
import { useMonitor } from './useMonitor';
import { useMusic } from '../store/MusicProvider';
import { pickQuip, TRIAGE_QUIPS } from '../data/quips';

/**
 * A persistent module-level stack (parallel to state.undoStack) that stores everything
 * needed to reverse each Chrome API call when undo() is invoked. Hoisted outside the hook
 * so multiple hook instances (e.g. UI vs Hotkeys) share the exact same Chrome action history.
 */
const globalChromeUndoStack = [];

/**
 * Centralized triage action creators that bundle Chrome API side effects
 * with reducer dispatches — mirroring vanilla's engine.js + commands.js.
 */
export function useTriageActions() {
  const { state, dispatch } = useTriage();
  const { delayedDispatch } = useCardTransition();
  const { postStatus } = useMonitor();
  const { onTabAction } = useMusic();

  const keep = useCallback((tab, skipAnimation = false) => {
    globalChromeUndoStack.push({ type: 'keep' });
    postStatus(`KEPT: ${tab.title || tab.url}\n${pickQuip(TRIAGE_QUIPS.keep)}`, { ttlMs: 2500, icon: 'keep' });
    onTabAction();
    const action = { type: 'PROCESS_TAB', payload: { tabId: tab.id, triageAction: 'keep' } };
    if (skipAnimation) dispatch(action);
    else delayedDispatch(action);
  }, [dispatch, delayedDispatch, postStatus, onTabAction]);

  const close = useCallback((tab, skipAnimation = false) => {
    const allTabsToClose = [tab, ...(tab.duplicates || [])];
    const undoData = { type: 'close', tabs: allTabsToClose.map(t => ({ id: t.id, url: t.url, windowId: t.windowId, pinned: t.pinned })) };
    allTabsToClose.forEach(async t => {
      if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => { });
      chrome?.tabs?.remove(t.id).catch(() => { });
    });
    globalChromeUndoStack.push(undoData);
    postStatus(`CLOSED: ${tab.title || tab.url}\n${pickQuip(TRIAGE_QUIPS.close)}`, { ttlMs: 2800, icon: 'close' });
    onTabAction();
    const action = { type: 'PROCESS_TAB', payload: { tabId: tab.id, triageAction: 'close' } };
    if (skipAnimation) dispatch(action);
    else delayedDispatch(action);
  }, [dispatch, delayedDispatch, postStatus, onTabAction]);

  const closeBatch = useCallback((tabsToClose, skipAnimation = false) => {
    if (!tabsToClose || tabsToClose.length === 0) return;
    
    let allTabsToClose = [];
    tabsToClose.forEach(tab => {
        allTabsToClose.push(tab);
        if (tab.duplicates) {
            allTabsToClose.push(...tab.duplicates);
        }
    });

    const undoData = { type: 'close', tabs: allTabsToClose.map(t => ({ id: t.id, url: t.url, windowId: t.windowId, pinned: t.pinned })) };
    
    allTabsToClose.forEach(async t => {
      if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => { });
      chrome?.tabs?.remove(t.id).catch(() => { });
    });
    
    globalChromeUndoStack.push(undoData);
    postStatus(`CLOSED ${tabsToClose.length} TABS\n${pickQuip(TRIAGE_QUIPS.close)}`, { ttlMs: 2800, icon: 'close' });
    onTabAction();
    const action = { type: 'PROCESS_BATCH', payload: { tabIds: tabsToClose.map(t => t.id), triageAction: 'close' } };
    if (skipAnimation) dispatch(action);
    else delayedDispatch(action);
  }, [dispatch, delayedDispatch, postStatus, onTabAction]);

  const bookmark = useCallback((tab, folderId, skipAnimation = false) => {
    const allTabsToClose = [tab, ...(tab.duplicates || [])];
    const undoData = { type: 'bookmark', bookmarkId: null, tabs: allTabsToClose.map(t => ({ id: t.id, url: t.url, windowId: t.windowId, pinned: t.pinned })) };
    chrome?.bookmarks?.create({ parentId: folderId, title: tab.title, url: tab.url })
      .then(bm => { undoData.bookmarkId = bm.id; })
      .catch(() => { });
    allTabsToClose.forEach(async t => {
      if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => { });
      chrome?.tabs?.remove(t.id).catch(() => { });
    });
    globalChromeUndoStack.push(undoData);
    postStatus(`BOOKMARKED TAB\n${pickQuip(TRIAGE_QUIPS.bookmark)}`, { ttlMs: 2800, icon: 'bookmark' });
    onTabAction();
    const action = { type: 'PROCESS_TAB', payload: { tabId: tab.id, triageAction: 'bookmark' } };
    if (skipAnimation) dispatch(action);
    else delayedDispatch(action);
  }, [dispatch, delayedDispatch, postStatus, onTabAction]);

  const group = useCallback((tab, groupId, skipAnimation = false) => {
    const allTabsToGroup = [tab, ...(tab.duplicates || [])];
    const tabIds = allTabsToGroup.map(t => t.id);
    const undoData = { 
      type: 'group', 
      tabIds, 
      previousGroupIds: allTabsToGroup.map(t => t.groupId),
      pinnedStatus: allTabsToGroup.map(t => t.pinned)
    };
    allTabsToGroup.forEach(async t => {
      if (t.pinned) await chrome?.tabs?.update(t.id, { pinned: false }).catch(() => { });
    });
    chrome?.tabs?.group({ groupId, tabIds }).catch(() => { });
    globalChromeUndoStack.push(undoData);
    postStatus(`SENT TO GROUP\n${pickQuip(TRIAGE_QUIPS.group)}`, { ttlMs: 2800, icon: 'group' });
    onTabAction();
    const action = { type: 'PROCESS_TAB', payload: { tabId: tab.id, triageAction: 'group' } };
    if (skipAnimation) dispatch(action);
    else delayedDispatch(action);
  }, [dispatch, delayedDispatch, postStatus, onTabAction]);

  const undo = useCallback(() => {
    if (state.undoStack.length === 0) return;
    const chromeData = globalChromeUndoStack.pop();
    if (chromeData) {
      switch (chromeData.type) {
        case 'close':
        case 'bookmark': {
          chromeData.tabs.forEach(t => {
            chrome?.tabs?.create({ url: t.url, active: false, windowId: t.windowId, pinned: t.pinned })
              .then(newTab => {
                if (newTab && newTab.id) {
                  dispatch({ type: 'UPDATE_TAB_ID', payload: { oldId: t.id, newId: newTab.id } });
                }
              })
              .catch(() => { });
          });
          if (chromeData.type === 'bookmark' && chromeData.bookmarkId) {
            chrome?.bookmarks?.remove(chromeData.bookmarkId).catch(() => { });
          }
          break;
        }
        case 'group': {
          chrome?.tabs?.ungroup(chromeData.tabIds).catch(() => { });
          if (chromeData.pinnedStatus) {
            chromeData.tabIds.forEach((id, index) => {
              if (chromeData.pinnedStatus[index]) {
                chrome?.tabs?.update(id, { pinned: true }).catch(() => { });
              }
            });
          }
          break;
        }
        // 'keep': nothing to reverse in Chrome
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

  const openPicker = useCallback((type) => {
    postStatus(`OPENED ${String(type || '').toUpperCase()} PICKER\n${pickQuip(TRIAGE_QUIPS.openPicker)}`, { ttlMs: 2200 });
    dispatch({ type: 'OPEN_PICKER', payload: type });
  }, [dispatch, postStatus]);

  return { keep, close, closeBatch, bookmark, group, undo, back, openPicker };
}
