# Auto Tab Sorter: Technical Implementation

The Tab Sorter is a utility integrated into Tabbit that allows users to instantly organize their browser by sorting all open tabs alphabetically by Title or URL, available in-app or via right-click menu. Theres an optional **Auto Sorter daemon** that keeps tabs in sorted order continuously — re-sorting the moment any new tab is opened or navigates to a new URL. Users can choose between auto sorting, and manually sorting when desired.

The feature is exposed in three ways:
1. **Auto Sorter panel** (`AutoSorterPanel` at `src/components/Tools/AutoSorter/AutoSorterPanel.jsx`) — configure the daemon and toggle continuous sorting on or off.
2. **"Sort now" button** in the panel preview — triggers an immediate one-off sort without saving settings.
3. **Right-click context menu** — "Sort all tabs by title" / "Sort all tabs by URL" for on-demand, ad-hoc sorting. These items are automatically hidden when the Auto Sorter daemon is enabled (a manual one-off sort would be immediately undone by the next tab event anyway).

---

## Core Sort Engine (`runTabSorter`)

Because sorting requires querying, moving, and grouping all tabs in the active window, the core logic lives entirely in `public/background.js`. The UI sends `chrome.runtime.sendMessage({ type: 'sortTabs' })` to trigger it on demand; the daemon calls it directly.

### Execution Flow

When `runTabSorter()` executes, it performs the following steps:

1. **Read Settings**: Retrieves the user's persistent preferences from `chrome.storage.local` (`tabbit_tabsorter_settings`) — sort by URL vs. Title, include pinned tabs, cluster suspended tabs, and the `autoSortEnabled` flag.

2. **Handle Pinned Tabs**: If `sortPinnedTabs` is enabled, pinned tabs are sorted first using the same comparator as the rest. Pinned tabs always remain pinned and anchored at the front of the window.

3. **Handle Named Tab Groups**: Tabbit respects the user's existing group structure. It first sorts the Tab Groups themselves alphabetically by name (`tabGroups.sort` by `title`). It then iterates into each group, queries the tabs within it, and sorts them in place using `sortTabsList`. Console logs identify each pass by group name: `[TabSorter] Before sort — 'Work' tab group (id 12)`.

4. **Handle Ungrouped Tabs**: All remaining ungrouped, non-pinned tabs are collected and sorted last: `[TabSorter] Before sort — ungrouped tabs`.

### `sortTabsList(tabs, groupId, settings, label)`

The shared comparator function. Called for each distinct segment of tabs (pinned, each named group, ungrouped). It:
- Reads the `firstTabIndex` from `tabs[0]` to preserve the segment's starting position in the window.
- Sorts the tab array in-place using either `title.localeCompare` or `compareByUrlComponents`.
- Calls `chrome.tabs.move(tabIds, { index: firstTabIndex })` to reposition all tabs at once.
- If sorting into a named group, follows with `chrome.tabs.group({ groupId, tabIds })` to ensure Chrome keeps the tabs correctly associated.

---

## Auto Sorter Daemon

### Initialization

On extension install and browser startup, `setupSortKeepalive()` reads `tabbit_tabsorter_settings` from `chrome.storage.local`, syncs the context menu visibility, and creates the keepalive alarm if AutoSorter is enabled.

### Reliability Architecture (Three Layers)

Chrome MV3 service workers are aggressively suspended after ~30 seconds of idle time. When the SW wakes up, all in-memory JavaScript variables reset to their initialization values. An older implementation used an in-memory `autoSort_enabled` flag — but that flag would always be `false` on SW wakeup, silently breaking the daemon until the next alarm fired.

The current implementation uses three layers to guarantee sorting always works:

#### Layer 1 — Storage-Read Fix (primary fix)

`runAutoSort()` reads `autoSortEnabled` directly from `chrome.storage.local` on every invocation instead of checking an in-memory flag. Chrome's in-process storage cache makes this effectively instant (<1ms). This means every tab event correctly checks the persisted truth regardless of whether the SW was just resumed from suspension:

```js
async function runAutoSort() {
  const raw = await chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY);
  if (!raw[TAB_SORTER_SETTINGS_KEY]?.autoSortEnabled) return;
  // debounce + sort...
}
```

#### Layer 2 — `chrome.idle` Catch-Up (user returns)

`chrome.idle.onStateChanged` fires whenever the OS transitions between `"active"`, `"idle"`, and `"locked"`. The `idle → active` transition fires the moment the user touches their mouse or keyboard after ≥60 seconds of inactivity. This wakes the SW and immediately runs a catch-up sort — correcting any tabs that may have been missed while the browser was dormant:

```js
chrome.idle.setDetectionInterval(60);

chrome.idle.onStateChanged.addListener((newState) => {
  if (newState !== 'active') return;
  chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY).then((raw) => {
    if (raw[TAB_SORTER_SETTINGS_KEY]?.autoSortEnabled) {
      runTabSorter();
    }
  });
});
```

#### Layer 3 — 1-Minute Keepalive Alarm (safety net)

A `chrome.alarms` periodic alarm (`tabbit-auto-sort-keepalive`) fires every minute while AutoSorter is enabled. It reads settings from storage and runs a catch-up sort. This is a pure safety net — it is never shown to the user and has no configurable interval. The alarm is created by `setupSortKeepalive()` when AutoSorter is enabled and cleared when it is disabled.

| Listener | Fires when | Role |
|---|---|---|
| `chrome.tabs.onCreated` | A new tab is opened | Real-time sort (Layer 1 ensures correct state) |
| `chrome.tabs.onUpdated` | A tab navigates to a new URL | Real-time sort |
| `chrome.tabs.onMoved` | A user manually drags a tab | Enforcement — no URL event fires on drag |
| `chrome.tabs.onAttached` | A tab is dragged from another window | Prevents landing at an arbitrary index |
| `chrome.idle.onStateChanged` | User returns after ≥60s inactivity | Catch-up sort on resume |
| `tabbit-auto-sort-keepalive` alarm | Every 1 minute while enabled | Belt-and-suspenders safety net |

### Debouncing (`runAutoSort`)

Tab events arrive in bursts. `runAutoSort()` uses a 500 ms trailing debounce to collapse rapid sequences (session restore, opening multiple links) into a single sort pass:

```js
async function runAutoSort() {
  const raw = await chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY);
  if (!raw[TAB_SORTER_SETTINGS_KEY]?.autoSortEnabled) return;
  if (autoSort_debounceTimer) clearTimeout(autoSort_debounceTimer);
  autoSort_debounceTimer = setTimeout(() => {
    autoSort_debounceTimer = null;
    runTabSorter().catch((err) => console.warn('[AutoSorter] runTabSorter error:', err));
  }, 500);
}
```

### `setupSortKeepalive()`

Replaces the older `initAutoSorter()` (which is now just an alias). Called on install, startup, and whenever `TAB_SORTER_SETTINGS_KEY` changes in storage. Responsibilities:

1. Read settings from storage
2. Call `setSortMenuVisibility(!enabled)` to sync context menu state
3. Clear any existing `tabbit-auto-sort-keepalive` alarm
4. If enabled: create the alarm and run an immediate `runTabSorter()`

### Window Scoping

`runTabSorter()` calls `chrome.windows.getLastFocused()` and operates exclusively on that window. Sorting tabs across all open windows simultaneously would be disorienting — the user is only looking at one window at a time. Each window maintains its own independent sorted order.

### UI Synchronization

The Auto Sorter follows the same unidirectional storage pattern as all other Tabbit daemons:

1. The `AutoSorterPanel` React UI writes settings to `chrome.storage.local`.
2. The `chrome.storage.onChanged` listener in the SW calls `setupSortKeepalive()`, which handles menu visibility, alarm lifecycle, and an immediate sort if transitioning from disabled → enabled.



---

## Suspended Tab Parsing

Tab suspender extensions (like Tiny Suspender) redirect a tab's URL to a local `chrome-extension://…` page, encoding the real URL as a URI-encoded query param. If Tabbit sorted by raw URL, all suspended tabs would cluster together under `chrome-extension://` rather than their actual domain.

Two helpers in the engine handle this:

- **`isSuspended(tab, extensionId)`** — checks whether `tab.url` starts with the suspender's known prefix (`chrome-extension://${extensionId}/suspended.html#`).
- **`tabToUrl(tab, groupSuspendedTabs, extensionId)`** — if the tab is suspended and `groupSuspendedTabs` is `false`, extracts the original URL from the `uri` query param and returns a `URL` object pointing at the real site. If `groupSuspendedTabs` is `true`, returns the raw suspender URL so that suspended tabs sort as a cluster.

The sort comparator (`compareByUrlComponents`) then strips the leading `www.` and uses `hostname + pathname + search + hash` for the alphabetic key — ensuring a suspended GitHub tab sorts identically alongside an active GitHub tab.

| `groupSuspendedTabs` | Suspended tab sorts as |
|---|---|
| `false` (default) | Its real URL — intermixed with active tabs of the same domain |
| `true` | Its suspender URL — clustered together at the left of each segment |

The **Cluster suspended tabs** setting and the **Suspender extension ID** field in the panel are only shown when **Sort By** is set to **URL** — they have no effect on title-based sorting and are hidden to avoid confusion.

---

## Settings

| Setting | Default | Effect |
|---|---|---|
| **Auto sort enabled** | `false` | Activates the real-time daemon |
| **Sort by** | `url` | `url` — alphabetical by domain + path; `title` — alphabetical by page title |
| **Sort pinned tabs** | `false` | When off, pinned tabs stay anchored in place and are excluded from sorting |
| **Cluster suspended tabs** | `false` | Groups suspended tabs at the left of each sorted segment *(URL sort only)* |
| **Suspender extension ID** | Tiny Suspender ID | 32-char Chrome extension ID of the suspender in use *(visible when clustering is on)* |

---

## Hook Architecture (React side)

`src/hooks/useAutoSorter.js` exports two hooks that share `tabbit_tabsorter_settings` with the legacy `TabSorterCard`:

- **`useAutoSorterStatus()`** — lightweight enabled boolean, used by `CardActionMenu` to colour the `ListNumbers` icon and change the label to "Auto sorter" when the daemon is active. Subscribes to `chrome.storage.onChanged` for live updates.
- **`useAutoSorter()`** — full settings hook used by `AutoSorterPanel`. Handles optimistic updates and rollback on write failure. The extended schema (`autoSortEnabled: false`) is backwards-compatible — existing users with saved sort preferences retain them on first upgrade.

---

## Attribution

The sort URL comparison logic (`compareByUrlComponents`, `tabToUrl`) is inspired by [Simple Tab Sorter](https://chromewebstore.google.com/detail/simple-tab-sorter/cgfpgnepljlgenjclbekbjdlgcodfmjp) by Peter White.
