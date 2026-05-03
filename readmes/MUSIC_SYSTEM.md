# Music System — Technical Reference

## Overview

Tabbit has a background music system that reacts to user triage activity. It starts
quiet (just a kick drum) and progressively layers in additional instruments as the
user works through their tabs. Stop working → layers fade back out.

The system has **four completely separate concerns** that must never be confused:

| Concern | Where | When |
|---------|-------|------|
| **Audio synthesis** — generating the actual sound files | `scripts/gen-audio.cjs` | Offline (developer runs this) |
| **Audio playback engine** — playing and mixing the files | `src/store/MusicProvider.jsx` | Runtime (in the browser/extension) |
| **Beat indicator UI** — visual feedback dot in the monitor | `src/components/Monitor/RetroMonitor.jsx` | Runtime (reads from MusicProvider context) |
| **Rhythm game UI** — side-scroller game shown when music is on | `src/components/Monitor/RetroMonitorMusicGame.jsx` | Runtime (reads from MusicProvider context) |
| **Shared configuration** | `src/data/musicConfig.js` | Both (runtime reads it; generator must stay manually aligned) |

---

## File Map

```
scripts/
  gen-audio.cjs           ← Node.js step-sequencer that writes WAV files
                            Run with: pnpm run gen-audio

public/
  audio/
    kick_loop.wav         ← Layer 0: always playing when music is on
    hihat_loop.wav        ← Layer 1: earned after 1st hit bar
    snare_loop.wav        ← Layer 2
    bass_loop.wav         ← Layer 3
    melody_loop.wav       ← Layer 4
    lead_loop.wav         ← Layer 5
    vocal_loop.wav        ← Layer 6: final, sparsest layer

src/
  data/
    musicConfig.js        ← Runtime config: BPM, layers, progression rules, game physics
  store/
    MusicProvider.jsx     ← React context + Tone.js engine + beat/action signal state
  hooks/
    useTriageActions.js   ← Calls onTabAction() after every triage action
    useBeat.js            ← Consumer hook for all beat/action signals
    useMusicGame.js       ← Game state hook (obstacles, physics, score, collision)
  components/Card/
    CardFooter.jsx        ← SpeakerHigh/SpeakerSlash toggle in the footer bar
    SettingsCard.jsx      ← Secondary toggle in settings panel
  components/Monitor/
    RetroMonitor.jsx      ← Standard bunny monitor with beat indicator dot
    RetroMonitorMusicGame.jsx ← Rhythm game monitor (shown when music is on)
    Monitor.module.css    ← Beat dot styles and flash state CSS
    MusicGame.module.css  ← Game-specific: obstacles, ground, bunny runner, overlays
  components/Dashboard/
    BottomStatusBar.jsx   ← Switches between hotkeys bar ↔ monitor/game on toggle
```

---

## Part 1: Audio Generation (`gen-audio.cjs`)

### The fundamental constraint: everything must be grid-locked

All 7 WAV files are **2-bar loops at 72 BPM**. They must all be exactly the same
length in samples so that Tone.js can loop them in phase. Any drift between files
causes the instruments to progressively desync.

The generator uses an **integer 16th-note step sequencer** to guarantee this:

```js
const TOTAL_SAMPLES = TOTAL_STEPS * STEP;  // exact — no floating-point rounding
```

Every note's start position is `step * STEP` samples. Every note's duration is
`len * STEP` samples. Because everything is integer multiples of `STEP`, every
track's loop boundary lands on the exact same sample.

### The step grid

```
Steps: 0  1  2  3 | 4  5  6  7 | 8  9 10 11 |12 13 14 15 |16 17 18 19 |20 21 22 23 |24 25 26 27 |28 29 30 31
Beat:  1  +  &  a | 2  +  &  a | 3  +  &  a | 4  +  &  a | 1  +  &  a | 2  +  &  a | 3  +  &  a | 4  +  &  a
Bar:   [──────────────────────── Bar 1 ────────────────────────────][──────────────────────── Bar 2 ────────────────────────────]
```

**Duration reference (in steps):**

| Duration | Steps |
|----------|-------|
| Whole note | 16 |
| Half note | 8 |
| Dotted quarter | 6 |
| Quarter note | 4 |
| Dotted 8th | 3 |
| 8th note | 2 |
| 16th note | 1 |

### Current patterns (2-bar, A minor)

| Layer | File | Pattern style |
|-------|------|---------------|
| Kick | `kick_loop.wav` | Steps 0, 8, 16, 24 (beats 1 & 3 each bar) |
| Hi-hat | `hihat_loop.wav` | Every 2 steps (all 8ths), open hat at steps 6 & 22 |
| Snare | `snare_loop.wav` | Steps 4, 12, 20, 28 (beats 2 & 4 each bar) |
| Bass | `bass_loop.wav` | A2/G2/E2/C3 groove; see `BASS_PATTERN` |
| Pad melody | `melody_loop.wav` | Gentle A minor pad; see `MELODY_PATTERN` |
| Lead melody | `lead_loop.wav` | Saxophone-style; see `LEAD_PATTERN` |
| Vocal | `vocal_loop.wav` | Short "ah" one-shots at steps 0 & 16 only |

### Timbre design

Each instrument uses additive synthesis (summed sine waves) with an ADSR envelope.
Key design choices:

- **Kick:** pitch-glide sweep (150 Hz → 50 Hz) + transient click
- **Hi-hat:** bandpassed noise + two metallic sine partials (5200 Hz, 7000 Hz)
- **Snare:** noise burst + drum body tone (185 Hz) + click
- **Bass:** fundamental + 2nd/3rd harmonics, tanh soft-clip overdrive
- **Pad:** two slightly-detuned sines + 2nd harmonic; slow attack (15ms)
- **Lead:** warm overtone series (fx4 harmonics); saxophone/muted-trumpet feel; slow attack (20ms)
- **Vocal:** short "ah" (2 steps ≈ 0.42s); breathy noise consonant + 3-harmonic vowel (A3, 220 Hz)

### Adding a new layer

1. Add a `generateXxx()` function in `gen-audio.cjs` using `renderNote()` + a pattern array
2. Call `writeWav(path.join(outDir, 'xxx_loop.wav'), generateXxx())` in the Generate block
3. Add an entry to `MUSIC_CONFIG.layers` in `musicConfig.js` (with matching file path)
4. Run `pnpm run gen-audio`
5. Done — the engine will automatically pick up the new layer

---

## Part 2: Runtime Config (`musicConfig.js`)

```js
export const MUSIC_CONFIG = {
  beatsPerBar: 4,         // time signature numerator
  bpm: 72,                // FIXED — must match gen-audio.cjs BPM constant
  missesToLoseLayer: 3,   // bars of inactivity before dropping a layer
  hitsToAddLayer: 1,      // hit bars needed to earn the next layer
  game: { ... },          // optional — game physics/tuning (see Part 5)
  layers: [ ... ],        // ordered layer definitions (see file)
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
    │       ├─ Create Tone.Player × 7   (loads WAV buffers via Promise.all)
    │       ├─ Create Tone.Loop('1m')   ← bar clock, starts after 1st bar grace period
    │       └─ Create Tone.Loop('4n')   ← beat clock, starts immediately at position 0
    │
    ├─ ON: transport.start() → all players begin (layer 0 audible, rest at -∞ dB)
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

The bar-tick function is re-assigned to `onBarTickRef.current` on every React render
(not a `useCallback`). This means the Tone.Loop always calls the latest version
without needing to be recreated when deps change.

### Beat-window hit detection

`onTabAction()` is called by every triage action (keep / close / bookmark / group).
It always fires `actionFlash` (raw pulse for the game), then separately checks
whether the action landed inside the beat window:

```
HIT_WINDOW_AFTER_MS  = 280   ← user acted up to 280ms after a beat
HIT_WINDOW_BEFORE_MS = 180   ← user acted within 180ms before the next beat
BEAT_INTERVAL_MS     = (60 / bpm) * 1000   ← 833ms at 72 BPM
```

```js
// Always fires (raw input pulse for the game):
setActionFlash(true);  → clears after 100ms

// Only fires if on-beat:
const isOnBeat = sinceBeat < HIT_WINDOW_AFTER_MS || toNextBeat < HIT_WINDOW_BEFORE_MS;
if (isOnBeat) {
  hitThisBarRef.current = true;
  setHitFlash(true);  → clears after 350ms
}
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
  │       └─ applyLayerCount(current + 1)  ← fade in next layer
  └─ hitThisBarRef was false? (no on-beat action this bar)
      ├─ hitStreak = 0
      ├─ missStreak++
      ├─ → fires missFlash (yellow dot, 400ms)
      └─ missStreak >= missesToLoseLayer?
          └─ applyLayerCount(current - 1)  ← fade out top layer + fires layerDownFlash (red, 500ms)
                                             (never goes below 0 — kick always plays)
```

### Thread bridging: Tone.getDraw()

Tone.js runs on the Web Audio API's high-precision scheduler thread. React runs on
the main JS thread. `Tone.getDraw().schedule(callback, time)` queues the callback
to fire on the first animation frame that arrives at or after the audio event time.
This is used for:

- The bar loop → calls `onBarTickRef.current()` for progression logic
- The beat loop → stamps `lastBeatWallTimeRef`, updates `beatNumber`, fires `beatFlash` and `barFlash`

### Key correctness properties

- `bootEngine()` only runs once (guarded by `bootedRef` + `bootingRef`)
- `onTabAction` is fully stable (deps: `[]`) — uses refs for everything it reads
- All flash timers are individually stored in refs and cleared on toggle-OFF and unmount
- `beatIndexRef` and `lastBeatWallTimeRef` are reset on every toggle-ON so the beat
  counter restarts from beat 1 cleanly

---

## Part 4: Beat Indicator UI (`RetroMonitor`)

### Overview

A small dot in the **left (bunny) panel of the `RetroMonitor`** pulses in sync with
the audio transport. It is always phase-locked to the music — driven by the same
`Tone.Loop('4n')` that stamps `lastBeatWallTimeRef` — not by `setInterval` or
animation frames.

The dot only renders when `musicEnabled` is true. When music is enabled, the
bottom status bar shows `RetroMonitorMusicGame` instead (see Part 5). The beat dot
is still used in any other monitor contexts.

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

### Theme accent colors (`--monitor-beat`)

| Theme | Color |
|-------|-------|
| `gameboy` | `#3daa10` (bright green) |
| `calc` | `#1a8878` (teal) |
| `darkula` | `#a89be0` (lavender) |

---

## Part 5: Rhythm Game (`RetroMonitorMusicGame`) — V2

### Overview

When music is enabled, the bottom status bar's "monitor" face shows
`RetroMonitorMusicGame` instead of `RetroMonitor`. This is a DOM-based
side-scrolling rhythm game rendered inside the same CRT shell.

The bunny mascot runs on a ground line. One cactus-shaped obstacle scrolls in
from the right **per bar** — not per beat. With `beatsToArrive=3`, the obstacle
spawned on beat 1 arrives exactly on beat 4, where the snare plays. The music
itself is the jump cue. The player interacts purely through their normal triage
workflow — no separate game controls are needed.

**Core V2 rule:** one obstacle = one decision. Exactly like Chrome Dino.

### Data flow

```
BottomStatusBar
  └─ musicEnabled?
        ├─ YES → <RetroMonitorMusicGame>
        │           └─ useBeat()           ← reads all signals from MusicProvider
        │               └─ useMusicGame()  ← game state hook
        └─ NO  → <RetroMonitor>
```

### Signal–mechanic mapping (V2)

| Signal | Fires when | Game effect |
|--------|-----------|-------------|
| `actionFlash` | Every triage keypress | **Bunny jumps** (unconditional) |
| `hitFlash` | Keypress was on-beat | **Nearest obstacle** → `cleared` state + streak++ |
| `barFlash` | Beat 1 of new bar | **Spawns one obstacle** (arrives on beat 4 of same bar) |
| `beatFlash` | Every quarter-note | Beat ring glow only (no spawning in V2) |
| `missFlash` | Bar ended with no on-beat action | Red screen flash + bunny shake + streak reset |
| `layerDownFlash` | Layer dropped | Longer red screen flash |

### One obstacle per bar — V2 spawn model

```
barFlash fires (beat 1 of bar N)  →  ONE cactus spawns at right edge
                                       travels for 3 beats (beatsToArrive=3)
beatFlash fires (beat 4 of bar N) →  cactus arrives at BUNNY_LEFT
                                       snare hits — this is the jump cue
  ├─ user acted on-beat (hitFlash) →  cactus cleared ✓ + streak++
  └─ no on-beat action             →  collision check on bar N+1 beat 1
barFlash fires (beat 1 of bar N+1) → next cactus spawns
```

The `barId` grouping system from V1 has been removed. Each obstacle is a standalone
object with no bar group affiliation.

### Cactus shape

The obstacle is styled as a minimal cactus silhouette using CSS:
- Main `div` = narrow 5px stem
- `::before` = left arm (6px wide horizontal bar + upward tip via `box-shadow`)
- `::after`  = right arm (same, offset slightly higher)

Total visual footprint ~17px wide at 8–14px height — readable as a cactus at
the small CRT panel size.

### Layer stage indicator

Replaces the V1 score counter. A small inline SVG shape in the top-right corner
shows which music layer the user has unlocked. The shape gains complexity with
each stage, matching the music growing richer:

| Stage | Layers active | Shape |
|-------|---------------|-------|
| 0 | Kick only | Horizontal line |
| 1 | + Hi-hat | Triangle |
| 2 | + Snare | Square |
| 3 | + Bass | Pentagon |
| 4 | + Pad melody | Hexagon |
| 5 | + Lead | Heptagon |
| 6 | + Vocal (full band) | Circle with inner dot |

This is a *status* indicator, not a score. The goal is that users notice the
shape getting more complex as they work through tabs, not that they try to
maximize a number.

### Beat-4 glow cue

The beat ring on the left edge glows extra-bright on beat 4 (`data-beat='4'`
CSS attribute). Beat 4 is when the snare fires and when the incoming obstacle
reaches the jump zone. This is a subtle environmental cue — not a tutorial
prompt — consistent with the "forget you're triaging" philosophy.

### Obstacle states

| State | Appearance | Collision |
|-------|-----------|-----------|
| **Active** (approaching) | Full opacity + CRT glow | ✓ bunny must be airborne |
| **Cleared** (hitFlash — on-beat action) | Fades to 12% opacity, no glow | ✗ bypasses collision entirely |
| **Passed** (scrolled behind bunny) | 5% opacity | N/A — pruned from array shortly |

Transitions use `opacity 240ms ease` so clearing feels like a satisfying "pop".

### Obstacle timing

One obstacle spawns per `barFlash`. The scroll speed is computed from
`beatIntervalMs` so the obstacle's left edge reaches `BUNNY_LEFT` exactly
`beatsToArrive` beats after it spawned:

```
speed (px/ms) = (trackWidth - BUNNY_LEFT) / (beatsToArrive × beatIntervalMs)
```

With `beatsToArrive = 3`, an obstacle spawned on beat 1 of bar N arrives at the
jump zone on beat 4 of bar N — exactly on the snare.

### Collision mechanics

Geometric X/Y collision is active for **uncleared** obstacles only:

```
overlapX    = bunny right edge > (obs.x − slop) AND bunny left < (obs.x + width + slop)
bunnyClears = bunnyY >= (obstacleHeight − slop)   // feet above obstacle top
collide if: overlapX AND NOT bunnyClears AND NOT invincible AND NOT obs.cleared
```

After a collision there is a `600ms` invincibility window. The red screen flash
(`collideFlash`) plays for 300ms.

**Timing consequence:** acting too early → bunny jumps, peaks, and lands before the
obstacle arrives → on-ground collision. On-beat (`hitFlash`) → entire bar cleared →
no geometry check at all.

### Jump physics

Physics are dt-scaled (normalised to 60 fps):

```
velY += jumpVelocity           // at jump onset
velY -= gravity × (dt / 16.67) // each frame
posY += velY  × (dt / 16.67)  // each frame
if posY <= 0: land
```

Default values (tunable in `musicConfig.js game block`):

| Parameter | Default | Effect |
|-----------|---------|--------|
| `jumpVelocity` | 6 px/frame | Arc height |
| `gravity` | 0.5 px/frame² | Arc duration (~400ms air time) |
| `beatsToArrive` | 4 | Obstacle travel time in beats |
| `obstacleHeightMin/Max` | 5–9 px | Obstacle height range |
| `collisionSlop` | 2 px | Collision leniency |

> **Note on BunnySprite animation:** The game never sets `animation='jump'` on
> the BunnySprite. The `animJump` keyframe uses `animation-fill-mode: forwards`
> and freezes the sprite's wrapper at `translateY(0)` after 0.55 s, which would
> cancel the physics `translateY` on the parent `.bunnyRunner` div. Only `'shake'`
> (horizontal rotate) and `'pulse'` (scale) are used — neither touches the Y axis.

### Tuning the game via `musicConfig.js`

All game constants live in the optional `game` block. The hook falls back to
built-in defaults if the block is absent:

```js
// musicConfig.js
game: {
  jumpVelocity:      7,    // px/frame upward at jump onset (60 fps reference)
  gravity:           0.45, // px/frame² downward (60 fps reference)
  beatsToArrive:     3,    // beats until obstacle reaches jump zone after barFlash
  obstacleWidth:     5,    // px (narrow cactus stem)
  obstacleHeightMin: 8,    // px
  obstacleHeightMax: 14,   // px
  groundHeight:      4,    // px from track bottom
  collisionSlop:     3,    // px leniency per side
},
```

### Streak (replaces score)

The game tracks a consecutive-hit streak. `hitFlash` increments it; `missFlash`
or a geometric collision resets it to 0. The streak is not displayed numerically —
the layer stage icon is the primary progress indicator. The streak is used internally
to drive bunny mood and animation state.

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
  musicEnabled,   // boolean
  beatIntervalMs, // number — quarter-note duration in ms (833ms @ 72 BPM)
  layerCount,     // number — current active layer index (0–6)
} = useBeat();
```

---

## Quick Reference: Making Changes

### Change the rhythm of an instrument
Edit the `BASS_PATTERN` / `MELODY_PATTERN` / `LEAD_PATTERN` const in `gen-audio.cjs`.
`{ step: <0-31>, note: '<name>', len: <1-32> }`. Run `pnpm run gen-audio`.

### Change how hard it is to progress
Edit `missesToLoseLayer` and `hitsToAddLayer` in `musicConfig.js`. No audio regen needed.

### Change a layer's volume
Edit `volume` in the matching `layers[]` entry in `musicConfig.js`. No audio regen needed.

### Change the instrument sound/timbre
Edit the generator function (`generateBass`, `generateLead`, etc.) in `gen-audio.cjs`.
Run `pnpm run gen-audio`.

### Change the BPM
Edit **both** `BPM = 72` in `gen-audio.cjs` **and** `bpm: 72` in `musicConfig.js`
to the same value. Run `pnpm run gen-audio`. Both must match or tracks will drift.
The beat indicator and game scroll speed automatically adapt (both derive from
`beatIntervalMs` at runtime).

### Change the beat hit window
Edit `HIT_WINDOW_AFTER_MS` and `HIT_WINDOW_BEFORE_MS` at the top of `MusicProvider.jsx`.
No audio regen needed. Wider = more forgiving; narrower = stricter rhythm-game feel.

### Tune game physics / obstacle difficulty
Edit the `game` block in `musicConfig.js`. No audio regen needed. See Part 5 table above.

### Change beat dot colors / sizes
Edit the `.beatDot` rule family in `Monitor.module.css`. Per-theme accent colors
are the `--monitor-beat` CSS custom properties defined on each theme class.

### Change obstacle visual styles
Edit `MusicGame.module.css`. The `.obstacle`, `.obstacle[data-cleared='true']`, and
`.obstacle[data-passed='true']` rules control appearance. All colors inherit from
`--monitor-fg` so they adapt to the three CRT themes automatically.

### Add a new layer
See "Adding a new layer" in Part 1 above.
