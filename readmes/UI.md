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
├── constants/
│   ├── quips.js              # Mascot notification & quip copy
│   └── tabProcessingModes.js # Stack sort & filter mode enum constants
├── store/
│   ├── TriageProvider.jsx    # Global state (Context + useReducer)
│   ├── HotkeysProvider.jsx   # Hotkey config (Context + localStorage)
│   └── music/
│       ├── MusicProvider.jsx # Web Audio API dynamic synth engine
│       ├── musicConfig.js    # Progression mechanics & game physics
│       └── songs/song1.js    # Step sequencer JSON song definition
├── hooks/
│   ├── useChromeApis.js      # Initializes tab/bookmark/group data from Chrome
│   └── useKeyboard.js        # Global keydown listener, dispatches actions
└── components/
    ├── Dashboard/
    │   ├── TriageDashboard.jsx     # Main entry grid container
    │   ├── BottomStatusBar.jsx     # Footer status bar HUD & mode toggle
    │   ├── BookmarkPickerPanel.jsx # Side-panel fuzzy-search drawer
    │   ├── TabGroupPickerPanel.jsx # Side-panel tab group drawer
    │   └── Monitor/                # Pixel-art mascot & rhythm game widget
    ├── Card/
    │   ├── Card.jsx                # Swipable tab metadata card container
    │   └── CardViewSwitcher.jsx    # CenterView full-screen tool router
    ├── Modals/
    │   └── Modal.jsx               # App-wide modal dialogs (AiOptIn, SmushConfirm, etc.)
    ├── Tools/
    │   └── TabGroupWizard/         # Feature tool panels (AutoTabGrouper, ListView, etc.)
    ├── Shared/                     # Reusable UI primitives (Select, Tooltip, InlineAddRow)
    ├── Hotkeys/                    # Action hints & rebind tooltips
    └── Tutorial/                   # Onboarding overlay & magic dots
```

---

## The Grid System

The core layout (`TriageDashboard.jsx`) uses a strict **10×7 CSS Grid** covering the full viewport. Grid areas are defined in `Dashboard.module.css`:

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  grid-template-rows: repeat(7, minmax(0, 1fr));
  gap: clamp(10px, 1.5vw, 16px);
  padding: clamp(10px, 1.5vw, 16px); /* matches gap for uniform tile look */
  height: 100vh;
}

.main      { grid-column: 1 / var(--main-col-end, 8); }  /* 7 of 10 cols = 70% */
.hotkeys   { grid-column: 1 / var(--main-col-end, 8); grid-row: 7 / 8; }
.bookmarks { grid-area: 1 / 8 / 5 / 11; }   /* Top-right, 3 of 10 cols = 30% */
.tabGroups { grid-area: 5 / 8 / 8 / 11; }   /* Bottom-right */
```

The 10-column baseline was chosen to allow clean integer ratios: the main content area spans 6 columns (60%) in `normal` mode and 7 columns (70%) in `contentWithSidebar` mode, with the side panels taking the remainder.

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

**Default map:** `keep=→, close=←, bookmark=↑, group=↓, back=J, undo=Z, openTab=Space`

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

## Picker Panels

The picker UI is not a modal overlay — it is implemented as always-mounted side panels (`BookmarkPickerPanel`, `TabGroupPickerPanel`) that live in the dashboard grid. Their visibility is controlled by `layoutMode` and CSS transforms, not by mounting/unmounting.

**State — `PickerProvider`**

`PickerProvider` (`src/store/PickerProvider.jsx`) is the single source of truth for picker state, accessed via `usePicker()`:

- `activePicker` — `null | 'bookmark' | 'group'`. Setting this to a non-null value activates that panel.
- `batchTarget` — `null | { tabs: Tab[] }`. Set by List View before opening a picker to indicate which tabs the picker should operate on. Cleared by the panel after confirming.
- `registerPicker(type, handlers)` — each panel calls this on mount to register `{ onNavigate, onConfirm, onDeactivate }` callbacks. Used by `useKeyboard` to route arrow keys, Enter, and Escape into the active panel without the panel needing to attach its own global listeners.
- `navigatePicker`, `confirmPicker`, `deactivatePicker` — called by `useKeyboard` to dispatch events to whichever panel is currently active.

**Single-tab triage flow**

The triage hotkeys (↑ bookmark, ↓ group) call `setActivePicker('bookmark' | 'group')`. The corresponding panel becomes active, the user navigates its list with arrow keys, and pressing Enter triggers `onConfirm` → calls `bookmarkAction` or `groupAction` from `useTriageActions` on the current triage card tab.
- **Bookmark Picker:** Functions as a direct-save picker. Clicking a folder (or pressing Enter) immediately saves the single tab into that folder. No subfolder creation logic is offered.

**Batch flow (List View)**

List View sets `setBatchTarget({ tabs: selectedTabs })` then calls `setActivePicker`. When the panel confirms, it reads `batchTarget.tabs` and delegates to the atomic batch actions inside `useTriageActions` (`groupBatch` or `bookmarkBatch`). These atomic actions ensure the UI monitor is updated only once (e.g. "BOOKMARKED 10 TABS INTO 'FOLDER'") and that only a single undo block is added to the `globalChromeUndoStack`. `batchTarget` is cleared after use.
- **Bookmark Picker:** Entering batch mode (`batchTarget.tabs.length > 1`) hides the generic "Save" button to prevent ambiguity. By default, it forces a **subfolder creation** (opening an inline prompt when a parent folder is selected) to avoid cluttering the parent folder with multiple tabs. This behavior can be disabled via a "Subfolder" toggle in the header. If the user creates a folder manually (via the `+` button), all batch tabs are automatically saved into the new folder via `bookmarkBatch` and the panel closes.


---

## Iteration Notes

- **Adding a new sidebar panel:** Create a component in `src/components/Sidebar/`, add a grid area in `Dashboard.module.css`, and mount it in `TriageDashboard.jsx`. The `RetroMonitor` component is already built but currently commented out — it can serve as a template.
- **Progress bar:** The `TriageProvider` exposes `state.tabs` and `state.currentIndex`. A progress bar can be derived entirely from those two values without any new state.
- **New triage actions:** Add a case to the `useReducer` in `TriageProvider.jsx`, update `useKeyboard.js`, and add a hint to `ActionHints.jsx`.
- **Overflow debugging:** If a component is bleeding outside its grid cell, check that the parent has `min-height: 0` and the child has `overflow: hidden`. The Card component is the main example of this pattern.

---

## Layout Modes — `normal`, `centered`, `contentWithSidebar`

Certain panel views (Settings, List View, Bookmark Manager, and the worker/wizard panels) benefit from more horizontal or vertical space. The dashboard grid is controlled by a single `layoutMode` string that drives all positioning, visibility, and animation simultaneously. All three modes are **pure derived state** — no `useState`, no persistence. They are computed on every render in `TriageDashboard.jsx`.

### The Three Modes

| Mode | `.main` columns | Row span | Side panels | Bottom bar |
|---|---|---|---|---|
| `normal` | 1–7 (60%) | 1–7 | Visible | Visible |
| `centered` | 1–11 (full) | 1–8 | Slid off-screen right | Slid off-screen down |
| `contentWithSidebar` | 1–8 (70%) | 1–8 | Visible | Slid off-screen down |

`contentWithSidebar` is specifically designed for the **List View** when a picker panel (Bookmarks or Tab Groups) is active. It gives the panel full vertical height (no bottom status bar row consuming space) while keeping the side panels visible and accessible.

### Layout Mode Derivation

```js
let layoutMode = 'normal';
if (CENTER_VIEW_KEYS.has(activeView) || showAutoGroupWizard) {
  if (activeView === 'listview' && activePicker !== null) {
    layoutMode = 'contentWithSidebar';
  } else {
    layoutMode = 'centered';
  }
}
```

`CENTER_VIEW_KEYS` is a `Set` of `activeView` string keys. Adding a new full-screen tool requires only adding its key string to this Set — no CSS changes, no new props.

`activeView` is managed at the `TriageDashboard` level (not inside `Card`) so it persists across card remounts caused by filter changes.

### How the Grid Change Is Applied

The CSS properties for each mode are explicitly defined in `Dashboard.module.css` using the `data-layout-mode` attribute on the `.dashboard` div:

```jsx
<div
  className={styles.dashboard}
  data-layout-mode={layoutMode}
>
```

The attribute selector is used to cleanly toggle grid layout changes:

```css
/* Normal (60/40) */
.main { grid-column: 1 / 7; grid-row: 1 / 7; }
.bookmarks, .tabGroups { grid-column: 7 / 11; }

/* contentWithSidebar (70/30) */
[data-layout-mode="contentWithSidebar"] .main { grid-column: 1 / 8; grid-row: 1 / 8; }
[data-layout-mode="contentWithSidebar"] .bookmarks,
[data-layout-mode="contentWithSidebar"] .tabGroups { grid-column: 8 / 11; }

/* centered (100%) */
[data-layout-mode="centered"] .main { grid-column: 1 / 11; grid-row: 1 / 8; }
```

### Animations

There are four valid layout transitions. `normal ↔ contentWithSidebar` does not exist — `contentWithSidebar` is only reachable from `centered` (i.e. when List View is already open).

| Transition | Trigger | System |
|---|---|---|
| `normal` → `centered` | User opens a full-screen tool (e.g. List View) | View Transitions API |
| `centered` → `normal` | User closes the tool, returns to triage deck | View Transitions API |
| `centered` → `contentWithSidebar` | User opens a picker (Bookmarks/Group) from List View | CSS transition |
| `contentWithSidebar` → `centered` | User closes the picker | CSS transition |

**View Transitions API — `normal` ↔ `centered`**

`handleNavigate` in `TriageDashboard.jsx` wraps the state update in `document.startViewTransition()`. The browser snapshots the before and after states and morphs the following named elements (defined via `view-transition-name` in `Dashboard.module.css`):

- `main-card` — primary content area
- `bookmarks-panel`, `tabgroups-panel` — side panels
- `hotkeys-bar` — bottom bar

`global.css` overrides the default crossfade for all named groups. The side panels and hotkeys bar animate at `0.8s cubic-bezier(0.4, 0, 0.2, 1)` in sync with the card expansion.

The `main-card` uses a bespoke two-phase sequence to avoid the browser's default "squished stretch" resize artifact. By default, the View Transitions API scales the snapshot to fit the new bounds — `object-fit: none` disables that. The actual animation is split across `old` and `new`:

```css
::view-transition-old(main-card) {
  animation: card-fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  object-fit: none;
  object-position: center;
}

::view-transition-new(main-card) {
  animation: card-fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.4s both;
  object-fit: none;
  object-position: center;
}
```

`card-fade-out` runs for 0.3s, fading the old content to opacity 0 while the card bounds simultaneously expand to fill the grid. `card-fade-in` starts at 0.4s (after the expansion has largely settled) and fades the new content in over 0.4s. This creates a "breathing" effect: the card grows empty, then reveals the new view — eliminating any visual collision between the outgoing and incoming content.

The root crossfade (`::view-transition-group(root)`) is disabled entirely via `animation: none`.

`is-routing` is added to `document.documentElement` for the duration of the transition. This triggers `transition: none !important` on `.panel` and `.hotkeys` in `Dashboard.module.css`, preventing the CSS transition system from firing simultaneously.

The following design decisions make this work correctly. Previously, the side panels and bottom bar were animated using complex Framer Motion logic — they are now integrated directly into the View Transition API:

1. **Persistent State:** The side panels and the hotkeys bar remain in the DOM at all times. They do not unmount, which preserves their scroll positions and internal state perfectly.
2. **Pure CSS Triggers:** When `[data-layout-mode="centered"]` is applied to `.dashboard`, pure CSS transforms slide the panels off the right edge (`transform: translateX(...)`) and slide the bottom bar down below the viewport.
3. **Synchronization (The Z-Index Fix):** By assigning unique `view-transition-name` properties in `Dashboard.module.css` (`bookmarks-panel`, `tabgroups-panel`, `hotkeys-bar`), these elements are hoisted into the same pseudo-element animation layer as the main card.

   *This guarantees they animate in perfect lockstep with the card expanding, completely eliminating clipping, trailing, or weird overlap issues that plagued the old Framer Motion implementation.*

**CSS transitions — `centered` ↔ `contentWithSidebar`**

`setActivePicker` in `PickerProvider` is a plain synchronous `useState` setter — no View Transition. React re-renders, `layoutMode` flips between `centered` and `contentWithSidebar`, and the data-attribute CSS rules in `Dashboard.module.css` apply or remove `translateX`/`translateY` transforms. The `.panel` class carries `transition: transform 200ms ease-out, opacity 200ms ease-out`; `.hotkeys` carries `transition: transform 200ms ease-out`. The browser handles the slide with no JavaScript coordination.


### Adding a New CenterView-Style Tool

1. Open `TriageDashboard.jsx`.
2. Add the card's `activeView` key string to `CENTER_VIEW_KEYS`. That's it.
3. No CSS changes, no new state, no new props.
4. If the tool needs `contentWithSidebar` behavior (panels visible, bar hidden), extend the `layoutMode` derivation condition accordingly.

### Adjusting Column or Row Spans

- **Row span:** Change the `grid-row` values for `.main` and `.hotkeys` in `Dashboard.module.css` for each layout mode block.
- **Side panel width:** The 60/40 normal split is encoded as column 7 of a 10-column grid, while the 70/30 `contentWithSidebar` split uses column 8. To adjust these ratios, simply edit the `grid-column` values in the corresponding `[data-layout-mode]` overrides in `Dashboard.module.css`.
- **Ensure** `grid-template-rows` in `.dashboard` has enough rows defined for any new span values.
