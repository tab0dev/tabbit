import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TAB_PROCESSING_MODES, TAB_PROCESSING_STORAGE_KEY } from '../constants/tabProcessingModes';
import { TabProcessingMode } from '../types';

export interface TabProcessingContextValue {
  mode: TabProcessingMode;
  setMode: (mode: TabProcessingMode) => void;
  excludeSuspendedTabs: boolean;
  setExcludeSuspendedTabs: (val: boolean) => void;
  excludeGroupedTabs: boolean;
  setExcludeGroupedTabs: (val: boolean) => void;
}

const TabProcessingContext = createContext<TabProcessingContextValue | null>(null);

const VALID_VALUES = new Set(Object.values(TAB_PROCESSING_MODES));
const DEFAULT_MODE = TAB_PROCESSING_MODES.AUTO;
const EXCLUDE_SUSPENDED_KEY = 'tabbit_excludeSuspendedTabs';
const EXCLUDE_GROUPED_KEY = 'tabbit_excludeGroupedTabs';
// SW-readable mirror — localStorage is renderer-only, so we shadow the value
// into chrome.storage.local so background.js can read it directly.
const AG_SUSPEND_STORAGE_KEY = 'tabbit_excludeSuspendedTabs_remote';
const AG_GROUPED_STORAGE_KEY = 'tabbit_excludeGroupedTabs_remote';

export function TabProcessingProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TabProcessingMode>(DEFAULT_MODE as TabProcessingMode);
  const [excludeSuspendedTabs, setExcludeSuspendedTabsState] = useState(
    () => localStorage.getItem(EXCLUDE_SUSPENDED_KEY) === 'true',
  );
  const [excludeGroupedTabs, setExcludeGroupedTabsState] = useState(
    () => localStorage.getItem(EXCLUDE_GROUPED_KEY) === 'true',
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_PROCESSING_STORAGE_KEY);
      if (saved && VALID_VALUES.has(saved)) {
        setModeState(saved as TabProcessingMode);
      }
      // Seed the SW-readable mirror so background.js has the value on first load,
      // even before the user changes the setting during this session.
      const initialExclude = localStorage.getItem(EXCLUDE_SUSPENDED_KEY) === 'true';
      const initialExcludeGrouped = localStorage.getItem(EXCLUDE_GROUPED_KEY) === 'true';
      chrome.storage.local.set({
        [AG_SUSPEND_STORAGE_KEY]: initialExclude,
        [AG_GROUPED_STORAGE_KEY]: initialExcludeGrouped,
      });
    } catch (err) {
      console.error('Failed to load tab processing mode:', err);
    }
  }, []);

  const setMode = (nextMode: TabProcessingMode) => {
    if (!VALID_VALUES.has(nextMode)) return;
    setModeState(nextMode);
    try {
      localStorage.setItem(TAB_PROCESSING_STORAGE_KEY, nextMode);
    } catch (err) {
      console.error('Failed to save tab processing mode:', err);
    }
  };

  const setExcludeSuspendedTabs = (val: boolean) => {
    setExcludeSuspendedTabsState(val);
    try {
      localStorage.setItem(EXCLUDE_SUSPENDED_KEY, val.toString());
      // Keep the SW-readable mirror in sync so background.js sees the update live.
      chrome.storage.local.set({ [AG_SUSPEND_STORAGE_KEY]: val });
    } catch (err) {
      console.error('Failed to save excludeSuspendedTabs:', err);
    }
  };

  const setExcludeGroupedTabs = (val: boolean) => {
    setExcludeGroupedTabsState(val);
    try {
      localStorage.setItem(EXCLUDE_GROUPED_KEY, val.toString());
      chrome.storage.local.set({ [AG_GROUPED_STORAGE_KEY]: val });
    } catch (err) {
      console.error('Failed to save excludeGroupedTabs:', err);
    }
  };

  return (
    <TabProcessingContext.Provider
      value={{
        mode,
        setMode,
        excludeSuspendedTabs,
        setExcludeSuspendedTabs,
        excludeGroupedTabs,
        setExcludeGroupedTabs,
      }}
    >
      {children}
    </TabProcessingContext.Provider>
  );
}

export function useTabProcessing(): TabProcessingContextValue {
  const ctx = useContext(TabProcessingContext);
  if (!ctx) {
    throw new Error('useTabProcessing must be used within a TabProcessingProvider');
  }
  return ctx;
}
