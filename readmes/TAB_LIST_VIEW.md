# Tab List View

The List View (also called the "batch panel") is Tabbit's primary interface for reviewing, organizing, and bulk-acting on all open tabs at once. It opens as a full overlay and combines filtering, sorting, grouping, two display modes, and multiple selection mechanisms into a single coherent workflow.

## Entry Point

`src/components/Card/ListView/ListView.jsx` is the top-level component. It is rendered as an overlay from `TriageDashboard`. It receives a single `onClose` prop and owns all internal state — no selection state, filter state, or view mode leaks up to the parent.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  Header  (search bar · view toggle · sort · group)  │
├──────────┬──────────────────────────────────────────┤
│          │  Grid Header (sort/group controls repeat) │
│ Sidebar  ├──────────────────────────────────────────┤
│ (filter) │  Grid Scroll  ← DragSelectLayer lives here│
│          │    └── .grid / .listLayout               │
│          │         └── ListViewTabCard ×N            │
├──────────┴──────────────────────────────────────────┤
│  Footer  (tab count / selection count · bulk actions)│
└─────────────────────────────────────────────────────┘
```

---

## Tab Pipeline (how tabs are prepared for display)

Tabs pass through a sequential pipeline of transformations before being rendered. Each stage produces a new derived array, computed via `useMemo`:

### 1. Eligible Tabs
```js
state.tabs.filter(t => !t.processed && !t.gone)
```
Only tabs that have not been acted on (kept/bookmarked/closed/grouped) and have not disappeared from the browser are shown.

### 2. Sort (`applyTabProcessing`)
Handled by `src/services/tabProcessingService.js`. The sort mode is selected from the sidebar and stored in `sortMode` state.

| Mode | Behaviour |
|---|---|
| `auto` | Default Chrome tab order |
| `alphabetical` | A → Z by tab title |
| `oldest_first` | By `lastAccessed` ascending |
| `newest_first` | By `lastAccessed` descending |
| `group_by_site` | Sorted by domain, then title |

### 3. Sidebar Filters
Two independent multi-select filters applied on top of the sort:
- **Tab Group filter** — show only tabs belonging to the selected Chrome tab group(s)
- **Domain filter** — show only tabs from the selected domain(s)

Multiple filters can be active at once; they are AND-ed. Clearing filters restores the full sorted list. An active filter count badge and "Clear filters" button appear in the footer.

### 4. Fuzzy Search
Uses `@leeoniya/ufuzzy` with `intraMode: 1` (allows one intra-word error). The search string is matched against `"${tab.title} ${tab.url}"` for each tab. Matched tabs are re-ordered by match score. The search overlay completely replaces the filtered list.

### 5. Grouping
After search/filter, tabs can optionally be visually grouped into labelled sections:

| Mode | Sections |
|---|---|
| `none` (default) | Single flat list |
| `tab_group` | One section per Chrome tab group; "Ungrouped" first |
| `domain` | One section per domain |

Grouping is purely visual — it does not affect selection logic, which always operates over the flat `displayTabs` array.

---

## Display Modes

Toggled with the grid/list icon buttons in the header. Stored in `viewMode` state (`'grid'` | `'list'`).

### Grid View
Cards rendered in a CSS grid (`repeat(auto-fill, minmax(160px, 1fr))`). Each card (`GridItemView`) shows:
- Favicon
- Checkbox (top-right)
- Title + URL text
- Live screenshot thumbnail (lazy-captured via `captureTab`)
- Group colour accent on the left border (if tab belongs to a tab group)
- Duplicate badge (if the URL appears in multiple open tabs)

### List View
A vertical flex column. Each row (`ListItemView`) shows:
- Checkbox
- Favicon
- Title + URL (truncated with ellipsis)
- Duplicate badge
- Group colour accent on the left border

Both modes use the same `ListViewTabCard` dispatcher component which selects `GridItemView` or `ListItemView` based on `viewMode`.

---

## Sidebar

`ListViewSidebar.jsx` is a pure presentational component. It receives all filter/sort state as props and emits callbacks — no local state.

**Sort section** — radio-style single select.

**Tab Groups section** — multi-select toggle list. Each entry shows the group's colour dot, title, and tab count. Only shown when at least one tab group exists.

**Domains section** — multi-select toggle list. Domains are counted across all eligible tabs (before filters) and sorted by count descending. Capped at 20 entries. Only shown when more than one domain is present.

---

## Selection System

Selection is managed entirely by the `useRangeSelection` hook (`useRangeSelection.js`) and two interaction layers. **All selection state lives in the hook — `ListView.jsx` only destructures and threads values down to children.**

### Core State

| State | Type | Purpose |
|---|---|---|
| `selectedIds` | `Set` | Hard-selected tab IDs |
| `softSelectedIds` | `Set` (derived) | Preview range shown while Shift is held |
| `anchorId` | `id \| null` | The "from" end of a shift-click range |
| `hoverId` | `id \| null` | The currently hovered card during Shift hover preview |
| `shiftHeld` | `boolean` | Tracks global Shift key state via `keydown`/`keyup` listeners |

### 1. Plain Click — Toggle Select

Clicking a card without modifiers toggles that card's `selectedIds` membership and sets it as the new `anchorId`. The anchor is the reference point for subsequent Shift+clicks.

### 2. Shift+Click — Range Select

When Shift is held and an `anchorId` exists:
1. The range between `anchorId` and the clicked card is computed over the flat `displayTabs` array (not the visual grid layout). This makes range selection work correctly **across visual rows and across group section boundaries**.
2. If `anchorId` is currently selected, all IDs in the range are **added** to `selectedIds`.
3. If `anchorId` is currently deselected, all IDs in the range are **removed** from `selectedIds`.
4. The anchor does **not** move on Shift+click — subsequent Shift+clicks extend from the same fixed anchor, matching the Windows Explorer / macOS Finder model.

### 3. Shift+Hover — Soft-Select Preview

While Shift is held, hovering over a card shows a visual preview of the range that would be committed on click. This is the `softSelectedIds` set, computed as a `useMemo` over `[shiftHeld, anchorId, hoverId, displayTabs]`. Soft-selected cards render with a dashed accent border and faint background tint — distinct from the solid style of hard-selected cards.

### 4. Drag-to-Select — Rubber Band

`DragSelectLayer.jsx` wraps `react-selecto` and handles rubber-band box selection. It is mounted as a sibling of the scroll container inside `gridArea`.

**How it works:**
1. The user clicks on empty space (not on a card) and drags.
2. `shouldStartSelecting` guards the drag start — it walks up the DOM from the pointer target and cancels if a `data-tab-id` element is encountered, ensuring plain card clicks are never intercepted.
3. As the user drags, `react-selecto` draws the selection box and performs hit-testing against all `[data-tab-id]` elements in the scroll container.
4. On `mouseup`, `onSelectEnd` fires with the intersected elements. Their `data-tab-id` attributes are parsed (as integers, since dataset values are always strings but `tab.id` is a number) and passed to `addToSelection`.
5. **Drag-select is automatically disabled** while Shift is held (`isEnabled={!shiftHeld}`) to prevent conflict with shift-click range selection.
6. **Auto-scroll:** `scrollOptions` + `onScroll` drive edge-detection scrolling at 8px/tick — dragging toward the bottom edge of the grid automatically scrolls and extends the selection.

**Hit-test bridge:** Every `ListViewTabCard` root element has `data-tab-id={tab.id}`, which is what Selecto queries against. Group headers and other non-card elements have no `data-tab-id` and are automatically skipped.

**State integration:** `addToSelection` is a merge-only operation — it adds IDs to `selectedIds` without modifying `anchorId`. This means the shift-click anchor is preserved across drag operations, and the user can mix drag-select and shift-click freely.

### Selection API from `useRangeSelection`

| Export | Signature | Purpose |
|---|---|---|
| `selectedIds` | `Set<number>` | Currently selected tab IDs |
| `softSelectedIds` | `Set<number>` | Shift-hover preview range |
| `shiftHeld` | `boolean` | Whether Shift is currently held |
| `handleCardClick` | `(id, e) => void` | Plain or Shift+click handler |
| `handleCardHover` | `(id) => void` | Hover enter — updates soft-select preview |
| `handleCardHoverEnd` | `() => void` | Hover leave |
| `addToSelection` | `(ids[]) => void` | Merge IDs (used by DragSelectLayer) |
| `selectAll` | `() => void` | Select all `displayTabs` |
| `selectNone` | `() => void` | Clear selection and anchor |

---

## Bulk Actions

Bulk actions appear in the footer when `selectedIds.size > 0`. All actions operate on the current `selectedIds` set and delegate to `useTriageActions`.

| Action | Behaviour |
|---|---|
| **Keep** | Marks selected tabs as `processed: true` — they disappear from the list and remain open in the browser |
| **Bookmark** | Saves each tab to the browser's bookmarks, then marks as processed |
| **Group** | Opens the Tab Group Picker panel (`usePicker`) with `batchTarget` set to the selected IDs — the user then picks or creates a Chrome tab group |
| **Close** | Closes the selected tabs in the browser and marks them as `gone` |
| **Clear** | Deselects all (calls `selectNone`) without acting on the tabs |

After Keep / Bookmark / Close, the acted-on tabs no longer pass the `eligibleTabs` filter (`!t.processed && !t.gone`) and disappear from the list automatically. The selection is also cleared.

---

## File Map

| File | Role |
|---|---|
| `ListView.jsx` | Orchestrator — state wiring, pipeline, JSX layout |
| `ListViewTabCard.jsx` | Card dispatcher + `GridItemView` + `ListItemView` |
| `ListViewSidebar.jsx` | Sidebar filter/sort panel (pure presentational) |
| `useRangeSelection.js` | All selection logic — click, shift, hover, drag merge |
| `DragSelectLayer.jsx` | rubber-band drag-to-select via `react-selecto` |
| `ListView.module.css` | All scoped styles for the above components |
