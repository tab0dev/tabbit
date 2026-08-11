# Tabbit Data Model

Tabbit's data architecture is distributed across three primary domains: the ephemeral React Context state, the persistent Chrome Extension Storage (which acts as a bridge between the UI and background workers), and local browser storage.

## 1. The Global React State (`Contexts`)

The core state driving the Tabbit interface lives inside React Contexts, primarily the `TriageProvider` and `TabProcessingProvider`.

### `TriageProvider`
This is the heart of the application, holding the actual, living array of tabs.

```javascript
export const Mode = {
  LOADING: 'LOADING',     // Initial data fetch
  PERMISSION: 'PERMISSION', // Waiting for user to grant permissions
  TRIAGING: 'TRIAGING',   // Main deck view
  PICKER: 'PICKER',       // Overlay active (bookmarks/groups)
  COMPLETE: 'COMPLETE'    // Done state / Dashboard
};

// Shape of the global state housed in TriageProvider
const initialState = {
  mode: Mode.LOADING,
  tabs: [],                // Array of QueueEntry objects
  currentIndex: 0,         // Pointer to the active tab in the deck
  selfTabId: null,         // ID of the Tabbit triage tab
  windows: new Map(),      // WindowID -> Window configuration details
  bookmarkFolders: [],     // Pre-fetched flattened array of bookmark folders
  bookmarkTree: [],        // Raw nested bookmark tree
  tabGroups: [],           // Pre-fetched array of existing Chrome tab groups
  // ...other fields like picker state
};
```

### The `QueueEntry` Schema
When a tab is queried from Chrome upon initialization, it is flattened into our standardized `QueueEntry` schema:

```javascript
/**
 * @typedef {Object} QueueEntry
 * @property {number} id - Chrome Tab ID (mutable: patched during undos/reincarnations)
 * @property {number} windowId - The host window ID
 * @property {number} groupId - The Chrome Tab Group ID (-1 if none)
 * @property {number} index - Original ordering index within the window
 * @property {string} title - The web page `document.title` (or '(Untitled)')
 * @property {string} url - The URL (e.g. 'https://github.com' or 'chrome://extensions/')
 * @property {string} favIconUrl - Link to the website's favicon
 * @property {boolean} pinned - Chrome pinned status
 * @property {boolean} processed - Has the user made a triage decision on this tab?
 * @property {boolean} gone - Was the tab closed externally via browser UI? (The engine will skip it)
 * @property {string|null} action - The string tag of the triage decision ('keep', 'close', 'bookmark', 'group')
 */
```

### `TabProcessingProvider`
Rather than mutating the core `tabs` array in `TriageProvider`, sorting and filtering logic is handled dynamically by the `TabProcessingProvider`. This applies transformations (like sorting by URL or Title, or filtering out suspended tabs) to create a derived view for the UI.

## 2. Persistent Extension Storage (`chrome.storage.local`)

Because MV3 Service Workers (`background.js`) are ephemeral and sleep frequently, any state that the background daemons rely on must live in `chrome.storage.local`. This storage layer acts as the vital bridge between the React settings UI and the headless engine.

### Autonomous Tool Data
- **Auto-Grouper:** 
  - `tabbit_autogrouper_settings`: Stores enablement toggles.
  - `tabbit_autogrouper_rules`: Stores the array of rule objects (Regex/Domain matchers and target group names).
- **Auto-Closer:**
  - `tabbit_auto_close_settings`: Stores enablement and the TTL threshold (e.g., close after 7 days).
  - **Tab Graveyard**: An array of objects tracking tabs closed by the Auto-Closer, storing original URLs, titles, and deletion timestamps so users can restore them.
- **Auto-Sorter & Auto-Smusher:**
  - `tabbit_auto_sorter_settings` and `tabbit_smush_settings`: Stores basic enablement and configuration flags.

### Storage Mirrors
Some settings (like `tabbit_excludeSuspendedTabs`) are natively handled by the React app and stored in `window.localStorage`. However, the background worker cannot read `localStorage`. To solve this, the React app explicitly syncs these values into `chrome.storage.local` under mirrored keys (e.g., `tabbit_excludeSuspendedTabs_remote`) so the background worker can read them on boot.

## 3. Local UI Preferences (`window.localStorage`)

Settings that only affect the immediate UI and don't require Service Worker knowledge are kept locally in the window:
- **Hotkeys**: The serialized key mapping.
- **Theming**: Dark/Light mode preferences and the CRT Retro Monitor effect toggle.
- **Tutorials**: Dismissal flags for onboarding components.

## 4. Cold Storage (File System Exports)

The Bookmark Manager allows users to export bookmark folders directly to their local hard drive via the File System Access API. 
The output is a standardized, nested JSON tree schema:
```json
{
  "title": "Folder Name",
  "children": [
    {
      "title": "Link Title",
      "url": "https://example.com"
    },
    {
      "title": "Subfolder",
      "children": [...]
    }
  ]
}
```
When restored, the engine reads this JSON file and recursively rebuilds the Chrome Bookmark tree.

## 5. The Mutable Undo Stack (`globalChromeUndoStack`)

Because Tabbit's primary function is a continuous stack of irreversible browser interactions, we maintain a standalone, globally mutable undo stack outside of React state. 

This array houses closures (thunks) generated by `useTriageActions.js`. If the user presses `Cmd+Z`, the stack pops the last thunk and executes it. 

### The Resurrection Problem
If a reversed action requires restoring a previously closed tab (via `chrome.sessions.restore`), Chrome generates an entirely **new** Tab ID. The undo thunk dynamically reaches back into the `TriageProvider` state dispatch and explicitly patches the old ID with the new resurrected ID. This guarantees that if the user reverses direction again (or bulk-selects the tab in List View), the UI still points to the correct, living Chrome tab.
