import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTriage } from '../store/TriageProvider';

import { TriageTab } from '../types';

// ─── Storage key (must match background.js SMUSH_SETTINGS_KEY) ────────────────
export const SMUSH_SETTINGS_KEY = 'tabbit_autosmush_settings';

export interface AutoSmusherSettings {
  enabled: boolean;
  skipPinned: boolean;
  ignoreFragments: boolean;
  ignoreQueryStrings: boolean;
}

export const DEFAULT_SMUSH_SETTINGS: AutoSmusherSettings = {
  enabled: false,
  skipPinned: true,
  ignoreFragments: false,
  ignoreQueryStrings: false,
};

// ─── URL normalisation ────────────────────────────────────────────────────────
// Mirrors background.js smushNormaliseUrl — single source of truth for both
// the live preview and the batch-close logic in the panel.
export function normaliseSmushUrl(
  rawUrl: string,
  {
    ignoreFragments,
    ignoreQueryStrings,
  }: { ignoreFragments: boolean; ignoreQueryStrings: boolean },
): string {
  try {
    const u = new URL(rawUrl);
    // Resolve suspended-tab real URL if encoded in the ?url= param
    const realUrlParam = u.searchParams.get('url');
    const base = realUrlParam ? new URL(decodeURIComponent(realUrlParam)) : u;
    let href = base.origin + base.pathname;
    if (!ignoreQueryStrings) href += base.search;
    if (!ignoreFragments) href += base.hash;
    return href;
  } catch {
    return rawUrl;
  }
}

// ─── useAutoSmusherStatus ─────────────────────────────────────────────────────
/**
 * Lightweight hook — returns just the `enabled` boolean.
 * Used by CardActionMenu to colour the icon when the smusher is active.
 */
export function useAutoSmusherStatus(): boolean {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (!chrome?.storage) return;

    chrome.storage.local.get(SMUSH_SETTINGS_KEY).then((res: { [key: string]: unknown }) => {
      setEnabled((res[SMUSH_SETTINGS_KEY] as Partial<AutoSmusherSettings>)?.enabled ?? false);
    });

    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && SMUSH_SETTINGS_KEY in changes) {
        setEnabled(
          (changes[SMUSH_SETTINGS_KEY].newValue as Partial<AutoSmusherSettings>)?.enabled ?? false,
        );
      }
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return enabled;
}

// ─── useAutoSmusher ───────────────────────────────────────────────────────────
/**
 * Manages Auto Smusher settings (read + write).
 * The SW watches chrome.storage.onChanged and updates its in-memory flags
 * automatically — no message passing required.
 */
export function useAutoSmusher(): {
  settings: AutoSmusherSettings;
  updateSettings: (patch: Partial<AutoSmusherSettings>) => Promise<void>;
  loading: boolean;
} {
  const [settings, setSettings] = useState<AutoSmusherSettings>(DEFAULT_SMUSH_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!chrome?.storage) {
      setLoading(false);
      return;
    }

    chrome.storage.local
      .get(SMUSH_SETTINGS_KEY)
      .then((res: { [key: string]: unknown }) =>
        setSettings({
          ...DEFAULT_SMUSH_SETTINGS,
          ...((res[SMUSH_SETTINGS_KEY] as Partial<AutoSmusherSettings>) ?? {}),
        }),
      )
      .catch((err) => console.error('[Tabbit] useAutoSmusher load failed:', err))
      .finally(() => setLoading(false));

    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && SMUSH_SETTINGS_KEY in changes) {
        setSettings({
          ...DEFAULT_SMUSH_SETTINGS,
          ...((changes[SMUSH_SETTINGS_KEY].newValue as Partial<AutoSmusherSettings>) ?? {}),
        });
      }
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AutoSmusherSettings>) => {
      if (!chrome?.storage) return;
      const next = { ...settings, ...patch };
      setSettings(next); // optimistic
      try {
        await chrome.storage.local.set({ [SMUSH_SETTINGS_KEY]: next });
      } catch (err) {
        console.error('[Tabbit] useAutoSmusher updateSettings failed:', err);
        setSettings(settings); // revert
      }
    },
    [settings],
  );

  return { settings, updateSettings, loading };
}

// ─── useDuplicateTabs ─────────────────────────────────────────────────────────
/**
 * Derives duplicate tab groups from the triage state, respecting the smusher's
 * normalisation settings. Returns:
 *   - duplicateGroups: Array<[normUrl: string, tabs: Tab[]]> — only groups with >1
 *   - duplicateTabCount: number — total extra tabs (tabs to close if smushed)
 *
 * Used by both the live preview in AutoSmusherPanel and handleConfirm.
 */
export function useDuplicateTabs({
  skipPinned,
  ignoreFragments,
  ignoreQueryStrings,
}: {
  skipPinned: boolean;
  ignoreFragments: boolean;
  ignoreQueryStrings: boolean;
}): { duplicateGroups: [string, TriageTab[]][]; duplicateTabCount: number } {
  const { state } = useTriage();

  const duplicateGroups = useMemo(() => {
    const tabs = state.tabs?.filter((t) => !t.gone && !t.processed && t.url) ?? [];
    const map = new Map<string, TriageTab[]>();

    for (const tab of tabs) {
      if (skipPinned && tab.pinned) continue;
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;
      const key = normaliseSmushUrl(tab.url, { ignoreFragments, ignoreQueryStrings });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tab);
    }

    return Array.from(map.entries())
      .filter(([, tabs]) => tabs.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
  }, [state.tabs, skipPinned, ignoreFragments, ignoreQueryStrings]);

  const duplicateTabCount = useMemo(
    () => duplicateGroups.reduce((sum, [, tabs]) => sum + tabs.length - 1, 0),
    [duplicateGroups],
  );

  return { duplicateGroups, duplicateTabCount };
}

// ─── closeSmushDuplicates ─────────────────────────────────────────────────────
/**
 * Performs the actual batch smush: removes all but the first tab in each group,
 * then focuses the first original. Returns a Promise<void>.
 * Extracted so the panel's handleConfirm stays thin.
 */
export async function closeSmushDuplicates(
  duplicateGroups: [string, TriageTab[]][],
): Promise<void> {
  const tabsToClose: number[] = [];
  let firstOriginal: TriageTab | null = null;

  for (const [, tabs] of duplicateGroups) {
    if (!firstOriginal) firstOriginal = tabs[0];
    for (let i = 1; i < tabs.length; i++) {
      tabsToClose.push(tabs[i].id);
    }
  }

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose);
  }
  if (firstOriginal) {
    await chrome.windows.update(firstOriginal.windowId, { focused: true });
    await chrome.tabs.update(firstOriginal.id, { active: true });
  }
}
