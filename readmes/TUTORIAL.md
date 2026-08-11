# MagicDot Tutorial System

Welcome to the internal documentation for Tabbit's custom tutorial and onboarding engine: **MagicDot**.

Because Tabbit introduces non-standard interactions (hotkeys, swipe gestures, automated background workers), guiding the user is critical. Instead of standard blocking modals, we use a playful, non-intrusive floating dot (`MagicDot`) that zips around the UI to highlight features sequentially.

This document explains how the MagicDot library works and how to implement it for new features.

## Architecture

The system is split into three main pieces:

1. **`useTutorialSequence.jsx`**: The central brain. It holds the constant configuration arrays for every tutorial sequence in the app (positions, timings, tooltips, and target IDs) and manages the `localStorage` state so a sequence only plays once.
2. **`MagicDotProvider.jsx`**: The React Context. It maintains a registry of DOM elements. Components use `registerTarget(id)` to bind their DOM nodes to the registry.
3. **`MagicDot.jsx`**: The renderer. A `framer-motion` driven portal that reads the active sequence, waits for the requested DOM node to appear in the registry, and animates a pulsing dot to its bounding box.

## How to Add a New Tutorial

If you build a new card or panel, here is how you wire it up:

### 1. Define the Sequence
Open `src/components/Tutorial/useTutorialSequence.jsx` and add a new entry to `TUTORIAL_DATA`.

```javascript
'my-new-feature': {
    key: 'mynewfeature_tutorial_done', // localStorage key
    sequence: [
        {
            target: 'header-icon',     // The ID we will register in the component
            position: 'right',         // Where the dot anchors (top, bottom, left, right)
            tooltipPosition: 'right',  // Where the text balloon points
            duration: 2500,            // How long the dot stays here (ms)
            color: 'var(--magic-dot)',
            pulse: true,               // Whether the dot has a sonar pulse effect
            size: 14,
            tooltip: "Welcome to the new feature!",
        },
        // ... more steps
    ]
}
```

### 2. Wrap and Inject
In your component file, wrap your panel in the `<MagicDotProvider>`.

```javascript
import { MagicDotProvider, useMagicDot } from '../../Tutorial/MagicDotProvider';
import MagicDot from '../../Tutorial/MagicDot';
import { useTutorialSequence } from '../../Tutorial/useTutorialSequence';

export default function MyNewPanel() {
  return (
    <MagicDotProvider>
      <MyNewPanelInner />
    </MagicDotProvider>
  );
}
```

### 3. Register Targets & Render
Inside the inner component, fetch your sequence, render the `<MagicDot>`, and assign refs to your DOM nodes.

```javascript
function MyNewPanelInner() {
  // Fetch sequence and completion state
  const { showTutorial, sequence } = useTutorialSequence('my-new-feature');
  
  // Get the ref registrar
  const { registerTarget } = useMagicDot();

  return (
    <div>
      {/* Drop the dot renderer anywhere (it uses a React Portal) */}
      {showTutorial && <MagicDot sequence={sequence} introDelay={600} />}

      {/* Attach refs to target elements matching the sequence IDs */}
      <div ref={registerTarget('header-icon')}>
        <Icon />
      </div>
    </div>
  )
}
```

## Important Considerations & Gotchas

- **Conditional Rendering**: `MagicDot` uses a Promise-based subscription (`subscribeTarget`) to wait for a target to mount. If step 2 of your sequence targets an element that is *hidden behind a conditional `if` statement*, the tutorial will permanently hang waiting for it. **Ensure all targeted elements are mounted during the tutorial.**
- **`fixedMode`**: In environments like `TutorialOverlay`, where `MagicDot` shouldn't attach floating tooltips but rather update a central fixed text box, pass the `fixedMode` prop to `<MagicDot />`.
- **CSS Stacking Contexts**: `MagicDot` renders at the document body level with `z-index: 2147483647`. However, if you apply `fixedMode`, ensure your fixed tooltip styling has a corresponding `z-index` so it isn't trapped beneath modals.
