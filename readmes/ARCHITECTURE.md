# Architecture and Design

Tabbit is structured as a modern React Single-Page Application (SPA) running in a dedicated Chrome extension tab (`index.html`), backed by a Chrome MV3 Service Worker (`background.js`) and isolated content scripts for specific web automation.

## 1. High-Level Topology

- **The View (React SPA):** A multi-tool interface running in `index.html`. It acts as the central dashboard where users interact with the Triage Stack, List View, Bookmark Manager, and configure background tools. All UI rendering and user interactions are handled here.
- **The Engine (Background Service Worker):** The MV3 `background.js` worker. It runs headless background daemons (like auto-closers and auto-groupers) and handles privileged extension API calls (like fetching tabs, moving them, or capturing screenshots) that the React SPA requests.
- **The Content Scripts:** Targeted scripts like `watchLaterAutomation.js`, which are injected into specific tabs (e.g., YouTube) to perform localized DOM manipulation that neither the background worker nor the SPA can do directly.

## 2. State & Context Isolation

The application cleanly separates logic into multiple isolated Context Providers, found in `src/store/`:

- **`TriageProvider`**: The core state machine for the Triage deck. It owns the in-memory tab queue, the current cursor index, and the core routing modes (e.g., `LOADING`, `TRIAGING`, `COMPLETE`).
- **`TabProcessingProvider`**: Manages the tab filtering and sorting logic pipeline, separating the display logic from the core Triage queue.
- **`PickerProvider`**: Encapsulates the visibility and data registration for overlay panels like the Bookmark Picker or Tab Group Picker.
- **`HotkeysProvider`**: Bootstraps and manages customizable user keybindings.
- **`ThemeProvider`**: Manages the global dark/light mode state.
- **`CRTEffectProvider`**: Toggles the CRT retro monitor visual effect.
- **`TimerProvider`**: Manages the elapsed time metrics during a triage session.
- **`MonitorProvider`**: Manages the scrolling log and retro-monitor display state.

## 3. Background Workers (The Daemons)

The `background.js` Service Worker houses several complex autonomous daemons that keep the browser organized without user intervention:

- **Auto-Closer:** Uses the `chrome.alarms` API to periodically poll tab ages and enforce a Time-To-Live (TTL) threshold, silently closing tabs that haven't been visited in a configured number of days.
- **Auto-Smusher:** A real-time duplicate closure engine. It listens to `chrome.tabs.onCreated` and `chrome.tabs.onUpdated`, instantly closing new duplicate tabs and refocusing the user on the original existing tab.
- **Auto-Grouper:** A real-time clustering engine. Driven by `chrome.tabs.onUpdated` and `chrome.tabs.onCreated`, it matches incoming URLs against user-defined regex or domain rules and automatically moves tabs into designated Chrome Tab Groups.
- **Auto-Sorter:** A background reordering logic engine. It listens to tab creation and updates to ensure tabs remain strictly sorted alphabetically by title or URL. It relies on `chrome.alarms` keepalives and `idle` API wakeups to fight Service Worker suspension and maintain state.

## 4. The Action & Undo System

Tabbit provides reliable `Command + Z` undo for operations across the entire app (Triage Stack, List View, Bookmark Cleaner).

1. **Creating an Action**: A user hits a hotkey (handled by `useKeyboard.js`) or clicks a UI button in one of the tools.
2. **Execution (`useTriageActions.js`)**: The relevant callback executes the actual Chrome extension API calls (e.g., `chrome.tabs.remove`, `chrome.bookmarks.create`).
3. **Queue Patching (`globalChromeUndoStack`)**: Every action pushes a thunk onto a globally maintained undo stack. When `undo()` is executed, it runs the reverse operation. Crucially, if an action resurrects a tab (e.g., undoing a close operation via `chrome.sessions.restore`), the undo thunk explicitly patches the central React state queue (`state.tabs[i].id`) with the new, freshly generated Chrome Tab ID. This ensures that any subsequent actions target the correct resurrected tab. This system scales from single-tab triage actions to bulk operations in the List View.

## 5. On-Device AI Integration

Tabbit leverages Chrome's built-in Gemini Nano model for intent-based, context-aware tab grouping without sending data to the cloud.

- **`aiGroupingService.js`**: This service acts as the bridge to the native AI. It interfaces with `window.ai` (or `chrome.aiOriginTrial`) to submit batches of tab titles and URLs.
- **Zero-Latency & Privacy**: Because the model runs entirely on-device, grouping happens near-instantly and securely.
- **Safe Fallbacks**: If the Gemini Nano model is unavailable, disabled, or still downloading, the service gracefully falls back or prompts the user, preventing application crashes.

## 6. Asynchronous Chrome Quirks (The Weird Stuff)

### Tab Preview Screenshots (`capture.js`)
Taking a `captureVisibleTab` on anything other than the exact active tab causes security issues in Chrome MV3.
- To bypass this, we use the `chrome.debugger` API.
- Tabbit attaches the debugger to the background tab, issues a `Page.captureScreenshot` command, and detaches, entirely avoiding the active-tab restrictions.
- This logic is executed in the `background.js` worker, and the React app communicates with it via `chrome.runtime.sendMessage({ type: "captureTab" })`.
- URLs starting with `chrome://`, `edge://`, or `chrome-extension://` are explicitly skipped, as Chrome forcibly prevents debugger attachment to internal pages.

### Service Worker Wake-ups & `idle`
The Chrome MV3 Service Worker aggressively suspends itself to save memory.
- To keep continuous background tasks (like the Auto-Sorter) from falling behind, Tabbit uses a combination of silent `chrome.alarms` keepalives.
- More importantly, it uses the `chrome.idle` API as a wake-up trigger. When a user returns to their machine after being idle, the `idle` state change fires, waking the Service Worker and allowing daemons like the Auto-Sorter to catch up on any tabs that were modified or restored while the worker was asleep.
