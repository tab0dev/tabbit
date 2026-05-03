# UI Architecture & Design Intent

This document covers how the Tabbit frontend is structured, how the layout behaves, and what you need to know to safely extend the UI.

## Philosophy

The UI is built with **React 18 + Vite**. The migration from vanilla JS was made to improve configurability, enable proper component isolation, and support growing feature complexity. The retro aesthetic, CSS Grid layout, and triage logic are all preserved exactly in the new architecture.

---

## Project Structure

```
src/
├── App.jsx                   # Root router — switches between modes
├── main.jsx                  # React DOM entry point
├── styles/
│   └── global.css            # :root tokens, base resets, animations
├── store/
│   ├── TriageProvider.jsx    # Global state (Context + useReducer)
│   └── HotkeysProvider.jsx   # Hotkey config (Context + localStorage)
├── hooks/
│   ├── useChromeApis.js      # Initializes tab/bookmark/group data from Chrome
│   └── useKeyboard.js        # Global keydown listener, dispatches actions
└── components/
    ├── Dashboard/
    │   ├── TriageDashboard.jsx     # Main 5×7 grid container
    │   ├── Dashboard.module.css    # Grid area assignments
    │   ├── CompleteView.jsx        # Post-triage summary screen
    │   └── PermissionBanner.jsx    # Chrome permission prompt UI
    ├── Card/
    │   ├── Card.jsx                # Tab metadata + preview panel
    │   └── Card.module.css         # Card layout, exit/enter animation classes
    ├── Sidebar/
    │   ├── BookmarkSidebar.jsx     # Bookmark folders list
    │   ├── GroupSidebar.jsx        # Tab groups list
    │   └── Sidebar.module.css
    ├── Hotkeys/
    │   ├── ActionHints.jsx         # Clickable hotkey hints, rebind tooltip
    │   └── Hotkeys.module.css
    ├── Overlay/
    │   ├── PickerModal.jsx         # Fuzzy-search picker for bookmarks/groups
    │   └── Overlay.module.css
    └── Monitor/
        └── RetroMonitor.jsx        # Retro pixel monitor (currently hidden)
```

---

## The Grid System

The core layout (`TriageDashboard.jsx`) uses a strict **5×7 CSS Grid** covering the full viewport. Grid areas are defined in `Dashboard.module.css`:

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(7, minmax(0, 1fr));
  gap: clamp(10px, 1.5vw, 16px);
  padding: clamp(10px, 1.5vw, 16px); /* matches gap for uniform tile look */
  height: 100vh;
}

.main      { grid-area: 1 / 1 / 7 / 4; }  /* Big left card */
.hotkeys   { grid-area: 7 / 1 / 8 / 4; }  /* Bottom left hotkey bar */
.bookmarks { grid-area: 1 / 4 / 5 / 6; }  /* Top right */
.tabGroups { grid-area: 5 / 4 / 8 / 6; }  /* Bottom right */
```

The `padding` and `gap` are set to the same `clamp()` value intentionally — this gives the outer border the same visual weight as the inner gutter between tiles.

The `minmax(0, 1fr)` on both axes is critical. Without it, a long URL or tab title would force a row or column to expand, breaking the uniform grid.

---

## State Management

All application state lives in **`TriageProvider`** (`src/store/TriageProvider.jsx`) via React Context + `useReducer`. Components read state and get the `dispatch` function via the `useTriage()` hook.

```
Mode.LOADING     → Shows spinner
Mode.PERMISSION  → Shows PermissionBanner
Mode.TRIAGING    → Shows TriageDashboard
Mode.PICKER      → Shows TriageDashboard + PickerModal overlay
Mode.COMPLETE    → Shows CompleteView
```

**Key dispatches:**
| Action | Payload |
|---|---|
| `PROCESS_TAB` | `{ tabId, triageAction: 'keep'|'close'|'bookmark'|'group' }` |
| `GO_BACK` | — |
| `UNDO` | — |
| `SET_MODE` | `Mode.*` |
| `SET_INITIAL_DATA` | `{ tabs, bookmarkFolders, tabGroups, ... }` |

---

## Configurable Hotkeys

Hotkey bindings are stored in `HotkeysProvider` (`src/store/HotkeysProvider.jsx`) and persisted to `localStorage` under the key `tabZeroHotkeys`.

**Default map:** `keep=K, close=X, bookmark=B, group=G, back=J, undo=Z`

**Rebinding:** Hover over any `<kbd>` element in the `ActionHints` bar. A tooltip appears prompting you to press a new key. The binding updates immediately and is saved to `localStorage`. Escape cancels. Timeout is 15 seconds.

Both `useKeyboard.js` and `ActionHints.jsx` read from the same `useHotkeys()` context, so they always stay in sync.

---

## Card Transitions

When a triage action advances to the next tab, a CSS exit→enter animation plays:

1. `cardExit` class is added to `#card-container` → slides right + fades out (150ms)
2. After 150ms, state is dispatched and the card re-renders
3. `cardEnter` class is added → slides in from the left
4. `requestAnimationFrame` cleans up the class

This pattern is implemented in both `useKeyboard.js` (keyboard triggers) and `ActionHints.jsx` (click triggers).

---

## Styling Approach

- **CSS Modules** are used for all component-level styles (`.module.css` files) — no class name collisions.
- **Global tokens** live in `src/styles/global.css` as CSS custom properties (`--bg`, `--accent`, `--radius`, etc.).
- **Fluid sizing** uses `clamp()` throughout for padding, font sizes, and gaps.
- **Overflow safety:** All grid children use `min-width: 0; min-height: 0; overflow: hidden` to prevent blowouts.

---

## Picker Modal

The picker (`PickerModal.jsx`) is a **fixed overlay** (z-index 100) that appears over the dashboard when `state.mode === Mode.PICKER`.

- Lightweight **inline fuzzy search** — no external library. Characters in the query must appear in order in the item name.
- Keyboard: ↑↓ to navigate, ↵ to confirm, Esc to cancel, click-outside to dismiss.
- The modal reads `state.pickerType` (`'bookmark'` or `'group'`) to know which list to show.
- The scrollable `<ul>` requires `min-height: 0` on the flex container to allow `overflow-y: auto` to work correctly inside a flex column.

---

## Iteration Notes

- **Adding a new sidebar panel:** Create a component in `src/components/Sidebar/`, add a grid area in `Dashboard.module.css`, and mount it in `TriageDashboard.jsx`. The `RetroMonitor` component is already built but currently commented out — it can serve as a template.
- **Progress bar:** The `TriageProvider` exposes `state.tabs` and `state.currentIndex`. A progress bar can be derived entirely from those two values without any new state.
- **New triage actions:** Add a case to the `useReducer` in `TriageProvider.jsx`, update `useKeyboard.js`, and add a hint to `ActionHints.jsx`.
- **Overflow debugging:** If a component is bleeding outside its grid cell, check that the parent has `min-height: 0` and the child has `overflow: hidden`. The Card component is the main example of this pattern.
