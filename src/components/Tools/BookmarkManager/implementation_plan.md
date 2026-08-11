# Drag & Drop Reorganization for BookmarkManagerCard

Chrome-Bookmarks-Manager-style drag-and-drop for the Browse panel **tree view**: reorder leaves, move items into folders, group-select + drag multiple items, folder-to-folder moves — with fluid visual feedback and a **draft/staged-state model** (changes are previewed in-memory, then committed to Chrome all at once via an Accept/Revert footer).

---

## Scope: Tree View Only

DnD is **tree view only**. No drag-and-drop in flat list mode.

> [!NOTE]
> **Why not list view?** List mode renders a flat array of bookmark *leaves* — folder membership is purely visual (a path badge on the row). There is no structural parent–child relationship between adjacent rows in the flat array. Dragging a leaf "over" another leaf has no meaningful reorder target — the only valid drop would be "move into the same parent at a new index", which requires knowing the parent, which isn't derivable from flat position. The tree view's explicit folder rows make every drop zone's semantic unambiguous: before/after a sibling, or *inside* a folder. List mode drag-and-drop would require inventing a complex modal disambiguation UI. Tree view is the right surface.

---

## No New Library Needed

`@dnd-kit/sortable` is **not required** and would be a poor fit.

`@dnd-kit/sortable` (`useSortable`, `SortableContext`, `verticalListSortingStrategy`) is designed for **flat, reorderable arrays**. Our data is a **tree** with two distinct drop zone semantics:

1. **Positional** (`before` / `after`) — sibling reorder, shown as a drop-indicator line
2. **Containment** (`inside`) — move into a folder, shown as a folder outline glow

`verticalListSortingStrategy` knows nothing about containment semantics. Forcing the tree into a flat `items` array would produce incorrect collision detection for the `inside` case.

**`@dnd-kit/core` (already installed at `^6.3.1`) is the right primitive.** The AutoTabGroupWizard already uses `DndContext`, `DragOverlay`, `PointerSensor`, `useDraggable`, and `useDroppable` from it. We follow the same pattern.

---

## Draft / Staged-State Model

Drops do **not** immediately mutate Chrome bookmarks. Instead:

1. Each drag-end applies the move to an in-memory **draft tree** — a deep clone of `fullTree` that lives in the new `useBookmarkDnd` hook.
2. Each drag-end appends to a **`pendingMoves`** queue — an array of `{ dragId, newParentId, beforeSiblingId }` entries (positional intent, not absolute indices).
3. The **staged-changes footer** appears at the bottom of the panel (replacing the selection action bar) whenever `pendingMoves.length > 0`:

   ```
   [ 📦  3 changes staged ]          [ Revert ]  [ Accept ]
   ```

4. **Accept**: replay `pendingMoves` chronologically against Chrome using `chrome.bookmarks.move`, resolving `beforeSiblingId` to an index at replay-time (so index shifts from earlier moves don't corrupt later ones). Then call `refreshTree()` and clear draft state.
5. **Revert**: discard `draftTree` and `pendingMoves`, reset to `fullTree`.

### Why `beforeSiblingId` instead of an index

Storing `beforeSiblingId` (the ID of the sibling to insert *before*, or `null` = append) is index-shift–safe. When replaying move #3, if moves #1 and #2 have already shifted sibling indices in that folder, we recompute the index by calling `getChildren(newParentId)` and finding `beforeSiblingId` in the live Chrome tree. This makes replay order-safe regardless of how many moves have accumulated.

### Complex move chains (e.g., A→B then B→C)

Replaying in chronological order works correctly:
- Move A into B → Chrome: A is now a child of B. ✓
- Move B into C → Chrome: B (with A inside) moves into C. ✓

A inside B inside C — exactly what the draft shows. Chronological replay is always safe because Chrome applies each move atomically before the next call is made.

### Cycle detection

In the draft tree, when computing the target drop zone, we skip any folder that is an **ancestor or descendant of the dragged node** (a cycle). The `isAncestorOf(dragId, folderId, draftTree)` utility prevents this at drag-time (the folder simply won't show an `inside` highlight if it would create a cycle).

---

## Proposed Changes

### `src/utils/bookmarkUtils.js`

#### [MODIFY] `bookmarkUtils.js`

Add two pure utility functions:

**`flattenVisibleTree(tree, expandedIds)`**
Returns an ordered array of all *visible* nodes (folders + leaves) as they appear in the rendered tree. Used to identify the hovered row's index during `onDragOver` so we can compute the drop position.

**`moveNodeInDraftTree(tree, dragId, newParentId, beforeSiblingId)`**
Pure function. Returns a new tree with:
- `dragId` removed from its current parent
- `dragId` inserted into `newParentId`, before the sibling with `beforeSiblingId` (or appended if `null`)
Used to update `draftTree` on each drag-end.

**`isAncestorOf(potentialAncestorId, nodeId, tree)`**
Returns `true` if `potentialAncestorId` is an ancestor of `nodeId` in the given tree. Used to disallow dropping a folder into its own subtree.

---

### `useBookmarkDnd.js` *(new file)*

```
State:
  draftTree       — deep clone of fullTree, mutated on each drop
  pendingMoves    — { dragId, newParentId, beforeSiblingId }[]
  dragId          — id of node being dragged (null at rest)
  overId          — id of node the pointer is over
  dropPosition    — 'before' | 'after' | 'inside'
  isDragging      — boolean

Outputs:
  draftTree, pendingMoves, isDragging
  dragId, overId, dropPosition
  dndHandlers     — { onDragStart, onDragOver, onDragEnd, onDragCancel }
  handleAccept    — replays pendingMoves → chrome.bookmarks.move, refreshTree, clears state
  handleRevert    — discards draftTree + pendingMoves
  stagedCount     — pendingMoves.length
```

**Drop position inference** (inside `onDragOver`):
- Get the hovered element's `getBoundingClientRect()`
- Pointer Y in top 25% → `'before'`
- Pointer Y in bottom 25% → `'after'`
- Pointer Y in middle 50% → `'inside'` only if the hovered node is a folder and is not an ancestor/descendant of `dragId`; otherwise resolve to `'before'` or `'after'` based on which half

**Multi-item drag**:
- If `dragId` is in `selectedLeafIds` or `selectedFolderIds`, all selected items move together as a group
- `DragOverlay` badge: "3 items" instead of a single row ghost
- All selected items are appended to `pendingMoves` as separate entries (each item gets its own `chrome.bookmarks.move` on Accept), in tree-display order

**When `sortMode !== 'manual'`**:
- Hook returns `isDragging: false`, `pendingMoves: []`, and no-op handlers
- `useDraggable` items in rows receive `disabled: true`
- No drop indicators appear

---

### `BookmarkRows.jsx`

#### [MODIFY] `BookmarkRows.jsx`

**`BookmarkFolderRow`** — new props:
- `draggableProps` — `{ ref, listeners, attributes }` from `useDraggable`; spread onto root `div`
- `isDropTarget` — boolean → adds `styles.bmDropTarget` (folder outline glow) when this folder is the `inside` zone
- `isDraggingThis` — boolean → adds `styles.bmDragGhost` (opacity 0.4)

**`BookmarkLeafRow`** (tree mode) — same new props as above minus `isDropTarget`

**`BookmarkTreeNode`** — passes through `draggableProps`, `isDropTarget`, `isDraggingThis` from `BrowsePanel`

**New export: `BookmarkDropLine`**
```jsx
// 2px accent-colored horizontal rule rendered between rows at the active drop position.
// Invisible when not at the active position (opacity: 0, pointer-events: none).
export function BookmarkDropLine({ visible, depth }) { ... }
```
`depth` controls left-indent so the line aligns with the indented row content.

---

### `BrowsePanel.jsx`

#### [MODIFY] `BrowsePanel.jsx`

- Accept `onRefreshTree` prop (passed through from `BookmarkManagerCard`)
- Import `useBookmarkDnd`, `DndContext`, `DragOverlay`, `PointerSensor`, `useSensors`, `useDraggable`, `useDroppable` from `@dnd-kit/core`
- Wrap the tree `listLayout` in `<DndContext sensors={sensors} onDragStart onDragOver onDragEnd onDragCancel>`
- Each `BookmarkTreeNode` renders its row with `useDraggable` / `useDroppable` wired via props
- Render `<BookmarkDropLine>` between adjacent visible rows; visible only when `overId` matches and `dropPosition` is `before`/`after`
- `BookmarkDragSelectLayer` (rubber-band) receives `disabled={shiftHeld || isDragging}` — belt-and-suspenders against simultaneous activation
- **Staged-changes footer** replaces (or sits alongside) the existing selection action bar:

```
[ 📦  {n} move{s} staged ]    [ Revert ]  [ Accept ]
```

Appears only when `pendingMoves.length > 0`.  
The existing selection action bar continues to work independently (both can be visible simultaneously — staged moves and a current selection are orthogonal).

- `DragOverlay` renders either a single-row ghost (matching `BookmarkLeafRow` / `BookmarkFolderRow` style) or a compact "N items" pill for multi-item drags.

---

### `BookmarkManagerCard.jsx`

#### [MODIFY] `BookmarkManagerCard.jsx`

Pass `onRefreshTree={refreshTree}` down to `BrowsePanel` (it's already available from `useBookmarkData`; just needs to be threaded through as a prop so `useBookmarkDnd`'s Accept handler can call it).

---

### `BookmarkManagerCard.module.css`

#### [MODIFY] `BookmarkManagerCard.module.css`

```css
/* ── Drag & Drop ─────────────────────────────────────────── */

/* Folder receiving a drop-inside */
.bmDropTarget {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

/* Drop indicator line between rows */
.bmDropLine {
  height: 2px;
  border-radius: 1px;
  background: var(--accent);
  margin: 0;            /* left margin set inline via depth */
  pointer-events: none;
  transition: opacity 60ms ease;
}
.bmDropLineHidden {
  opacity: 0;
}

/* Source row ghost while dragging */
.bmDragGhost {
  opacity: 0.35;
}

/* DragOverlay: floating row clone */
.bmDragOverlay {
  background: var(--bg-surface);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  box-shadow: 0 4px 20px rgba(0,0,0,0.26);
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  pointer-events: none;
  cursor: grabbing;
}

/* Staged changes footer */
.bmStagedBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated));
  border-top: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  flex-shrink: 0;
  gap: 10px;
}

.bmStagedLabel {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.bmStagedActions {
  display: flex;
  gap: 6px;
}

.bmStagedRevert {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 100ms ease;
}
.bmStagedRevert:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.bmStagedAccept {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 5px;
  padding: 4px 12px;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 100ms ease;
}
.bmStagedAccept:hover {
  opacity: 0.88;
}
```

---

## Architecture Notes

### Coexistence with `react-selecto` rubber-band select
Both systems guard against simultaneous activation:
- `BookmarkDragSelectLayer` has `shouldStartSelecting` that returns `false` when the pointer is over a row element (already guards against row-click interference)
- Additional `disabled={isDragging}` prop while a drag is live — a drag-end cannot race with a new rubber-band start because pointer events are consumed by `@dnd-kit`'s `PointerSensor`

### Drag activation distance
6px movement before drag starts — same as the AutoTabGroupWizard. This prevents accidental drags on click/checkbox interactions.

### Checkpoint guard on checkbox / caret
`onPointerDown={e => e.stopPropagation()}` on the checkbox and expand-caret buttons (same pattern as `TabRow.jsx` in the Wizard) prevents the `PointerSensor` from capturing those targets as drag starts.

---

## Verification Plan

### Manual Testing
1. Drag a single bookmark leaf to a new position within the same folder → staged footer shows "1 move staged"
2. Accept → Chrome order updates, tree refreshes to match
3. Drag a bookmark leaf into a folder (drop on middle zone) → folder outline glow, then Accept → leaf appears inside in Chrome
4. Drag a whole folder to a new position → staged footer shows move, Accept → Chrome order updates
5. Multi-select 3 bookmarks, drag the group → "3 moves staged", Accept → all 3 move together
6. Revert → draft tree resets to original, staged footer disappears
7. Complex chain: drag folder A into B, then drag B into C → "2 moves staged" → Accept → A inside B inside C in Chrome ✓
8. Attempt to drag folder B into one of its own children → drop target highlight does not appear on descendant folders
9. Sort ≠ manual → drag cursor doesn't change, no drop line appears
10. Rubber-band select still works when not dragging

### Build Check
- `npm run build` — no ESLint / compile errors
