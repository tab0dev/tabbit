import { useState, useCallback, useEffect } from 'react';

// =============================================================================
// localStorage Key Registry
// All localStorage keys used by this application are declared here.
// =============================================================================

/** Whether the user has opted out of the auto-showing tutorial. ('true' | null) */
const TUTORIAL_DISABLED_KEY = 'triage_tutorial_disabled';

/** Set after the first time the app is opened. Used to show "Welcome back!" on return visits. ('true' | null) */
const HAS_OPENED_BEFORE_KEY = 'app_has_opened_before';

// tabZeroHotkeys          — Custom hotkey bindings (JSON). Managed by HotkeysProvider.
// tab_processing_mode     — Active tab-processing mode. Managed by TabProcessingProvider & useChromeApis.
// monitor_mode            — Retro monitor display mode. Managed by MonitorProvider.
// picker_history          — Bookmark/tab-group picker recently-used history (JSON). Managed by pickerHistoryService.

// Dev override: Set this to true to always force the tutorial
const FORCE_TUTORIAL = false;

export function useTutorial() {
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [isTutorialDisabled, setIsTutorialDisabled] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // --- Returning-user detection ---
      // Read before writing so first-time visitors get isReturningUser = false.
      const hasOpenedBefore = localStorage.getItem(HAS_OPENED_BEFORE_KEY) === 'true';
      setIsReturningUser(hasOpenedBefore);
      // Mark the app as having been opened at least once.
      localStorage.setItem(HAS_OPENED_BEFORE_KEY, 'true');

      // --- Tutorial visibility ---
      // Check for forced override first
      if (FORCE_TUTORIAL) {
        setIsTutorialActive(true);
        setIsLoading(false);
        return;
      }

      const disabled = localStorage.getItem(TUTORIAL_DISABLED_KEY) === 'true';
      setIsTutorialDisabled(disabled);

      if (!disabled) {
        setIsTutorialActive(true);
      }
    } catch (e) {
      console.warn('Failed to read tutorial storage key', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeTutorial = useCallback(() => {
    setIsTutorialActive(false);
  }, []);

  const resetTutorial = useCallback(() => {
    setIsTutorialActive(true);
  }, []);

  const setTutorialDisabled = useCallback((disabled) => {
    try {
      localStorage.setItem(TUTORIAL_DISABLED_KEY, disabled.toString());
      setIsTutorialDisabled(disabled);
    } catch (e) {
      console.warn('Failed to save tutorial storage key', e);
    }
  }, []);

  return {
    isTutorialActive,
    isTutorialDisabled,
    isReturningUser,
    isLoading,
    completeTutorial,
    resetTutorial,
    setTutorialDisabled,
  };
}
