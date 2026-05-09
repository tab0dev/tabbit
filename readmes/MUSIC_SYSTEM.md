# Music System — Technical Reference

## Overview

Tabbit has a background music system that reacts to user triage activity. It starts
quiet (just a kick drum) and progressively layers in additional instruments as the
user works through their tabs. Stop working → layers fade back out.

**New Architecture:** The music system is a **real-time dynamic sequencer** built on `Tone.js`. Rather than playing static pre-rendered `.wav` files, the engine loads `Tone.Sampler` instruments (using simple single-note samples) and sequences them live using `Tone.Part` according to a JSON song definition.

The system has **four completely separate concerns** that must never be confused:

| Concern | Where | When |
|---------|-------|------|
| **Song Configuration** — JSON definitions of notes, layers, and sample URLs | `src/data/songs/song1.js` | Dev-time (editable via Music Dev Studio) |
| **Audio playback engine** — Sampler loading, mixing, and real-time sequencing | `src/store/MusicProvider.jsx` | Runtime (in the browser/extension) |
| **Beat indicator UI** — visual feedback dot in the monitor | `src/components/Monitor/RetroMonitor.jsx` | Runtime (reads from MusicProvider context) |
| **Rhythm game UI** — side-scroller game shown when music is on | `src/components/Monitor/RetroMonitorMusicGame.jsx` | Runtime (reads from MusicProvider context) |
| **Shared game configuration** | `src/data/musicConfig.js` | Runtime (defines progression mechanics and game physics) |

---

## File Map

```
src/
  data/
    songs/
      song1.js            ← JSON-based step-sequencer data
    musicConfig.js        ← Runtime config: progression rules, game physics
  store/
    MusicProvider.jsx     ← React context + Tone.js engine + beat/action signal state
  hooks/
    useTriageActions.js   ← Calls onTabAction() after every triage action
    useBeat.js            ← Consumer hook for all beat/action signals
    useMusicGame.js       ← Game state hook (obstacles, physics, score, collision)
  components/Card/
    CardFooter.jsx        ← SpeakerHigh/SpeakerSlash toggle in the footer bar
    SettingsCard.jsx      ← Secondary toggle in settings panel
    MusicDevTrackerCard/  ← Developer UI for visually editing the step sequencer
  components/Monitor/
    RetroMonitor.jsx      ← Standard bunny monitor with beat indicator dot
    RetroMonitorMusicGame.jsx ← Rhythm game monitor (shown when music is on)
    Monitor.module.css    ← Beat dot styles and flash state CSS
    MusicGame.module.css  ← Game-specific: obstacles, ground, bunny runner, overlays
  components/Dashboard/
    BottomStatusBar.jsx   ← Switches between hotkeys bar ↔ monitor/game on toggle
```

---

## Part 1: The Song Data (`song1.js`) & Music Dev Studio

The core musical composition is defined in a standard JSON format inside `src/data/songs/song1.js`. 
*(Note: This replaces the old offline `gen-audio.cjs` script, but it preserves the exact same note structure and 7-layer sequence.)*

### The Step Grid

The song relies on a 16th-note 32-step grid (2 bars in 4/4 time):

```
Steps: 0  1  2  3 | 4  5  6  7 | 8  9 10 11 |12 13 14 15 |16 17 18 19 |20 21 22 23 |24 25 26 27 |28 29 30 31
Beat:  1  +  &  a | 2  +  &  a | 3  +  &  a | 4  +  &  a | 1  +  &  a | 2  +  &  a | 3  +  &  a | 4  +  &  a
Bar:   [──────────────────────── Bar 1 ────────────────────────────][──────────────────────── Bar 2 ────────────────────────────]
```

**Duration reference (in steps):**

| Duration | Steps | Tone.js format |
|----------|-------|----------------|
| Whole note | 16 | "1m" |
| Half note | 8 | "2n" |
| Dotted quarter | 6 | "4n." |
| Quarter note | 4 | "4n" |
| Dotted 8th | 3 | "8n." |
| 8th note | 2 | "8n" |
| 16th note | 1 | "16n" |

### Current patterns (2-bar, A minor)

| Layer | Type | Pattern style |
|-------|------|---------------|
| Kick | Sampler | Steps 0, 8, 16, 24 (beats 1 & 3 each bar) |
| Hi-hat | Sampler | Every 2 steps (all 8ths), open hat at steps 6 & 22 |
| Snare | Sampler | Steps 4, 12, 20, 28 (beats 2 & 4 each bar) |
| Bass | Sampler | A2/G2/E2/C3 groove |
| Pad melody | Sampler | Gentle A minor pad |
| Lead melody | Sampler | Saxophone-style |
| Vocal | Sampler | Short "ah" one-shots at steps 0 & 16 only |

### Music Dev Studio UI

Instead of editing `song1.js` by hand, Tabbit comes with an **in-browser Dev Studio**:
1. Open the **Settings Panel** inside Tabbit.
2. Under the "Fun" category, click **"Open"** on the **Music Dev Studio** setting.
3. The Dev Studio will appear. It is a full 32-step sequencer UI that reads directly from `song1.js`.
4. **Click and Drag** (or simply click) anywhere on the grid to "paint" or "erase" notes.
5. Click **Play** to hear your loop update in real-time.
6. Click the **Download** icon when you are happy with the loop. It will copy the new JSON to your clipboard. You can paste this directly into `song1.js` to save your work!

---

## Part 2: Runtime Config (`musicConfig.js`)

While the music notes are in `song1.js`, the **game progression mechanics** remain in `musicConfig.js`:

```js
export const MUSIC_CONFIG = {
  beatsPerBar: 4,         // time signature numerator
  bpm: 72,                // Runtime BPM — should match song1.js for consistency
  missesToLoseLayer: 3,   // bars of inactivity before dropping a layer
  hitsToAddLayer: 1,      // hit bars needed to earn the next layer
  game: { ... },          // game physics/tuning (see Part 5)
};
```

---

## Part 3: Runtime Engine (`MusicProvider.jsx`)

### Lifecycle

```
User clicks toggle
    │
    ▼
toggleMusic()
    │
    ├─ ON: bootEngine() [runs once ever]
    │       ├─ Tone.start()              ← unlocks Web Audio (must be in user gesture)
    │       ├─ Create Tone.Sampler × 7   (loads sample URLs via Promise.all)
    │       ├─ Create Tone.Part × 7      (sequences the JSON notes from song1.js)
    │       ├─ Create Tone.Loop('1m')    ← bar clock, starts after 1st bar grace period
    │       └─ Create Tone.Loop('4n')    ← beat clock, starts immediately at position 0
    │
    ├─ ON: transport.start() → sequencing begins (layer 0 audible, rest at -∞ dB)
    │
    └─ OFF: fade all volumes → setTimeout(500ms) → transport.stop()
```

### State architecture

React state and Tone.js callbacks live at different timing boundaries.
Two-track pattern is used throughout:

| Track | Mechanism | Purpose |
|-------|-----------|---------| 
| React state | `useState` | Drives UI re-renders |
| Audio thread | `useRef` | Written by Tone.js callbacks without triggering re-renders |

**All context signals (React state):**

| Signal | Duration | Trigger |
|--------|----------|---------|
| `beatFlash` | ~100ms | Every quarter-note |
| `beatNumber` | persistent 1–4 | Updates on each beat |
| `barFlash` | ~200ms | Beat 1 of each bar (new bar boundary) |
| `hitFlash` | ~350ms | On-beat triage action (within ±280ms beat window) |
| `missFlash` | ~400ms | Bar ended with no on-beat action |
| `layerDownFlash` | ~500ms | A layer was dropped |
| `actionFlash` | ~100ms | **Every** triage keypress, regardless of beat timing |
| `beatIntervalMs` | constant | Quarter-note duration in ms at current BPM (833ms at 72 BPM) |

> **`actionFlash` vs `hitFlash`:** `hitFlash` is the *musical success* signal —
> it only fires if the action landed on the beat. `actionFlash` is a raw *input*
> signal — it fires on every single triage action. The game uses `actionFlash` to
> drive the bunny jump (so every keypress has immediate visual feedback) and
> `hitFlash` separately to mark obstacles as cleared and increment the score.

### Beat-window hit detection

`onTabAction()` is called by every triage action (keep / close / bookmark / group).
It always fires `actionFlash` (raw pulse for the game), then separately checks
whether the action landed inside the beat window:

```
HIT_WINDOW_AFTER_MS  = 280   ← user acted up to 280ms after a beat
HIT_WINDOW_BEFORE_MS = 180   ← user acted within 180ms before the next beat
BEAT_INTERVAL_MS     = (60 / bpm) * 1000   ← 833ms at 72 BPM
```

**Grace period:** if no beat has fired yet (`lastBeatWallTimeRef === null`, i.e., the
engine just started), the action is counted as a hit unconditionally.

### Progression logic (per bar)

```
End of bar fires onBarTickRef.current():
  ├─ hitThisBarRef was true? (user acted on-beat this bar)
  │   ├─ missStreak = 0
  │   ├─ hitStreak++
  │   └─ hitStreak >= hitsToAddLayer?
  │       └─ applyLayerCount(current + 1)  ← ramp up next layer's volume
  └─ hitThisBarRef was false? (no on-beat action this bar)
      ├─ hitStreak = 0
      ├─ missStreak++
      ├─ → fires missFlash (yellow dot, 400ms)
      └─ missStreak >= missesToLoseLayer?
          └─ applyLayerCount(current - 1)  ← ramp down top layer's volume
```

### Thread bridging: Tone.Draw

Tone.js runs on the Web Audio API's high-precision scheduler thread. React runs on
the main JS thread. `Tone.Draw.schedule(callback, time)` queues the callback
to fire on the first animation frame that arrives at or after the audio event time.

---

## Part 4: Beat Indicator UI (`RetroMonitor`)

### Visual states (CSS cascade, later rule wins)

| Priority | State | Color | Scale | Trigger |
|----------|-------|-------|-------|---------| 
| 1 (lowest) | Resting | Dim fg color, 25% opacity | 1× | Always |
| 2 | Beat pulse | `--monitor-beat` accent | 1.55× | Every quarter-note |
| 3 | Beat 1 pulse | `--monitor-beat` accent, stronger glow | 2.1× | Beat 1 of each bar |
| 4 | Bar flash | White-tinted `--monitor-beat` | 2.4× | Beat 1 (new bar) |
| 5 | Miss flash | Yellow `#c8a820` | 1.9× | Bar ends with no on-beat action |
| 6 | Hit flash | `--monitor-dot-green` | 2.3× | On-beat tab action |
| 7 (highest) | Layer-down flash | `--monitor-dot-red` | 2.6× | Layer dropped |

---

## Part 5: Rhythm Game (`RetroMonitorMusicGame`) — V2

### Overview

When music is enabled, the bottom status bar shows `RetroMonitorMusicGame`. This is a DOM-based
side-scrolling rhythm game. The bunny mascot runs on a ground line. One cactus-shaped obstacle scrolls in
from the right **per bar**. With `beatsToArrive=3`, the obstacle spawned on beat 1 arrives exactly on beat 4.

### Signal–mechanic mapping

| Signal | Fires when | Game effect |
|--------|-----------|-------------|
| `actionFlash` | Every triage keypress | **Bunny jumps** (unconditional) |
| `hitFlash` | Keypress was on-beat | **Nearest obstacle** → `cleared` state + streak++ |
| `barFlash` | Beat 1 of new bar | **Spawns one obstacle** (arrives on beat 4 of same bar) |
| `missFlash` | Bar ended with no on-beat action | Red screen flash + bunny shake + streak reset |

### Layer stage indicator

A small inline SVG shape in the top-right corner shows which music layer the user has unlocked:

| Stage | Layers active | Shape |
|-------|---------------|-------|
| 0 | Kick only | Horizontal line |
| 1 | + Hi-hat | Triangle |
| 2 | + Snare | Square |
| 3 | + Bass | Pentagon |
| 4 | + Pad melody | Hexagon |
| 5 | + Lead | Heptagon |
| 6 | + Vocal | Circle with inner dot |

---

## Part 6: `useBeat()` Hook

Consumer hook (`src/hooks/useBeat.js`) — all game and UI components should import
from here, not directly from `MusicProvider`.

```js
import { useBeat } from '../hooks/useBeat';

const {
  beatFlash,      // boolean — true ~100ms every quarter-note
  beatNumber,     // 1–4 — which beat in the bar
  barFlash,       // boolean — true ~200ms on beat 1
  hitFlash,       // boolean — true ~350ms after ON-BEAT action
  missFlash,      // boolean — true ~400ms when bar ends with no hit
  layerDownFlash, // boolean — true ~500ms when a layer drops
  actionFlash,    // boolean — true ~100ms after ANY triage action
} = useBeat();
```

---

## Quick Reference: Making Changes

### Change the rhythm of an instrument
Open the **Music Dev Studio** in the app settings, edit the pattern, copy the JSON, and paste it into `song1.js`. Alternatively, manually edit the `pattern` array in `song1.js`.

### Change how hard it is to progress
Edit `missesToLoseLayer` and `hitsToAddLayer` in `musicConfig.js`.

### Change a layer's default volume
Edit the `volume` field in `song1.js` for that layer.

### Change the instrument sound/timbre
Edit the `urls` property of the layer in `song1.js` to point to a new `.wav` or `.mp3` sample.

### Change the BPM
Edit the `bpm` field inside `song1.js` AND in `musicConfig.js`. The engine and game will automatically adjust their physics and transport speeds.

### Change the beat hit window
Edit `HIT_WINDOW_AFTER_MS` and `HIT_WINDOW_BEFORE_MS` at the top of `MusicProvider.jsx`. Wider = more forgiving; narrower = stricter rhythm-game feel.

### Tune game physics / obstacle difficulty
Edit the `game` block in `musicConfig.js`.

### Change beat dot colors / sizes
Edit the `.beatDot` rule family in `Monitor.module.css`.

### Change obstacle visual styles
Edit `MusicGame.module.css`.

### Add a new layer
In `song1.js`, add a new layer object to the `layers` array. The engine will automatically pick it up, it will appear in the progression sequence, and the Music Dev Studio will let you sequence it.
