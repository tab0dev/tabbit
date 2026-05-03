import { useState, useEffect, useCallback } from "react";
import {
  thresholdFromMs,
  AUTO_CLOSER_THRESHOLDS,
} from "../utils/autoCloseThresholds";

// ─── Storage keys (must match background.js) ─────────────────────────────────
const SETTINGS_KEY = "tabbit_autoclose_settings";
const GRAVEYARD_KEY = "tabbit_graveyard";

const DEFAULT_SETTINGS = {
  enabled: false,
  thresholdMs: 1000 * 60 * 60 * 24 * 7, // 7 days
  intervalMinutes: 30,
};

/**
 * Lightweight hook to get just the enabled status without loading the full
 * graveyard or triggering anything else.
 */
export function useAutoCloserStatus() {
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
 * Manages auto-closer settings and the graveyard by reading/writing
 * chrome.storage directly — no message passing to the service worker.
 *
 * The service worker watches chrome.storage.onChanged and re-arms its alarm
 * automatically whenever settings are saved here.
 */
export function useAutoCloser() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [graveyard, setGraveyard] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Load settings + graveyard from storage on mount ─────────────────────
  useEffect(() => {
    // Guard: chrome.storage is not available in dev/browser mode
    if (!chrome?.storage) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [settingsResult, graveyardResult] = await Promise.all([
          chrome.storage.local.get(SETTINGS_KEY),
          chrome.storage.session.get(GRAVEYARD_KEY),
        ]);

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(settingsResult[SETTINGS_KEY] ?? {}),
        });
        setGraveyard(graveyardResult[GRAVEYARD_KEY] ?? []);
      } catch (err) {
        console.error("[Tabbit] useAutoCloser load failed:", err);
      } finally {
        setLoading(false);
      }
    }

    load();

    // Keep graveyard in sync if another tab triggers a closure while this
    // page is open — chrome.storage.onChanged fires across contexts.
    function handleStorageChange(changes, area) {
      if (area === "session" && GRAVEYARD_KEY in changes) {
        setGraveyard(changes[GRAVEYARD_KEY].newValue ?? []);
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // ── Save settings + trigger alarm re-arm (via storage.onChanged in SW) ──
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
    [settings],
  );

  // ── Restore a single graveyard entry ─────────────────────────────────────
  const restoreTab = useCallback(
    async (entry) => {
      if (!chrome?.storage) return;
      // Optimistic remove from local state first for instant feedback
      const next = graveyard.filter((e) => e.id !== entry.id);
      setGraveyard(next);
      try {
        await Promise.all([
          chrome.storage.session.set({ [GRAVEYARD_KEY]: next }),
          chrome.tabs.create({ url: entry.url, active: false }),
        ]);
      } catch (err) {
        console.error("[Tabbit] restoreTab failed:", err);
        setGraveyard(graveyard); // revert on failure
      }
    },
    [graveyard],
  );

  // ── Clear the entire graveyard ───────────────────────────────────────────
  const clearGraveyard = useCallback(async () => {
    if (!chrome?.storage) return;
    setGraveyard([]);
    try {
      await chrome.storage.session.remove(GRAVEYARD_KEY);
    } catch (err) {
      console.error("[Tabbit] clearGraveyard failed:", err);
    }
  }, []);

  // ── Convenience: translate stored ms ↔ Select option value string ────────
  const thresholdKey = thresholdFromMs(settings.thresholdMs)?.value ?? "7_days";

  return {
    // Settings
    settings,
    thresholdKey,
    updateSettings,
    // Graveyard
    graveyard,
    restoreTab,
    clearGraveyard,
    // State
    loading,
  };
}
