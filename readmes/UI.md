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

---

## CenterView — Expanded Card Mode

Certain panel views (Settings, List View, Bookmark Manager, and the worker/wizard panels) benefit from more space. When one of these views is active, the main card area **expands to fill the entire grid**: full width and full height. The **BottomStatusBar slides off-screen** (bottom edge) and the **right-side panels slide off-screen** (right edge) while fading out. All three stay mounted to preserve their state. This feature is called **CenterView**.

### Grid Layout Contract

The dashboard grid is defined in `Dashboard.module.css`:

```css
.dashboard {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr)) 62px;  /* last row is fixed 62px for the bar */
  gap: clamp(10px, 1.5vw, 16px);
  overflow: hidden;  /* clips the bar/panel exit animations */
}

/* .main's span is controlled by the --main-col-end / --main-row-end custom properties */
.main {
  grid-column: 1 / var(--main-col-end, 4);  /* 4 = normal, 6 = CenterView (full width) */
  grid-row: 1 / var(--main-row-end, 7);      /* 7 = normal, 8 = CenterView (full height) */
}

/* .hotkeys always occupies the last row, regardless of .main's span */
.hotkeys {
  grid-column: 1 / var(--main-col-end, 4);
  grid-row: 7 / 8;
  z-index: 20;
}
```

In **normal mode**: `--main-col-end: 4` / `--main-row-end: 7` → `.main` spans columns 1–4 and rows 1–7, the panels occupy columns 4–6, and `.hotkeys` sits below in row 7–8.  
In **CenterView**: `--main-col-end: 6` / `--main-row-end: 8` → `.main` expands to the full grid. The panels are kept in their grid cells but hidden with `opacity: 0` and `pointer-events: none` (still in the DOM), and `.hotkeys` slides off-screen via animation (its grid position is unchanged; it is removed visually, not from the DOM).

### State: `isCenterView` in `TriageDashboard.jsx`

`isCenterView` is **pure derived state** — no `useState`, no persistence. It is computed from `activeView` on every render:

```js
// ── CenterView ───────────────────────────────────────────────────────────
// When one of these views is active, .main expands to fill the entire grid
// (all 5 columns and full height) and the BottomStatusBar slides off-screen.
// The right-side panels and status bar stay mounted to preserve their state,
// but the panels are hidden via opacity: 0 and pointer-events: none.
//
// To add a new CenterView card: add its view key string to this Set.
// No CSS changes required.
// ──────────────────────────────────────────────────────────────────────────
const CENTER_VIEW_KEYS = new Set([
  'settings',             // App settings
  'listview',             // Full tab list
  'bookmarks',            // Bookmark manager
  'autotabgrouperworker', // Auto Tab Grouper settings
  'autocloserworker',     // Auto Tab Closer settings
  'autotabgroup',         // Tab Group Wizard
  'autosmush',            // Auto Smusher
  'tabsorter',            // Auto Sorter
  'watchlater',           // YouTube Watch Later
  'autoclose',            // Close Old Tabs
]);
const isCenterView = CENTER_VIEW_KEYS.has(activeView);
```

`activeView` is already managed at the `TriageDashboard` level (not inside `Card`) so it persists across card remounts caused by filter changes.

### How the Grid Change Is Applied

The CSS variables are set via an inline `style` prop on the `.dashboard` div, and a `data-center-view` attribute is toggled. 

```jsx
<div
  className={styles.dashboard}
  data-center-view={isCenterView}
  style={{
    '--main-row-end': isCenterView ? 8 : 7,
    '--main-col-end': isCenterView ? 6 : 4,
  }}
>
```

When `isCenterView` flips, the entire navigation action is wrapped in the native **View Transitions API** via `document.startViewTransition()` in `handleNavigate`. This triggers the browser's compositor to take a snapshot of the normal state and the new centered state, and morph them together in a seamless GPU-accelerated animation.


### How the Panels and Bar Are Animated

Previously, the side panels and bottom bar were animated using complex Framer Motion logic. They are now elegantly integrated directly into the View Transition API.

1. **Persistent State:** The side panels and the hotkeys bar remain in the DOM at all times. They do not unmount, which preserves their scroll positions and internal state perfectly.
2. **Pure CSS Triggers:** When `[data-center-view="true"]` is applied to `.dashboard`, pure CSS transforms slide the panels off the right edge (`transform: translateX(...)`) and slide the bottom bar down below the viewport.
3. **Synchronization (The Z-Index Fix):** 
   By assigning unique `view-transition-name` properties in `Dashboard.module.css` (e.g., `bookmarks-panel`, `tabgroups-panel`, `hotkeys-bar`), these elements are hoisted into the same pseudo-element animation layer as the main card. 
   
   *This guarantees they animate in perfect lockstep with the card expanding, completely eliminating clipping, trailing, or weird overlap issues that plagued the old Framer Motion implementation.*

4. **Cinematic Crossfade Timing:** 
   In `global.css`, we heavily override the default browser View Transition behavior for the `main-card`. By default, the API creates an ugly "squished" stretch effect during resize. 
   
   To fix this, we assign `object-fit: none` and use a bespoke keyframe sequence:
   
   ```css
   ::view-transition-old(main-card) {
     animation: customFadeOut 0.8s cubic-bezier(0.25, 0.1, 0.25, 1);
   }
   ::view-transition-new(main-card) {
     animation: customFadeIn 0.8s cubic-bezier(0.25, 0.1, 0.25, 1);
   }
   ```
   
   This creates a beautiful "breathing" effect: the old content fades out instantly, the card's physical bounds smoothly expand while empty, and the new content fades in seamlessly at the very end of the 0.8s timeline.

### Adding a New CenterView Card

1. Open `TriageDashboard.jsx`.
2. Add the card's `activeView` key string to `CENTER_VIEW_KEYS`. That's it.
3. No CSS changes, no new state, no new props.

### Adjusting the Row Span

To change how many rows CenterView occupies:
1. Open `Dashboard.module.css`. Find the `.main` rule.
2. Change the fallback in `var(--main-row-end, 7)` for the normal-mode value.
3. In `TriageDashboard.jsx`, update the `isCenterView ? 8 : 7` literal to match.
4. Ensure `grid-template-rows` has enough rows defined in `.dashboard`.
