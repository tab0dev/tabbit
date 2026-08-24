import { useState, useEffect, useCallback } from 'react';

// ─── Storage key (must match background.js TAB_SORTER_SETTINGS_KEY) ───────────
export const SORTER_SETTINGS_KEY = 'tabbit_tabsorter_settings';

export interface AutoSorterSettings {
  sortBy: string;
  groupSuspendedTabs: boolean;
  tabSuspenderExtensionId: string;
  sortPinnedTabs: boolean;
  autoSortEnabled: boolean;
}

export const DEFAULT_SORTER_SETTINGS: AutoSorterSettings = {
  sortBy: 'url',
  groupSuspendedTabs: false,
  tabSuspenderExtensionId: 'bbomjaikkcabgmfaomdichgcodnaeecf',
  sortPinnedTabs: false,
  autoSortEnabled: false,
};

// ─── useAutoSorterStatus ──────────────────────────────────────────────────────
/**
 * Lightweight hook — returns just the `autoSortEnabled` boolean.
 * Used by CardActionMenu to colour the icon when the sorter daemon is active.
 */
export function useAutoSorterStatus(): boolean {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (!chrome?.storage) return;

    chrome.storage.local.get(SORTER_SETTINGS_KEY).then((res: { [key: string]: unknown }) => {
      setEnabled(
        (res[SORTER_SETTINGS_KEY] as Partial<AutoSorterSettings>)?.autoSortEnabled ?? false,
      );
    });

    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && SORTER_SETTINGS_KEY in changes) {
        setEnabled(
          (changes[SORTER_SETTINGS_KEY].newValue as Partial<AutoSorterSettings>)?.autoSortEnabled ??
            false,
        );
      }
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return enabled;
}

// ─── useAutoSorter ────────────────────────────────────────────────────────────
/**
 * Manages Tab Sorter + Auto Sorter settings (read + write).
 * Shares tabbit_tabsorter_settings with the existing TabSorterCard —
 * same key, extended schema. The SW watches storage.onChanged and updates
 * autoSort_enabled automatically — no message passing required.
 */
export function useAutoSorter(): {
  settings: AutoSorterSettings;
  updateSettings: (patch: Partial<AutoSorterSettings>) => Promise<void>;
  loading: boolean;
} {
  const [settings, setSettings] = useState<AutoSorterSettings>(DEFAULT_SORTER_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!chrome?.storage) {
      setLoading(false);
      return;
    }

    chrome.storage.local
      .get(SORTER_SETTINGS_KEY)
      .then((res: { [key: string]: unknown }) =>
        setSettings({
          ...DEFAULT_SORTER_SETTINGS,
          ...((res[SORTER_SETTINGS_KEY] as Partial<AutoSorterSettings>) ?? {}),
        }),
      )
      .catch((err) => console.error('[Tabbit] useAutoSorter load failed:', err))
      .finally(() => setLoading(false));

    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && SORTER_SETTINGS_KEY in changes) {
        setSettings({
          ...DEFAULT_SORTER_SETTINGS,
          ...((changes[SORTER_SETTINGS_KEY].newValue as Partial<AutoSorterSettings>) ?? {}),
        });
      }
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AutoSorterSettings>) => {
      if (!chrome?.storage) return;
      const next = { ...settings, ...patch };
      setSettings(next); // optimistic
      try {
        await chrome.storage.local.set({ [SORTER_SETTINGS_KEY]: next });
      } catch (err) {
        console.error('[Tabbit] useAutoSorter updateSettings failed:', err);
        setSettings(settings); // revert
      }
    },
    [settings],
  );

  return { settings, updateSettings, loading };
}
