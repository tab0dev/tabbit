# Architecture and Design

Tabbit is structured as a modern React Single-Page Application (SPA) running in a dedicated Chrome extension tab (`index.html`), backed by a Chrome MV3 Service Worker (`background.js`).

## The Core Interaction Loop

1. **User Opens Tabbit**: They click the extension icon. The `background.js` checks if a triage tab already exists. If yes, it focuses it; if no, it opens a new one.
2. **Initialization (`TriageProvider.jsx`)**: The app queries for all tabs across all windows using `chrome.tabs.query({})` and builds an in-memory queue.
3. **The State Machine**: All navigation and UI rendering are governed by explicit modes defined in `TriageProvider`:
   - `Mode.LOADING`: Initial setup and data fetching.
   - `Mode.PERMISSION`: Prompting the user for necessary permissions.
   - `Mode.TRIAGING`: The main iteration loop rendering the `PreviewPanel` and `CardActionMenu`.
   - `Mode.PICKER`: Triggered when the user invokes a bookmark or tab group action; renders an overlay (`BookmarkPickerPanel` or `TabGroupPickerPanel`).
   - `Mode.COMPLETE`: Reached when all tabs have been processed, revealing the `Dashboard`.

## The Action & Undo System

We need reliable `Command + Z` undo for operations like closing tabs, moving them to bookmark folders, or grouping them.

1. **Creating an Action**: A user hits a hotkey (handled by `useKeyboard.js`) or clicks a UI button.
2. **Execution (`useTriageActions.js`)**: The relevant action callback (`close`, `keep`, `bookmark`, `group`) executes the actual Chrome extension API calls (e.g., `chrome.tabs.remove`, `chrome.bookmarks.create`).
3. **Queue Patching (`globalChromeUndoStack`)**: Every action pushes a thunk onto a globally maintained undo stack. When `undo()` is executed, it runs the reverse operation. If an action recreates a tab (e.g., undoing a close operation via `chrome.sessions.restore`), the undo thunk explicitly patches the central React state queue (`state.tabs[i].id`) with the new Chrome Tab ID, ensuring subsequent actions target the correct resurrected tab.

## Asynchronous Chrome Quirks

### 1. Tab Preview Screenshots (`capture.js`)
Taking a `captureVisibleTab` on anything other than the exact active tab causes security issues in Chrome MV3.
- To bypass this, we use the `chrome.debugger` API.
- Tabbit attaches the debugger to the background tab, issues a `Page.captureScreenshot` command, and detaches, entirely avoiding the active-tab restrictions.
- This logic is executed in the `background.js` worker, and the React app communicates with it via `chrome.runtime.sendMessage({ type: "captureTab" })`.
- URLs starting with `chrome://`, `edge://`, or `chrome-extension://` are explicitly skipped, as Chrome forcibly prevents debugger attachment to internal pages.

### 2. Context Isolation
The application cleanly separates logic into multiple Context Providers:
- `TriageProvider`: Owns the tab queue, the current cursor index, and the core mode.
- `PickerProvider`: Encapsulates the visibility and registration of overlay panels.
- `HotkeysProvider`: Manages configurable user keybindings.
- `MonitorProvider`: Manages the scrolling log and retro-monitor display state.
