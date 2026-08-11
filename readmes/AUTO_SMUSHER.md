# Auto Smusher: Technical Implementation

The Auto Smusher is a background daemon that detects and eliminates duplicate tabs in real time — the moment you open a URL that's already open, the duplicate is instantly closed and focus returns to the original copy, keeping your session clean without any manual intervention.

A right-click context menu action ("Smush tabs") also exists for on-demand batch deduplication. Both entry points share the same core processing engine. When the daemon is **enabled**, the "Smush tabs" menu item is automatically hidden — a manual batch smush would be redundant since the daemon is already handling deduplication continuously.

## How it Works

Like all Tabbit automation features, the Auto Smusher operates entirely inside the Chrome MV3 Service Worker (`public/background.js`). Because Chrome MV3 Service Workers are aggressively suspended when idle, the daemon uses event-driven hooks — `chrome.tabs.onCreated` and `chrome.tabs.onUpdated` — rather than polling, so it wakes only when a new tab actually appears.

### Initialization

On extension install and browser startup, `initAutoSmusher()` reads the persisted settings from `chrome.storage.local` (`tabbit_autosmush_settings`) and populates four in-memory flags:

```js
let smush_enabled          = false;
let smush_skipPinned       = true;
let smush_ignoreFragments  = false;
let smush_ignoreQueryStrings = false;
```

These flags are kept live via the existing `chrome.storage.onChanged` listener — when the user saves settings in the UI, the daemon updates its flags instantly with no restart required.

### URL Normalisation (`smushNormaliseUrl`)

Before any comparison, every URL is passed through `smushNormaliseUrl()`, which:

1. Parses the raw URL with the `URL` constructor.
2. **Decodes suspended tabs**: If the URL is a tab-suspender URL (e.g., from Tiny Suspender), the real target URL is encoded in a `?url=` query parameter. The normaliser extracts and decodes it, so suspended tabs are correctly deduplicated against their live equivalents.
3. Applies user preferences:
   - If `ignoreQueryStrings` is set, strips `?query=params` before comparing.
   - If `ignoreFragments` is set, strips `#anchor` before comparing.

### Shared Group Builder (`smushBuildGroups`)

`smushBuildGroups(tabs)` is the shared core of both the daemon and the right-click batch action. Given a list of tab objects, it returns a `Map<normUrl, tab[]>` containing only groups with two or more tabs — i.e., only actual duplicates. Internally it:

1. Skips any tab with no URL or a `chrome://` URL.
2. Skips pinned tabs when `smush_skipPinned` is enabled.
3. Normalises each URL via `smushNormaliseUrl`.
4. Groups tabs by normalised URL and discards singleton groups.

Tabs within each group are ordered by their position in the `chrome.tabs.query` response — effectively oldest first. The oldest tab is always kept; all subsequent tabs in the group are duplicates to be closed.

### Real-Time Daemon (`smushNewTab`)

Called from both `chrome.tabs.onCreated` and `chrome.tabs.onUpdated`. The `onUpdated` hook is necessary because tabs opened via the address bar often fire `onCreated` with an empty URL, only resolving to a real URL on the first `onUpdated` event. A `smush_processedTabIds` Set prevents double-firing across both events for the same tab.

When a new tab is intercepted:

1. If `smush_enabled` is `false`, returns immediately.
2. Skips chrome:// URLs and the new tab page.
3. If the tab itself is pinned and `smush_skipPinned` is set, skips it.
4. Normalises the incoming URL via `smushNormaliseUrl`.
5. Queries all tabs and finds the first existing tab that shares the same normalised URL (and is not pinned, if `smush_skipPinned` is set).
6. If a match is found:
   - Closes the newly-created duplicate tab via `chrome.tabs.remove`.
   - Focuses the original tab's window via `chrome.windows.update`.
   - Activates the original tab via `chrome.tabs.update`.
7. Cleans up the tab ID from `smush_processedTabIds` after 2 seconds.

### Batch Smush (`runSmushDuplicates`)

Triggered by the right-click context menu action ("Smush tabs"). Calls `smushBuildGroups` over all open tabs, then closes every tab except `tabs[0]` (oldest) in each duplicate group. Respects the same `smush_skipPinned`, `ignoreFragments`, and `ignoreQueryStrings` settings as the daemon — the right-click action is never more or less aggressive than the user's configured preferences.

## Settings

| Setting | Default | Effect |
|---|---|---|
| **Enabled** | `false` | Activates the real-time daemon |
| **Skip pinned tabs** | `true` | Pinned tabs are excluded from both sides of duplicate detection — they'll never be closed and won't act as the "original" to redirect to |
| **Ignore URL fragments** | `false` | Strips `#anchor` before comparing; treats `/page#intro` and `/page#conclusion` as the same URL |
| **Ignore query strings** | `false` | Strips `?query=params` before comparing; useful when tracking params or sort orders produce spurious duplicates |

## Architecture & Integration

### UI Synchronization

The Auto Smusher follows the same unidirectional data flow as all other Tabbit automation features:

1. The `AutoSmusherPanel` React UI maintains local form state (staged changes).
2. On **Save & Apply**, it writes the merged settings to `chrome.storage.local`.
3. The `chrome.storage.onChanged` listener in the service worker receives the change, updates the four in-memory flags immediately, and calls `setSmushMenuVisibility`.

No message passing, no shared workers, no coordination overhead.

### Context Menu Visibility (`setSmushMenuVisibility`)

```js
function setSmushMenuVisibility(visible) {
  chrome.contextMenus.update('tabbit-smush-duplicates', { visible }).catch(() => {});
}
```

Called from both `storage.onChanged` (live toggle) and `initAutoSmusher()` (startup sync). Hides the "Smush tabs" right-click item when the daemon is running; restores it when the daemon is disabled. The `.catch(() => {})` silently absorbs the startup race where `initAutoSmusher` runs before `contextMenus.create` completes.

### Hook Architecture (React side)

Three exports in `src/hooks/useAutoSmusher.js` keep the React layer clean:

- **`useAutoSmusherStatus()`** — lightweight hook used by `CardActionMenu` to colour the `NetworkSlash` icon when the smusher is active. Subscribes to `chrome.storage.onChanged` so the menu reflects the live state without a full panel render.
- **`useAutoSmusher()`** — full settings hook used by `AutoSmusherPanel`. Handles optimistic updates and rollback on write failure.
- **`useDuplicateTabs({ skipPinned, ignoreFragments, ignoreQueryStrings })`** — derives duplicate groups from the Triage state using the same `normaliseSmushUrl` logic as the service worker. Powers the live preview in the panel — the user can see which tabs would be smushed before saving.

```js
export function normaliseSmushUrl(rawUrl, { ignoreFragments, ignoreQueryStrings })
export function useAutoSmusherStatus()
export function useAutoSmusher()
export function useDuplicateTabs(opts)
export async function closeSmushDuplicates(duplicateGroups)  // used by handleConfirm
```

### Apply on Save

After clicking **Save & Apply** with `enabled: true` and one or more duplicate groups visible in the live preview, a confirmation modal (`SmushConfirmModal`) is presented. The user can:

- **Close Duplicates Now** — calls `closeSmushDuplicates()` which removes all duplicate tab IDs in a single `chrome.tabs.remove` call, then focuses the first surviving original.
- **Skip** — saves the settings and closes the panel without touching any existing tabs. The daemon will still catch duplicates going forward.

The modal is a React portal (`createPortal` → `document.body`) so it renders above the card stack regardless of stacking context.

## Key Design Decisions

**Oldest tab always wins.** Chrome's `tabs.query` response preserves insertion order. `smushBuildGroups` keeps `tabs[0]` — the tab that was open longest — and closes all later duplicates. This preserves scroll position, form state, and any work in progress on the original.

**Daemon and batch action share one engine.** The `smushBuildGroups` helper was specifically extracted to ensure the right-click batch action is never inconsistent with the daemon. If you configure "Ignore query strings", both the daemon and the manual smush honour that preference identically.

**Manual smush hidden when daemon is active.** When the Auto Smusher is enabled, the "Smush tabs" context menu item is hidden. A manual batch smush while the daemon is running would be immediately redundant — the daemon catches every new duplicate within milliseconds of it opening. Showing the option would imply it does something lasting, when in practice it doesn't.

**Pinned tabs are fully excluded by default.** Pinned tabs are treated as "permanent" browser fixtures. The default is to ignore them on both sides of the comparison: a pinned tab will not be closed, and it will not be used as the "original" to redirect to either. This prevents surprises when a pinned tab and a regular tab happen to share a URL.
