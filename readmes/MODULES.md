# Modules and Files (Where is everything?)

Tabbit strictly isolates components, hooks, services, and utilities across a modular React/Vite build structure. If you are looking to modify a feature, fix a bug, or add a new tool, this guide will explain how the codebase is organized so you can find what you need quickly.

### The Shell & Extension Manifest
This section represents the outer shell of the Chrome Extension. Code here runs outside of the React application context. If you need to add new permissions, handle background tasks that run when the popup is closed, or interact natively with web pages, you will start here.

- `public/manifest.json`: Configuration, MV3 permissions list, and background worker entrypoint.
- `public/background.js`: Hides in the background. Operates the `auto-closer` interval logic, Tab Sorter message listeners, auto-grouper, auto-smusher, context menus, idle listener, and `chrome.debugger` attachment loops for tab screenshots.
- `public/watchLaterAutomation.js`: A standalone injected script used to parse DOM elements and click buttons natively on YouTube.
- `public/brand-title.svg`, `public/favicon.svg`, `public/icons/`: Branding and icon assets.
- `index.html`: The SPA entry point.

### The `src/` Directory Architecture
This is the core React application. Everything inside here is bundled by Vite.

#### `src/store/` (State Management)
Tabbit uses React Context for global state instead of Redux or Zustand. If you need to access global data (like the current list of tabs, theme settings, or hotkeys) from a component, or if you are adding a new global feature that needs to be accessed everywhere, you will likely add or modify a provider here.

- `TriageProvider.jsx`: The primary Context wrapping the application. Houses the tab queue, sorting, and primary Mode states.
- `PickerProvider.jsx`: Manages the display and data callbacks of the Bookmark and Tab Group picker overlays.
- `HotkeysProvider.jsx`: Bootstraps customizable user keybindings and manages synchronization with `localStorage`.
- `MonitorProvider.jsx`: Drives the scrolling log lines in the Retro Monitor component.
- `TabProcessingProvider.jsx`: Manages tab filtering and sorting modes.
- `ThemeProvider.jsx`: Manages the dark mode and overall theme state.
- `CRTEffectProvider.jsx`: Toggles the CRT retro monitor visual effect.
- `TimerProvider.jsx`: Manages the timer state for the triage session.
- `store/music/`: Houses `MusicProvider.jsx`, `musicConfig.js`, and song data definitions.

#### `src/components/` (The View Layer)
All React components live here. They are organized by domain rather than by type. If you are changing the UI, adjusting a layout, or fixing a visual bug, this is where you look. Shared UI components live in `Shared/`, while complex features have their own dedicated folders (like `Tools/`).

- `App.jsx` & `Dashboard/TriageDashboard.jsx`: The core orchestration layouts determining which phase (Triage deck, Wizard, Completion) is rendered.
- `Card/`: Main swipable triage card deck. Includes `Card.jsx`, `TabCard.jsx`, `CardActionMenu.jsx`, `CardViewSwitcher.jsx`, `CardFooter.jsx`, `CardHeader.jsx`, `CardOverlays.jsx`, `CardPills.jsx`, `CardActionPortal.jsx`, `PreviewPanel.jsx`, `CRTOverlay.jsx`, and animation/navigation hooks in `hooks/`.
- `Dashboard/`: Main entry layout (`TriageDashboard.jsx`), status bar HUD (`BottomStatusBar.jsx`), side drawers (`BookmarkPickerPanel.jsx`, `TabGroupPickerPanel.jsx`), permission prompts (`PermissionBanner.jsx`), empty states (`EmptyCard.jsx`), and the virtual pet mascot (`Monitor/`).
- `Modals/`: Co-located application dialogs (`Modal.jsx`, `AiOptInModal.jsx`, `ApplyTabsModal.jsx`, `BatchUndoWarningModal.jsx`, `DebuggingWarningModal.jsx`, `SmushConfirmModal.jsx`, `QuickStartTutorialModal.jsx`).
- `Shared/`: Reusable UI primitives (`Select`, `Tooltip`, `Favicon`, `InlineAddRow`, `ActionMenu`, `GridTabPreview`, `InfoIconWithTooltip`).
- `Hotkeys/`: UI for displaying keyboard shortcuts (`ActionHint.jsx`, `ActionHints.jsx`).
- `Tutorial/`: Components for onboarding (`MagicDot.jsx`, `MagicDotProvider.jsx`, `LoaderDots.tsx`, `LoaderPinwheel.tsx`, and `useTutorialSequence.jsx`).

##### `src/components/Tools/` (Feature Modules)
Every major "Tool" in Tabbit (accessible from the main dashboard or right-click menus) gets its own isolated folder here. If you are building a new feature, you should create a new folder here to contain its specific UI components.

- `AutoSmusher/`: `AutoSmusherPanel.jsx`
- `AutoSorter/`: `AutoSorterPanel.jsx`
- `AutoTabCloser/`: `AutoTabCloserPanel.jsx`
- `AutoTabGrouper/`: `AutoTabGrouperPanel.jsx`, rule editing forms, template selections, and preview grids.
- `BookmarkManager/`: `BookmarkManagerCard.jsx`, sidebar, browse panel, and cold storage UI.
- `CloseOldTabs/`: `CloseOldTabsCard.jsx`
- `ListView/`: `ListView.jsx`, sidebar, drag-select layer, and list-view tab cards.
- `MusicDev/`: `MusicDevTrackerCard.jsx`
- `Settings/`: `SettingsCard.jsx`
- `TabGroupWizard/`: `ManualTabGroupWizard.jsx` and group/tab row components.
- `WatchLater/`: `WatchLaterCard.jsx`

#### `src/constants/` (Static Copy & App Enums)
Hardcoded constants and strings. If you need to change a piece of text that is used in multiple places or add a new enum value, look here.

- `quips.js`: Mascot notification quotes and quips.
- `tabProcessingModes.js`: Stack sort and filter mode enum constants.

#### `src/hooks/` (Business Logic & Actions)
Custom React hooks. This is the glue between the View layer (`components/`) and the state/services. If a component is getting too complex, its logic is usually extracted into a hook here. If you are looking for the actual execution logic of a user action (like what happens when they click "Keep"), it's in `useTriageActions.js`.

- `useTriageActions.js`: Provides `keep()`, `close()`, `bookmark()`, and `group()` functions, tightly coupled with the global undo stack patching.
- `usePickerPanel.js`: A shared utility unifying fuzzy search filtering, DOM auto-scrolling, and `PickerContext` validation.
- `useKeyboard.js`: Globally routes explicit `keydown` presses against configured Hotkeys to drive app actions.
- `useAutoCloser.js`, `useAutoGrouper.js`, `useAutoSmusher.js`, `useAutoSorter.js`: UI-side integrations for the respective background tools.
- `useBeat.js`, `useMusicGame.js`: Rhythm game and music engine logic.
- `useBunny.js`: Mascot bunny sprite logic.
- `useCardTransition.js`: Card animation transitions.
- `useChromeApis.js`: Chrome API availability detection.
- `usePickerSuggestions.js`: Picker MRU history and suggestion logic.
- `useProgress.js`: Progress tracking.
- `useTutorial.js`: Tutorial state management.
- `useMonitor.js`: Thin re-export for monitor access.

#### `src/services/` (Asynchronous Integrations)
Heavy-lifting, non-UI asynchronous tasks. Code here typically interacts with browser APIs or complex data structures and returns clean data to the React hooks. If you need to fetch data from Chrome, process a massive array, or talk to an AI model, it goes here.

- `aiGroupingService.js`: Bootstraps and interfaces with Chrome's native `LanguageModel` (Gemini Nano) API for zero-latency, on-device AI intent grouping.
- `triageLoader.js`: The complex, initial boot-sequence service that queries all tabs, parses suspended tabs, and flattens Bookmark hierarchies.
- `autoTabGroupService.js`: The Auto Tab Grouper rule engine.
- `bookmarkService.js`: Bookmark Cleaner data operations.
- `pickerHistoryService.js`: Picker MRU history persistence.
- `tabProcessingService.js`: Tab filtering and sorting pipeline.
- `aiEvaluationSuite.js`: AI model evaluation and testing suite.

#### `src/utils/` (Helpers)
Pure functions and small helper utilities that don't rely on React state. These should be easily testable and imported anywhere. If you need to parse a URL, format a date, or manipulate a string, write a util for it.

- `archiveFileHandle.js`: File System Access API wrapper for bookmark cold storage.
- `autoCloseThresholds.js`: Auto-closer time threshold presets.
- `bookmarkUtils.js`: Bookmark tree manipulation utilities.
- `capture.js`: Lazily takes visual screenshots of Chrome windows via MV3 Debugger messages. Implements caching and fast-failure fallbacks for restricted protocols.
- `chromeUtils.js`: General Chrome API helpers.
- `domainPreferences.js`: Per-domain user preference storage.
- `domainUtils.js`: Domain extraction and normalization.
- `formatters.js`: Date and number formatting helpers.
- `matcherRegex.js`: URL pattern/regex matching for the Auto Grouper.
- `publicSuffixes.js`: Public Suffix List rules for registrable domain extraction.
- `tabUtils.js`: Tab-level utility functions.
- `watchLaterBatch.js`: Orchestration utility coordinating the sequential injection of `watchLaterAutomation.js` into targeted YouTube tabs.

#### `src/styles/`
Global CSS rules. Tabbit relies heavily on CSS modules for component-specific styling, but base variables and global resets live here.
- `global.css`: The global design system and styling.

#### `src/tests/`
Test suites and test configuration.
- `domainGrouping.test.js`: Tests for domain-based grouping logic.
- `loader.mjs`: Test loader configuration.

#### `src/assets/`
Static media files bundled by Vite.
- `brand-logo.svg`, `favicon-raw.svg`, `favicon-yellow.svg`, `rabbit/`: Brand graphics and sprite frames.
