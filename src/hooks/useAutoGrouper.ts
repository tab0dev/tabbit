import { useState, useEffect, useCallback } from 'react';

// ─── Storage keys (must match background.js) ─────────────────────────────────
const SETTINGS_KEY = 'tabbit_autogrouper_settings';
const RULES_KEY = 'tabbit_autogrouper_rules';

export interface AutoGrouperSettings {
  enabled: boolean;
}

export interface AutoGrouperPattern {
  id?: string;
  type?: string;
  target?: string;
  method?: string;
  value: string;
  isRegex?: boolean;
}

export interface AutoGrouperRule {
  id: string;
  groupName: string;
  groupColor: chrome.tabGroups.Color;
  patterns?: AutoGrouperPattern[];
  pattern?: string;
  isRegex?: boolean;
  strict?: boolean;
  merge?: boolean;
}

const DEFAULT_SETTINGS: AutoGrouperSettings = {
  enabled: false,
};

/**
 * Lightweight hook to get just the enabled status without loading the full
 * rules or triggering anything else.
 */
export function useAutoGrouperStatus(): boolean {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (!chrome?.storage) return;

    chrome.storage.local.get(SETTINGS_KEY).then((res: { [key: string]: unknown }) => {
      setEnabled((res[SETTINGS_KEY] as Partial<AutoGrouperSettings>)?.enabled ?? false);
    });

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === 'local' && SETTINGS_KEY in changes) {
        setEnabled(
          (changes[SETTINGS_KEY].newValue as Partial<AutoGrouperSettings>)?.enabled ?? false,
        );
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return enabled;
}

/**
 * Manages auto-grouper settings and rules by reading/writing
 * chrome.storage directly.
 */
export function useAutoGrouper(): {
  settings: AutoGrouperSettings;
  updateSettings: (patch: Partial<AutoGrouperSettings>) => Promise<void>;
  rules: AutoGrouperRule[];
  updateRules: (newRules: AutoGrouperRule[]) => Promise<void>;
  loading: boolean;
} {
  const [settings, setSettings] = useState<AutoGrouperSettings>(DEFAULT_SETTINGS);
  const [rules, setRules] = useState<AutoGrouperRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // ── Load settings + rules from storage on mount ─────────────────────────
  useEffect(() => {
    if (!chrome?.storage) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [settingsResult, rulesResult] = await Promise.all<{ [key: string]: unknown }>([
          chrome.storage.local.get(SETTINGS_KEY),
          chrome.storage.local.get(RULES_KEY),
        ]);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...((settingsResult[SETTINGS_KEY] as Partial<AutoGrouperSettings>) ?? {}),
        });
        setRules((rulesResult[RULES_KEY] as AutoGrouperRule[]) ?? []);
      } catch (err) {
        console.error('[Tabbit] useAutoGrouper load failed:', err);
      } finally {
        setLoading(false);
      }
    }

    load();

    function handleStorageChange(
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) {
      if (area === 'local') {
        if (RULES_KEY in changes) {
          setRules((changes[RULES_KEY].newValue as AutoGrouperRule[]) ?? []);
        }
        if (SETTINGS_KEY in changes) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...((changes[SETTINGS_KEY].newValue as Partial<AutoGrouperSettings>) ?? {}),
          });
        }
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // ── Save settings ──
  const updateSettings = useCallback(
    async (patch: Partial<AutoGrouperSettings>) => {
      if (!chrome?.storage) return;
      const next = { ...settings, ...patch };
      setSettings(next); // optimistic local update
      try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      } catch (err) {
        console.error('[Tabbit] updateSettings failed:', err);
        setSettings(settings); // revert on failure
      }
    },
    [settings],
  );

  // ── Save rules ──
  const updateRules = useCallback(
    async (newRules: AutoGrouperRule[]) => {
      if (!chrome?.storage) return;
      setRules(newRules); // optimistic local update
      try {
        await chrome.storage.local.set({ [RULES_KEY]: newRules });
      } catch (err) {
        console.error('[Tabbit] updateRules failed:', err);
        setRules(rules); // revert on failure
      }
    },
    [rules],
  );

  return {
    settings,
    updateSettings,
    rules,
    updateRules,
    loading,
  };
}
