import { useEffect } from 'react';
import { useTriage, Mode } from '../store/TriageProvider';
import { loadTriageData } from '../services/triageLoader';
import { useMonitor } from './useMonitor';
import { TAB_PROCESSING_MODES, TAB_PROCESSING_STORAGE_KEY } from '../store/tabProcessingModes';

export function useChromeApis() {
  const { dispatch } = useTriage();
  const { postStatus } = useMonitor();

  useEffect(() => {
    async function init() {
      try {
        // postStatus('INITIALIZING TRIAGE ENGINE', { ttlMs: 2400 });
        if (!chrome?.permissions) {
          // Dev fallback — skip straight to triaging
          dispatch({ type: 'SET_MODE', payload: Mode.TRIAGING });
          postStatus('DEV MODE: PERMISSIONS SKIPPED', { ttlMs: 2600 });
          return;
        }

        const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
        if (!hasPermission) {
          dispatch({ type: 'SET_MODE', payload: Mode.PERMISSION });
          postStatus('PERMISSION REQUIRED', { ttlMs: 3000 });
          return;
        }

        await loadTriageData(dispatch);

        // Apply initial tab ordering based on persisted preference (once on startup).
        try {
          const saved = localStorage.getItem(TAB_PROCESSING_STORAGE_KEY);
          const validValues = Object.values(TAB_PROCESSING_MODES);
          const mode = saved && validValues.includes(saved) ? saved : TAB_PROCESSING_MODES.AUTO;
          dispatch({ type: 'REORDER_TABS', payload: mode });
        } catch {
          // If anything goes wrong, fall back to default ordering.
        }
      } catch (err) {
        console.error('[Tabbit] Init failed:', err);
        postStatus('INIT FAILED', { ttlMs: 3000, level: 'error' });
      }
    }

    init();

    // Keep triage state in sync if the auto-closer worker (or any other
    // external force) closes a tab while this page is open.
    const handleTabRemoved = (tabId) => {
      dispatch({ type: 'TAB_GONE', payload: tabId });
    };
    const handleTabCreated = (tab) => {
      dispatch({ type: 'TAB_CREATED', payload: tab });
    };

    const handleTabUpdated = (tabId, changeInfo, tab) => {
      // Dispatch the fully updated tab object
      dispatch({ type: 'TAB_UPDATED', payload: tab });
    };

    chrome.tabs?.onRemoved.addListener(handleTabRemoved);
    chrome.tabs?.onCreated.addListener(handleTabCreated);
    chrome.tabs?.onUpdated.addListener(handleTabUpdated);
    return () => {
      chrome.tabs?.onRemoved.removeListener(handleTabRemoved);
      chrome.tabs?.onCreated.removeListener(handleTabCreated);
      chrome.tabs?.onUpdated.removeListener(handleTabUpdated);
    };
  }, [dispatch, postStatus]);
}
