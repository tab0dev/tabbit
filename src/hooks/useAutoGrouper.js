import { useState, useEffect, useCallback } from "react";

// ─── Storage keys (must match background.js) ─────────────────────────────────
const SETTINGS_KEY = "tabbit_autogrouper_settings";
const RULES_KEY = "tabbit_autogrouper_rules";

const DEFAULT_SETTINGS = {
  enabled: false,
};

/**
 * Lightweight hook to get just the enabled status without loading the full
 * rules or triggering anything else.
 */
export function useAutoGrouperStatus() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!chrome?.storage) return;

    chrome.storage.local.get(SETTINGS_KEY).then((res) => {
      setEnabled(res[SETTINGS_KEY]?.enabled ?? false);
    });

    const handleStorageChange = (changes, area) => {
      if (area === "local" && SETTINGS_KEY in changes) {
        setEnabled(changes[SETTINGS_KEY].newValue?.enabled ?? false);
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
export function useAutoGrouper() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Load settings + rules from storage on mount ─────────────────────────
  useEffect(() => {
    if (!chrome?.storage) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [settingsResult, rulesResult] = await Promise.all([
          chrome.storage.local.get(SETTINGS_KEY),
          chrome.storage.local.get(RULES_KEY),
        ]);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(settingsResult[SETTINGS_KEY] ?? {}),
        });
        setRules(rulesResult[RULES_KEY] ?? []);
      } catch (err) {
        console.error("[Tabbit] useAutoGrouper load failed:", err);
      } finally {
        setLoading(false);
      }
    }

    load();

    function handleStorageChange(changes, area) {
      if (area === "local") {
        if (RULES_KEY in changes) {
          setRules(changes[RULES_KEY].newValue ?? []);
        }
        if (SETTINGS_KEY in changes) {
            setSettings({
                ...DEFAULT_SETTINGS,
                ...(changes[SETTINGS_KEY].newValue ?? {}),
            });
        }
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // ── Save settings ──
  const updateSettings = useCallback(
    async (patch) => {
      if (!chrome?.storage) return;
      const next = { ...settings, ...patch };
      setSettings(next); // optimistic local update
      try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      } catch (err) {
        console.error("[Tabbit] updateSettings failed:", err);
        setSettings(settings); // revert on failure
      }
    },
    [settings]
  );

  // ── Save rules ──
  const updateRules = useCallback(
    async (newRules) => {
      if (!chrome?.storage) return;
      setRules(newRules); // optimistic local update
      try {
        await chrome.storage.local.set({ [RULES_KEY]: newRules });
      } catch (err) {
        console.error("[Tabbit] updateRules failed:", err);
        setRules(rules); // revert on failure
      }
    },
    [rules]
  );

  return {
    settings,
    updateSettings,
    rules,
    updateRules,
    loading,
  };
}
