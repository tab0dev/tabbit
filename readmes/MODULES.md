# Modules and Files (Where is everything?)

Tabbit strictly isolates components, hooks, services, and utilities across a modular React/Vite build structure.

### The Shell & Extension Manifest
- `public/manifest.json`: Configuration, MV3 permissions list, and background worker entrypoint.
- `public/background.js`: Hides in the background. Operates the `auto-closer` interval logic, Tab Sorter message listeners, and `chrome.debugger` attachment loops for tab screenshots.
- `public/watchLaterAutomation.js`: A standalone injected script used to parse DOM elements and click buttons natively on YouTube.
- `index.html`: The SPA entry point.

### The `src/` Directory Architecture

#### `src/store/` (State Management)
- `TriageProvider.jsx`: The primary Context wrapping the application. Houses the tab queue, sorting, and primary Mode states.
- `PickerProvider.jsx`: Manages the display and data callbacks of the Bookmark and Tab Group picker overlays.
- `HotkeysProvider.jsx`: Bootstraps customizable user keybindings and manages synchronization with `localStorage`.
- `MonitorProvider.jsx`: Drives the scrolling log lines in the Retro Monitor component.

#### `src/components/` (The View Layer)
- `App.jsx` & `Dashboard/TriageDashboard.jsx`: The core orchestration layouts determining which phase (Triage deck, Wizard, Completion) is rendered.
- `Card/PreviewPanel.jsx`: Visual rendering of `base64` image screenshots wrapped in CRT scanlines.
- `Overlay/`: Contains `BookmarkPickerPanel` and `TabGroupPickerPanel` for rendering keyboard-accessible fuzzy-search dropdowns.
- `Dashboard/AutoTabGroupWizard/`: Advanced UI flow leveraging Gemini Nano to prompt the user to automatically group uncategorized tabs.
- `Monitor/`: The pixel-art CRT console that scrolls action events and houses the integrated Rhythm Music Game mascot.

#### `src/hooks/` (Business Logic & Actions)
- `useTriageActions.js`: Provides `keep()`, `close()`, `bookmark()`, and `group()` functions, tightly coupled with the global undo stack patching.
- `usePickerPanel.js`: A shared utility unifying fuzzy search filtering, DOM auto-scrolling, and `PickerContext` validation.
- `useKeyboard.js`: Globally routes explicit `keydown` presses against configured Hotkeys to drive app actions.

#### `src/services/` (Asynchronous Integrations)
- `aiGroupingService.js`: Bootstraps and interfaces with Chrome's native `LanguageModel` (Gemini Nano) API for zero-latency, on-device AI intent grouping.
- `triageLoader.js`: The complex, initial boot-sequence service that queries all tabs, parses suspended tabs, and flattens Bookmark hierarchies.

#### `src/utils/` (Helpers)
- `capture.js`: Lazily takes visual screenshots of Chrome windows via MV3 Debugger messages. Implements caching and fast-failure fallbacks for restricted protocols.
- `watchLaterBatch.js`: Orchestration utility coordinating the sequential injection of `watchLaterAutomation.js` into targeted YouTube tabs.
