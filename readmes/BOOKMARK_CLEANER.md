# Bookmark Cleaner: Technical Implementation

The Bookmark Cleaner is a panel for auditing and pruning Chrome bookmarks. **Browse mode** surfaces the full bookmark tree with activity heat-coloring, robust filtering (including Duplicate finding), and multi-select bulk actions. 

*(Note: A **Cold Storage** archive mode was designed and partially implemented to let users archive stale bookmarks to a local JSON file via the File System Access API. This feature is currently disabled/hidden from the UI while in development, so the panel operates exclusively in Browse mode.)*


---

## Architecture Overview

```
BookmarkManagerCard (orchestrator at src/components/Tools/BookmarkManager/BookmarkManagerCard.jsx)
├── useBookmarkData        — chrome.bookmarks snapshot + refresh
├── useArchive             — FileSystemFileHandle lifecycle, archive CRUD
│   └── archiveFileHandle  — IndexedDB persistence for the FSA handle
├── BrowsePanel            — tree/list display, selection, Archive/Remove actions
│   ├── useBookmarkSelection  — range select, folder-cascade, drag-select
│   └── BookmarkDragSelectLayer
└── ColdStoragePanel       — three-state archive UI (unlinked / needs permission / ready)
    ├── useBookmarkSelection  — reused directly; archive items keyed by Chrome ID
    ├── BookmarkDragSelectLayer  — reused unchanged (targets data-bookmark-id)
    ├── ArchivedGroupHeader   — synthetic folder headers per folderPath group
    └── ArchivedBookmarkRow  — extended with drag-select target + soft-select
```

`BookmarkManagerCard` is a thin orchestrator. It owns mode state (`browse` | `coldStorage`), wires the two hooks together, and coordinates the one action that needs both: the Browse-mode "Archive" button, which calls Chrome mutation helpers and then calls `handleAppend` from `useArchive` to write the result.

---

## Bookmark Data (`useBookmarkData`)

On mount, `useBookmarkData` calls `chrome.bookmarks.getTree()` and passes the result through `buildFullTree()`:

```js
const tree     = await chrome.bookmarks.getTree();
const rootNode = tree[0];                          // id '0' — synthetic root
return buildFullTree(rootNode.children ?? []);
```

`buildFullTree` (in `bookmarkUtils.js`) recursively annotates every node with derived fields and accumulates a `path` string:

```js
const newPath = path ? `${path} / ${n.title}` : n.title;
// e.g. "Bookmarks bar / Dev / My Link"
```

The `path` field is the source of truth for restore operations. It is stored in the archive alongside a separate `folderPath` field (the path without the leaf title) to avoid ambiguity when bookmark titles themselves contain ` / `.

`refreshTree` re-fetches the full tree and is called after every Chrome mutation so the UI stays in sync without a full reload.

---

## Sorting & Filtering

In Browse mode, the full tree is sorted before rendering. **Default on open: `manual` (Chrome's native index order).** Sort modes:

| Mode | Sort key |
|---|---|
| `manual` | Chrome's native index order (default) |
| `lastActivity` | `dateLastUsed ?? dateAdded` ascending — stalest first |
| `dateAdded` | `dateAdded` ascending |
| `title` | `localeCompare` |

`sortTree` applies the sort recursively so folder children at every depth level respect the mode.

Activity heat is computed via `getAgeColor(ms)` — a standalone utility that takes any raw timestamp and returns a CSS color variable:

```
< 30 days   → green
< 90 days   → yellow
< 180 days  → orange
≥ 180 days  → red
```

`getActivityColor(node)` delegates to `getAgeColor` using `dateLastUsed ?? dateAdded`. Folders show the heat color of their stalest leaf child.

A fuzzy search bar (powered by `uFuzzy`) filters leaves in real time by title and URL. Browse mode also provides a folder filter in the sidebar restricting the view to a specific root folder type (Bookmarks Bar / Other / Mobile).

The sidebar additionally exposes three independent filter dimensions — all of which compose (a leaf must pass every active filter to appear):

| Dimension | State key | Options |
|---|---|---|
| **Date Used** | `accessFilter` | Any / Never Used / Used this week / Used this month / Not used in 6 months / Not used in 1 year |
| **Date Added** | `ageFilter` | Any / Added this week / Added this month / Older than 1w / 1m / 6m / 1y / 2y / 3y / 5y |
| **Content** | `contentFilter` | Any / No Title / Deeply nested / Empty folder / Duplicates |

Filters apply in both list view (flat leaf array) and tree view (recursive `pruneTree` pass that removes non-matching leaves and collapses any folder whose children all prune away). A **"Clear filters"** button appears in the grid header whenever any filter is active; it resets all three dimensions at once. Filter state is preserved across mode switches (unlike search, which is cleared).

The two **Content** structural filters behave differently from the leaf-based ones:

- **Deeply nested** (`deep-nested`) — matches any bookmark whose `path` has ≥ 4 segments (root + 2 folders + leaf), i.e. buried at least 3 folder levels deep. In tree view, activating this filter also auto-expands all folders at depth 0 and 1 via `mergeExpandIds`, so the qualifying depth-2 folders are immediately visible without being opened. The user sees the nesting structure without being flooded by the leaf bookmarks inside.

- **Empty folder** (`empty-folder`) — tree-view only. Instead of filtering leaves, `filteredTree2` runs a `keepEmptyFolders` pass that surfaces only folder nodes whose subtrees contain zero bookmark leaves. `matchesContentFilter` returns `false` for all leaves under this filter, so list view shows an empty state. Activating the filter triggers `mergeExpandIds` with all folder IDs in the current folder-scope tree so that empty folders at any nesting depth are immediately visible.

- **Duplicates** (`duplicates`) — surfaces bookmarks whose URLs appear more than once in the active folder tree. To support this, `BrowsePanel` pre-calculates a `duplicateUrls` Set and a `urlCounts` Map, passing them down into the filtering and rendering logic. Like `empty-folder`, this structural filter auto-expands the entire tree to ensure matches are fully visible.

The matching functions live in `bookmarkUtils.js`: `matchesAccessFilter`, `matchesAgeFilter`, `matchesContentFilter`. Each is a pure `(leaf, filter) → boolean` with no side effects. The structural filter auto-expand side effects live in a `useEffect` inside `BrowsePanel` keyed on `[contentFilter, viewMode]`.

### Duplicate Finder UX

When the **Duplicates** filter is active, the UI applies special enhancements to help users identify and manage identical links:
- **Copy Count Badges:** Any bookmark row that shares its URL with another bookmark displays an inline badge (e.g., `2 copies`).
- **Twin Highlighting:** Hovering over a duplicate bookmark sets a `hoveredUrl` state. Any other visible bookmark sharing that exact URL instantly lights up with a glowing accent border.
- **Off-screen Indicators:** If a hovered bookmark has twins that are currently scrolled out of view, sticky floating indicators (`↑ 1 copy above`, `↓ 2 copies below`) appear at the top or bottom of the grid area, guiding the user to the exact location of the duplicates.

---

## Selection System (Browse Mode)

Browse mode reuses the same multi-select mechanics as Tab List View. Selection is managed by `useBookmarkSelection`, which mirrors `useRangeSelection` from the tab list:

| Interaction | Effect |
|---|---|
| Click | Toggle select; set anchor |
| Shift+click | Range-select from anchor to target |
| Shift+hover | Soft-select preview (dashed border) |
| Drag | Rubber-band via `BookmarkDragSelectLayer` / `react-selecto` |

### Folder-cascade selection

Selecting a folder node selects all its leaf children. Deselecting a folder deselects its children. Individual children can be deselected after a folder is selected, leaving a partial selection — the folder node itself remains in `selectedFolderIds` in this state.

`resolveSelection` in `bookmarkService.js` interprets this mixed state:

```
fully selected folder   → all leaves to toAction; folder to foldersToRemove
partially selected folder → selected leaves to toAction; deselected leaves to toOrphan; folder to foldersToRemove
standalone leaf         → leaf to toAction only
```

`toOrphan` items are rescued to the folder's original parent position *before* the folder is deleted, so no bookmarks are lost if only some children are selected.

---

## Drag & Drop Reordering and Grouping (`useBookmarkDnd`)

Browse mode supports manual drag-and-drop reordering and folder grouping when the sort mode is set to `manual`. Operations are entirely staged in a temporary "draft" state and are only flushed to the Chrome Bookmarks API when the user explicitly clicks **Accept**.

### Spacer Architecture & Hit Zones

To eliminate flickering and competing hit zones when hovering over tightly packed rows, the drop targets are strictly segregated by type:

- **Index Moves (Before/After):** Handled by `BookmarkDropSpacer` elements. These are 10px-tall invisible strips rendered *between* rows. They are the exclusive drop targets for inserting items at specific indices.
- **Grouping Moves (Inside):** Handled by the bookmark row elements themselves (`BookmarkFolderRow` and `BookmarkLeafRow`). Dropping an item directly *onto* a row's bounding box always implies a grouping action.

`decodeDropTarget` interprets the intent directly from the drop target's ID prefix. If the ID starts with `spacer:before:` or `spacer:end:`, it's an index move. If it has no prefix, it's a direct row drop (grouping).

### Staged State (`draftTree` & `pendingMoves`)

During drag-and-drop, mutations are applied locally:

1. **Move inside folder:** Removes the dragged node from its current parent and pushes it into the target folder in the `draftTree`.
2. **Move before/after:** Inserts the dragged node at the specific index of the target spacer in the `draftTree`.
3. **Group with leaf (Synthesize Draft Folder):** When an item is dropped onto a leaf node, a temporary folder (`draft_group_...`) is synthesized at the target leaf's location. Both the target leaf and the dragged items are moved inside it.

All actions generate instruction objects in the `pendingMoves` array (e.g., `{ type: 'CREATE_GROUP' }` or standard `{ dragId, newParentId, beforeSiblingId }`). 

### Continuously Editable Draft Folders

Synthesized draft folders immediately render their title as an active `<input>` field directly inside the row. As the user types, `onRenameDraftFolder` continuously syncs the value to both the visual `draftTree` and the `title` property of the `CREATE_GROUP` action in the `pendingMoves` queue. The input remains fully editable until the staged changes are committed.

### Commit Phase (`handleAccept`)

Clicking **Accept** processes the `pendingMoves` array sequentially against the Chrome API:
1. `CREATE_GROUP` actions invoke `chrome.bookmarks.create` to generate the new folders in Chrome. The newly assigned Chrome IDs are captured in an `idMap`.
2. Standard move operations invoke `chrome.bookmarks.move`. If a move targets a previously synthesized draft folder, its ID is seamlessly swapped for the newly generated real Chrome ID via the `idMap` lookup.

---

## Chrome Mutations (`bookmarkService.js`)

Two mutation paths, both consuming a `resolveSelection` result:

**`executeRemove`**
1. Rescue orphaned children (`chrome.bookmarks.move` to parent).
2. Remove selected leaves in descending index order to avoid index shifting.
3. Remove now-empty folders.

**`executeArchive`**
Same orphan rescue and Chrome removal, but returns the updated archive object via `mergeIntoArchive` (a pure function — no file I/O) before the Chrome deletions.

`mergeIntoArchive` deduplicates by URL (incoming entry wins on conflict) and computes `folderPath` via suffix-stripping:

```js
const suffix = ` / ${n.title}`;
const folderPath = n.path.endsWith(suffix)
  ? n.path.slice(0, -suffix.length)  // safe even when title contains ' / '
  : n.path.split(' / ').slice(0, -1).join(' / ');
```

This is necessary because Chrome page titles often contain ` / ` (e.g. `"X. It's what's happening / X"`), which would corrupt a naive `split(' / ')`.

---

## Cold Storage File I/O

### Why the File System Access API

`chrome.downloads` can only write — there is no way to read a file back without the user re-picking it via `<input type="file">`. `localStorage` and `chrome.storage.local` can store JSON but not `FileSystemFileHandle` objects. The File System Access API solves both:

- `showSaveFilePicker()` — one-time location selection; user picks where the archive lives
- `handle.createWritable()` + `write()` + `close()` — silent write at any time, no dialog
- `handle.getFile().text()` — read back on the next session without re-prompting

This is exactly how files.md handles its "load a folder once, edit forever" workflow.

### Handle Persistence (IndexedDB)

`FileSystemFileHandle` objects cannot be serialised to JSON, so they cannot be stored in `chrome.storage.local` or `localStorage`. IndexedDB is the only storage mechanism that preserves them across sessions.

`src/utils/archiveFileHandle.js` provides a three-function wrapper:

```js
saveHandle(handle)   // IDB put under key 'archiveHandle'
loadHandle()         // IDB get → FileSystemFileHandle | null
clearHandle()        // IDB delete (used if the file is moved/deleted)
```

### Session Lifecycle (`useArchive`)

On mount, `useArchive` runs a single async effect:

```
loadHandle() from IndexedDB
  → null
      archiveState = 'unlinked'
  → handle found
      handle.queryPermission({ mode: 'readwrite' })
        → 'granted'   → read file → parse JSON → archiveState = 'ready'
        → 'prompt'    → archiveState = 'needsPermission'
                         (requires a user gesture before requestPermission)
```

This means `archiveReady` is known before the first render cycle completes — no lazy init, no race between the Browse tab's Archive button and the Cold Storage tab's file setup.

### Write Path

Every archive mutation (first create, append from Browse, remove-from-archive, restore-and-remove) goes through the same internal `writeArchiveToHandle`:

```js
async function writeArchiveToHandle(updatedArchive) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(updatedArchive, null, 2));
  await writable.close();
}
```

No save dialog. No downloads folder. The file is updated in-place at its original location.

### Archive Object Schema

```json
{
  "version": 1,
  "filename": "chrome-tab-archive.json",
  "lastModified": "2026-05-21T03:46:05.383Z",
  "bookmarks": [
    {
      "id": "58",
      "parentId": "5",
      "index": 12,
      "title": "My Bookmark",
      "url": "https://example.com/",
      "dateAdded": 1779335135847,
      "dateLastUsed": null,
      "path": "Bookmarks bar / My Folder / My Bookmark",
      "folderPath": "Bookmarks bar / My Folder",
      "archivedAt": "2026-05-21T03:46:05.383Z"
    }
  ]
}
```

`folderPath` is stored separately from `path` to support reliable restore — see the suffix-stripping note above.

---

## Cold Storage UI States

`ColdStoragePanel` renders one of three states keyed on `archiveState`:

| State | Trigger | UI |
|---|---|---|
| `unlinked` | No handle in IndexedDB | "No archive file yet" empty state + **Create file** button |
| `needsPermission` | Handle found, `queryPermission() === 'prompt'` | "Permission needed" state + **Reconnect** button (calls `requestPermission` — requires user gesture) |
| `ready` | Handle granted, file read | Status chip shows filename + count; body shows archive list or "linked but empty" message |

The status chip in the header shows a button only when action is required. Once `ready`, the chip is read-only.

---

## Restore Logic (`ensureFolderPath`)

Restoring archived bookmarks recreates the original Chrome folder hierarchy before inserting the leaf.

`getRootMap` fetches `chrome.bookmarks.getTree()` once and builds a lowercase-title → Chrome-ID map of the top-level containers (`"bookmarks bar"` → `"1"`, `"other bookmarks"` → `"2"`, etc.). This avoids using `getChildren('0')`, which is unreliable in MV3 and locale-sensitive.

`ensureFolderPath(folderPath)` receives the pre-stripped folder path and walks it:

```
["Bookmarks bar"]              → resolve via rootMap → return "1" (no folder created)
["Bookmarks bar", "Dev"]       → rootMap("bookmarks bar") = "1"
                                  getChildren("1") → find/create "Dev" → return its id
["Bookmarks bar", "Dev", "Tools"] → same, one level deeper
```

For legacy archive entries that predate the `folderPath` field, `restoreFromArchive` derives it on the fly using the same suffix-stripping logic as `mergeIntoArchive`.

---

## Cold Storage Selection & Grouped UI

Cold Storage items are grouped by `folderPath` into **synthetic folder nodes** before rendering. `groupArchiveByFolder` (in `bookmarkUtils.js`) builds an array of nodes shaped to be drop-in compatible with `useBookmarkSelection`, `getAllLeaves`, and `getFolderActivityColor`:

```js
{
  id:       'group:Bookmarks Bar / Github',  // synthetic — no Chrome equivalent
  title:    'Github',                         // last path segment
  isFolder: true,
  depth:    1,                                // segments.length - 1
  children: [ ...archiveItemsInGroup ],       // archive items used as leaves
}
```

Because archive items have `.url` and no `.isFolder` field, `getAllLeaves` treats them as leaves, so `getFolderCheckState` and `handleFolderClick` work unmodified on these synthetic nodes.

`useBookmarkSelection` is used directly in `ColdStoragePanel` (not wrapped or duplicated). `BookmarkDragSelectLayer` is also reused unchanged — `ArchivedBookmarkRow` exposes `data-bookmark-id={node.id}` (the original Chrome bookmark ID) which matches the drag layer's existing selector. At action boundaries, `selectedLeafIds` (a set of Chrome IDs) is translated to URLs via a `Map<id, url>` lookup before being passed to the action callbacks.

The action functions in `useArchive` now accept an explicit `urlSet: Set<string>` parameter instead of owning selection state internally, keeping the hook stateless with respect to selection.

---

## Restore Reliability Fixes

Two bugs in the original restore path have been addressed:

**Index out-of-range**: Archived bookmarks store the `index` they had at archive time. After a folder is archived and emptied, restoring into it with those original indices fails silently because the indices now exceed the folder's child count. Fix: sort items by `index` ascending before restoring, then clamp each index to the folder's current child count:

```js
const children = await chrome.bookmarks.getChildren(parentId);
const safeIndex = Math.min(node.index, children.length);
```

**Empty parent folders left behind**: Archiving all children of a folder previously left an empty, orphaned folder in Chrome. Fix: `pruneEmptyAncestors` is called after every archive operation. It walks up the ancestor chain from each removed item's parent and deletes any folder that is now empty (skipping the permanent root containers — Bookmarks Bar, Other Bookmarks, etc.).

---

## Cold Storage Actions (Selection Footer)

When items are selected in the archive list, three actions appear:

| Action | Behaviour |
|---|---|
| **Restore to Chrome** | `restoreFromArchive` — recreates bookmarks in Chrome; leaves them in the archive |
| **Restore & remove** | Restores to Chrome, then removes those entries from the archive object and writes the file |
| **Delete from archive** | Removes entries from the archive and writes the file; nothing restored to Chrome |

All three operations call `removeFromArchive` (pure function, no file I/O) to produce the updated archive object, then pass the URL set explicitly to the action handler. `writeArchiveToHandle` persists the result.

Actions are surfaced in a slide-in footer that appears only when one or more items are selected. "Clear all" and "Select all" controls are in the gridHeader above the list.

---

## Tree View

Browse mode opens in **tree view by default**. The view toggle (tree | list) is in the card header; tree is the first/left option.

### Separate leaf row components

`BookmarkRows.jsx` exports two distinct leaf row components:

- **`BookmarkLeafRow`** — used in flat list mode. Standard card with its own `padding: 11px 16px`.
- **`BookmarkTreeLeafRow`** — used in tree mode. Mirrors `BookmarkFolderRow`: depth applied directly on the card element (`paddingLeft: 14 + depth × 18`), with a chevron spacer so the favicon column aligns with folder text. No outer wrapper div.

Sharing the same component between list and tree mode caused a double-padding structure (card's own padding stacked on top of a wrapper div's indent), misaligning leaves vs. folders at every depth. Splitting the components keeps the indent formulas consistent.

### Date display

Both leaf row variants show two date lines on the right side of each row:

- **Used `X ago`** — `dateLastUsed`, colored by `getActivityColor`. If absent: **Never used** in red.
- **Added `X ago`** — `dateAdded`, independently colored by `getAgeColor(node.dateAdded)`.

The two dates are scored independently — a recently-revisited old bookmark shows green "Used" + red "Added".

---

## File Map

| File | Role |
|---|---|
| `BookmarkManagerCard.jsx` | Orchestrator — mode toggle, hook wiring, shared search bar, Archive/Remove coordination |
| `BrowsePanel.jsx` | Full bookmark tree/list with selection and action bar |
| `ColdStoragePanel.jsx` | Three-state archive UI; owns `useBookmarkSelection` + grouped rendering + fuzzy search |
| `useBookmarkData.js` | `chrome.bookmarks` snapshot, refresh, expand/collapse; `mergeExpandIds` for non-destructive auto-expand |
| `useBookmarkDnd.js` | Drag-and-drop state machine; manages `draftTree`, synthesizes draft folders, and processes `pendingMoves` upon commit |
| `useArchive.js` | FileSystemFileHandle lifecycle, all archive CRUD operations (stateless w.r.t. selection) |
| `useBookmarkSelection.js` | Click, shift-click, hover, drag-select; folder-cascade logic — shared by Browse and Cold Storage |
| `BookmarkDragSelectLayer.jsx` | Rubber-band selection via `react-selecto` — shared by Browse and Cold Storage |
| `BookmarkRows.jsx` | `BookmarkLeafRow` (list), `BookmarkTreeLeafRow` (tree), `BookmarkFolderRow`, `BookmarkTreeNode`, `ArchivedGroupHeader`, `ArchivedBookmarkRow` |
| `BookmarkManagerSidebar.jsx` | Sort / folder filter sidebar + three independent filter sections (Date Used, Date Added, Content) — pure presentational |
| `src/utils/archiveFileHandle.js` | IndexedDB wrapper: `saveHandle`, `loadHandle`, `clearHandle` |
| `src/utils/bookmarkUtils.js` | `buildFullTree`, `sortBookmarks`, `sortTree`, `getAgeColor`, `getActivityColor`, `getFolderActivityColor`, `groupArchiveByFolder`, `matchesAccessFilter`, `matchesAgeFilter`, `matchesContentFilter` |
| `src/services/bookmarkService.js` | `resolveSelection`, `executeRemove`, `executeArchive`, `mergeIntoArchive`, `restoreFromArchive`, `ensureFolderPath`, `pruneEmptyAncestors` |
| `BookmarkManagerCard.module.css` | All scoped styles |
