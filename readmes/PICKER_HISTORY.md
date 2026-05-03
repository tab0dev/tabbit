# Picker Panel Intelligence — Architecture Notes

> **Scope:** bookmark and tab-group picker panels in `PickerPanel.jsx`.  
> **Intent:** surfaces the most contextually useful folders/groups at the top of the picker list so the user rarely needs to scroll or search.

---

## The User Problem

The picker shows every bookmark folder or tab group in a flat list. Once a user has dozens of folders, finding the right one becomes friction. Two signals dramatically reduce that friction:

1. **What did I use most recently?** — The user often files consecutive tabs into the same folder. Showing the last 5 choices at the top means one keystroke for the common case.
2. **What does this domain usually go into?** — If a user always puts YouTube links into "Videos", the app should surface "Videos" automatically whenever a YouTube tab is being triaged, even across sessions.

---

## Three-Layer Architecture

```
PickerPanel.jsx          (React component — UI and user interaction)
       │
       │  calls on confirm:  recordUsage(type, item, tabUrl)
       │  reads via:         usePickerSuggestions(...)
       ▼
usePickerSuggestions.js  (React hook — derives + filters sectioned list)
       │
       │  calls:  getRecent(type)
       │          getRecommendedIds(type, url)
       │          (after write) invalidate() → bumps revision → re-runs useMemo
       ▼
pickerHistoryService.js  (pure JS service — localStorage read/write)
       │
       ▼
localStorage              (persists across sessions, scoped by picker type)
```

Each layer has exactly one job:

| Layer | File | Job |
|---|---|---|
| **Persistence** | `pickerHistoryService.js` | Read/write localStorage. No React. No rendering. |
| **Derivation** | `usePickerSuggestions.js` | Turn raw items + history into a sectioned list. No DOM. |
| **Rendering** | `PickerPanel.jsx` | Consume the sectioned list and drive the UI. No storage logic. |

This separation means you can change the recommendation algorithm without touching the UI, or change the storage backend (e.g. move to `chrome.storage.local` for cross-device sync) without touching React.

---

## Storage Layer — `pickerHistoryService.js`

### localStorage Keys

All keys are namespaced to avoid collisions with other extensions or the page:

| Key | Contents |
|---|---|
| `t0:picker:recent:bookmark` | Recently used bookmark folders |
| `t0:picker:recent:group` | Recently used tab groups |
| `t0:picker:domainMap:bookmark` | Domain → folder ID mappings |
| `t0:picker:domainMap:group` | Domain → group ID mappings |

Bookmark and group history are **completely independent stores**, so they can evolve at different rates and the user's bookmark habits don't pollute tab group recommendations.

### Recent List Shape

```json
[
  { "id": "42", "title": "Videos", "path": "Bookmarks / Videos", "usedAt": 1711234567890 },
  { "id": "17", "title": "Dev Links", "path": "Bookmarks / Work / Dev Links", "usedAt": 1711234500000 }
]
```

- Max 5 entries, newest-first.
- `path` is only present for bookmark folders (the full breadcrumb path), `color` is only present for tab groups.
- Deduplication: if the same folder is chosen twice, it moves to position 0 rather than appearing twice.
- The service stores a **snapshot** of the item's metadata at time of use. This means the label shown in "Recently Used" is always the name as it was when the user chose it — if the folder is renamed or deleted in Chrome, the item simply won't hydrate (it'll be filtered out at derivation time because it won't be in `rawItems`).

### Domain Map Shape

```json
{
  "youtube.com":   [{ "id": "42", "usedAt": 1711234567890 }, { "id": "99", "usedAt": 1711000000000 }],
  "github.com":    [{ "id": "17", "usedAt": 1711100000000 }],
  "wikipedia.org": [{ "id": "23", "usedAt": 1710900000000 }]
}
```

- `www.` is stripped before storage so `www.youtube.com` and `youtube.com` map to the same key.
- Up to **3 folder IDs** per domain, sorted by most-recent-use. This is why Recommended can show up to 3 items — one per previously-used folder for that domain.
- If you file two different YouTube links into two different folders, both appear in `youtube.com`'s array. The most recently used one is first.
- Last-write-wins within each slot: if you put a YouTube link into "Videos" again, "Videos" refreshes to position 0 (its `usedAt` updates, it doesn't duplicate).

### `recordUsage(type, item, tabUrl)` — The Write Trigger

This is the **only** function that writes to storage. It is called exactly once per confirmed picker selection, inside `PickerPanel.confirm()`. It does two things atomically:

1. Prepends the chosen item to the recent list (deduped, capped at 5).
2. Upserts the item's ID into the domain map for the tab's base domain.

Nothing else in the app writes to storage. No background jobs, no timers.

---

## Derivation Layer — `usePickerSuggestions.js`

### Inputs

| Param | Source in PickerPanel |
|---|---|
| `type` | `'bookmark'` or `'group'` prop |
| `rawItems` | `state.bookmarkFolders` or `state.tabGroups` from Chrome API (via TriageProvider) |
| `currentTabUrl` | `state.tabs[state.currentIndex]?.url` |
| `query` | Local search input state |
| `matchFn` | Stable reference to `matchItem()`, a fuzzy string matcher |

### Outputs

```js
{
  sections: [
    { key: 'recommended', label: 'Recommended', items: [...], showHeader: true },
    { key: 'recent',      label: 'Recently Used', items: [...], showHeader: true },
    { key: 'all',         label: 'All',            items: [...], showHeader: true },
  ],
  flatItems: [...],  // all section items concatenated — used for selectedIndex
  invalidate: fn,    // call after recordUsage to force re-read from localStorage
}
```

### Deduplication Priority (important)

**Recommended is built first, and wins any tie.** If a folder appears in both the domain map and the recent list, it goes into Recommended and is excluded from Recently Used. The priority order is:

```
Recommended → Recently Used → All
```

This was a deliberate product decision: if the app has a domain-level signal, that's more contextually useful than recency alone, so it deserves the top slot.

### The `revision` Counter / `invalidate()` Pattern

`usePickerSuggestions` uses `useMemo` to compute sections, which React only re-runs when its dependency array changes. But `localStorage` is external to React — writing to it doesn't trigger a re-render on its own.

The solution: the hook holds a `revision` counter in state. `invalidate()` increments it, which causes the `useMemo` to re-run and re-read from localStorage. `PickerPanel` calls `invalidate()` immediately after `recordUsage()`, so the sections update in the same render cycle as the confirm action.

```
User confirms folder → recordUsage() writes to localStorage → invalidate() → revision++ → useMemo re-runs → sections update
```

### Section Visibility Rules

- Sections with 0 items after fuzzy filtering are hidden entirely.
- If only the "All" section has items (no history yet, or no domain match), section headers are **not rendered** — the list looks identical to the original flat list.
- Headers appear only when there's something meaningful to label (at least one of Recommended or Recently Used is non-empty).

### `flatItems` and Keyboard Navigation

The picker uses a single integer `selectedIndex` for keyboard navigation. `flatItems` is the concatenation of all active section items in order — so index 0 is the first item in the first non-empty section, index 1 is the second, etc. Section header `<li>` elements are not in `flatItems` and are therefore skipped by arrow-key navigation automatically.

---

## Rendering Layer — `PickerPanel.jsx`

The component no longer manages filtering or ordering directly. It:

1. Passes `(type, rawItems, currentTabUrl, query, matchFn)` into `usePickerSuggestions`.
2. Iterates `sections` to render section headers + items, using a `runningIndex` counter to map each item to its global position in `flatItems`.
3. On confirm, calls `recordUsage(type, targetItem, currentTabUrl)` then `invalidate()`.

The `matchFn` is defined at module level (`matchItem`) and wrapped in `useMemo(() => matchItem, [])` inside the component to give it a stable reference — this prevents the hook's `useMemo` from re-running on every render due to a new function reference.

---

## Extending This System

### Change the max caps
`MAX_RECENT` and `MAX_DOMAIN_ENTRIES` are constants at the top of `pickerHistoryService.js`. Change them there and the rest of the system adapts automatically.

### Change the recommendation algorithm
Only `getRecommendedIds()` and `upsertDomainMapping()` in `pickerHistoryService.js` need to change. The hook and component are unaffected.

### Change section ordering or visibility rules
Only `usePickerSuggestions.js` (the `sectionDefs` array and the `shouldShowHeaders` check) needs to change.

### Add a new section (e.g. "Pinned Folders")
1. Add the derivation logic in `usePickerSuggestions.js` (new section in `sectionDefs`).
2. Exclude its IDs from `shownIds` to maintain global deduplication.
3. The component renders it automatically — no changes to `PickerPanel.jsx`.

### Move to `chrome.storage.local`
Replace `readJSON`/`writeJSON` in `pickerHistoryService.js`. Because those are the only functions that touch storage, this is a contained change. Note that `chrome.storage.local` is async, which would require making `getRecent` and `getRecommendedIds` async and updating the hook accordingly.
