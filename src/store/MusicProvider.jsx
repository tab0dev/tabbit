import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { MUSIC_CONFIG } from '../data/musicConfig';

const MusicContext = createContext(null);

// ─── Beat-window constants ────────────────────────────────────────────────────

// How long (ms) after a beat the user can still register an on-beat hit
const HIT_WINDOW_AFTER_MS  = 280;
// How close (ms) to the NEXT beat an early hit still counts
const HIT_WINDOW_BEFORE_MS = 180;
// Quarter-note duration at the fixed BPM (used for look-ahead)
const BEAT_INTERVAL_MS = (60 / MUSIC_CONFIG.bpm) * 1000; // 833ms at 72 BPM

// ─── localStorage helpers ─────────────────────────────────────────────────────

function resolveInitialMusic() {
  try {
    return localStorage.getItem('musicEnabled') === 'true';
  } catch { return false; }
}

function persistMusicEnabled(value) {
  try { localStorage.setItem('musicEnabled', String(value)); } catch { /* ignore */ }
}

// ─── MusicProvider ────────────────────────────────────────────────────────────

export function MusicProvider({ children }) {
  const [musicEnabled, setMusicEnabled] = useState(resolveInitialMusic);
  const [layerCount, setLayerCount] = useState(0);
  const [beatFlash, setBeatFlash] = useState(false);
  // beatNumber: 1–4 (which beat within the bar); 1 = downbeat
  const [beatNumber, setBeatNumber] = useState(1);
  // hitFlash: true for ~350ms after an on-beat successful action
  const [hitFlash, setHitFlash] = useState(false);
  // missFlash: true for ~400ms at bar-end when no on-beat action was taken
  const [missFlash, setMissFlash] = useState(false);
  // barFlash: true for ~200ms on beat 1 (new bar boundary)
  const [barFlash, setBarFlash] = useState(false);
  // layerDownFlash: true for ~500ms when a layer is actually dropped
  const [layerDownFlash, setLayerDownFlash] = useState(false);
  // actionFlash: true for ~100ms on every tab action
  const [actionFlash, setActionFlash] = useState(false);

  // ── Engine refs (never cause re-renders) ──────────────────────────────────
  const engineRef         = useRef(null);   // { players, barLoop, beatLoop }
  const bootedRef         = useRef(false);
  const bootingRef        = useRef(false);
  const fadeOutTimerRef       = useRef(null);   // 500ms fade-out stop
  const beatFlashTimerRef     = useRef(null);   // beat-flash off timer
  const hitFlashTimerRef      = useRef(null);   // success-flash off timer
  const missFlashTimerRef     = useRef(null);   // miss-flash off timer
  const barFlashTimerRef      = useRef(null);   // new-bar (beat-1) flash off timer
  const layerDownTimerRef     = useRef(null);   // layer-drop flash off timer
  const actionFlashTimerRef   = useRef(null);   // fires on EVERY tab action (drives game jump)

  // For beat-accurate hit detection: wall-clock time of the last beat getDraw call
  const lastBeatWallTimeRef = useRef(null);
  // Beat index 0–3 within the bar (0 = beat 1 / downbeat)
  const beatIndexRef = useRef(-1);

  // Mutable counters — written inside Tone callbacks, read by the tick function
  const layerCountRef  = useRef(0);
  const missStreakRef  = useRef(0);
  const hitStreakRef   = useRef(0);
  const hitThisBarRef  = useRef(false);

  // Stable ref to musicEnabled so onTabAction never needs to be recreated
  const musicEnabledRef = useRef(musicEnabled);
  useEffect(() => { musicEnabledRef.current = musicEnabled; }, [musicEnabled]);

  // A ref to the bar-tick function so the Tone.Loop never captures a stale closure
  const onBarTickRef = useRef(null);

  // ── Layer management ──────────────────────────────────────────────────────

  /**
   * Sets the active layer count (clamped 0 → max) and fades per-player volumes.
   * BPM is fixed — no ramping. Changing BPM would desync pre-recorded WAV loops.
   */
  const applyLayerCount = useCallback((count) => {
    const clamped = Math.max(0, Math.min(MUSIC_CONFIG.layers.length - 1, count));

    // Fire red flash when a layer actually drops during play
    if (clamped < layerCountRef.current) {
      if (layerDownTimerRef.current) clearTimeout(layerDownTimerRef.current);
      setLayerDownFlash(true);
      layerDownTimerRef.current = setTimeout(() => {
        setLayerDownFlash(false);
        layerDownTimerRef.current = null;
      }, 500);
    }

    layerCountRef.current = clamped;
    setLayerCount(clamped);

    // Fade each player in/out
    const engine = engineRef.current;
    if (!engine) return;
    engine.players.forEach((player, i) => {
      if (!player) return;
      const isActive  = i <= clamped;
      const targetVol = isActive ? MUSIC_CONFIG.layers[i].volume : -Infinity;
      // Short crossfade avoids clicks
      player.volume.rampTo(targetVol, isActive ? 0.5 : 0.2);
    });
  }, []); // stable — setLayerDownFlash is a stable setter, layerDownTimerRef is a ref

  // ── Bar-clock tick (evaluated at the end of every bar) ───────────────────

  // Assigned on every render so the Tone.Loop callback always calls the latest
  // version without needing to recreate the Loop object.
  onBarTickRef.current = () => {
    const hadHit = hitThisBarRef.current;
    hitThisBarRef.current = false; // reset for the next bar

    if (hadHit) {
      // ── Hit bar ────────────────────────────────────────────────────────────
      missStreakRef.current = 0;
      hitStreakRef.current += 1;

      if (hitStreakRef.current >= MUSIC_CONFIG.hitsToAddLayer) {
        hitStreakRef.current = 0;
        const next = layerCountRef.current + 1;
        if (next < MUSIC_CONFIG.layers.length) {
          applyLayerCount(next);
        }
        // Already at max layer — keep playing, nothing to unlock
      }
    } else {
      // ── Miss bar ──────────────────────────────────────────────────────────
      hitStreakRef.current = 0;
      missStreakRef.current += 1;

      // Fire yellow miss-flash at the end of every missed bar
      if (missFlashTimerRef.current) clearTimeout(missFlashTimerRef.current);
      setMissFlash(true);
      missFlashTimerRef.current = setTimeout(() => {
        setMissFlash(false);
        missFlashTimerRef.current = null;
      }, 400);

      if (missStreakRef.current >= MUSIC_CONFIG.missesToLoseLayer) {
        missStreakRef.current = 0;
        const prev = layerCountRef.current - 1;
        if (prev >= 0) {
          applyLayerCount(prev);
        }
        // Already at layer 0 (kick only) — keep it running, don't go silent
      }
    }
  };

  // ── Engine boot (lazy — only runs once, on first toggle-ON) ──────────────

  const bootEngine = useCallback(async () => {
    if (bootedRef.current || bootingRef.current) return;
    bootingRef.current = true;

    try {
      // unlock the Web Audio API context (requires a user gesture)
      await Tone.start();

      const transport = Tone.getTransport();
      transport.bpm.value     = MUSIC_CONFIG.bpm;
      transport.timeSignature = [MUSIC_CONFIG.beatsPerBar, 4];

      // Create all players — each resolves independently so a single bad file
      // doesn't block the whole engine.
      const players = await Promise.all(
        MUSIC_CONFIG.layers.map((layer, i) =>
          new Promise((resolve) => {
            try {
              const player = new Tone.Player({
                url:    layer.file,
                loop:   true,
                volume: i === 0 ? layer.volume : -Infinity,
                onload: () => resolve(player),
                onerror: (err) => {
                  console.warn(`[Music] Layer "${layer.id}" failed to load (will be silent):`, err);
                  resolve(null); // null = skip this slot gracefully
                },
              }).toDestination();

              // Sync to transport and schedule to start at position 0
              player.sync().start(0);
            } catch (err) {
              console.warn(`[Music] Could not create player for "${layer.id}":`, err);
              resolve(null);
            }
          })
        )
      );

      // Bar loop — fires once per bar, starting after the first bar completes.
      // Uses Tone.getDraw() to bridge the audio clock → React render thread.
      const barLoop = new Tone.Loop((time) => {
        Tone.getDraw().schedule(() => {
          onBarTickRef.current?.();
        }, time);
      }, '1m');
      barLoop.start('1m'); // grace period: first tick after bar 1 has elapsed

      // Beat loop — fires every quarter-note (4× per bar).
      // Drives the visual beat-pulse dot in the RetroMonitor and provides the
      // authoritative wall-clock timestamp used for on-beat hit detection.
      const beatLoop = new Tone.Loop((time) => {
        Tone.getDraw().schedule(() => {
          // Stamp wall-clock time for hit-window detection in onTabAction
          lastBeatWallTimeRef.current = performance.now();

          // Advance beat index (0–3) and expose beat number 1–4 to consumers
          const newIdx = (beatIndexRef.current + 1) % MUSIC_CONFIG.beatsPerBar;
          beatIndexRef.current = newIdx;
          setBeatNumber(newIdx + 1);

          // Beat 1 (bar boundary) — fire a bright bar-flash on top of the normal pulse
          if (newIdx === 0) {
            if (barFlashTimerRef.current) clearTimeout(barFlashTimerRef.current);
            setBarFlash(true);
            barFlashTimerRef.current = setTimeout(() => {
              setBarFlash(false);
              barFlashTimerRef.current = null;
            }, 200);
          }

          // Visual beat pulse — snap on, ease off
          if (beatFlashTimerRef.current) clearTimeout(beatFlashTimerRef.current);
          setBeatFlash(true);
          beatFlashTimerRef.current = setTimeout(() => {
            setBeatFlash(false);
            beatFlashTimerRef.current = null;
          }, 100);
        }, time);
      }, '4n');
      beatLoop.start(0); // phase-locked to beat 1 with no grace period

      engineRef.current  = { players, barLoop, beatLoop };
      bootedRef.current  = true;
    } catch (err) {
      console.error('[Music] Engine boot failed:', err);
    } finally {
      bootingRef.current = false;
    }
  }, []); // stable — everything accessed via refs or module constants

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggleMusic = useCallback(async () => {
    const next = !musicEnabled;
    setMusicEnabled(next);
    persistMusicEnabled(next);

    if (next) {
      // ── Turning ON ─────────────────────────────────────────────────────────
      // Cancel any pending fade-out stop (user toggled back on quickly)
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }

      await bootEngine();

      // Reset progression state
      layerCountRef.current = 0;
      missStreakRef.current  = 0;
      hitStreakRef.current   = 0;
      hitThisBarRef.current  = false;
      setLayerCount(0);

      // Reset beat-detection state so the first fired beat starts cleanly
      beatIndexRef.current       = -1;
      lastBeatWallTimeRef.current = null;

      const transport = Tone.getTransport();
      transport.bpm.value = MUSIC_CONFIG.bpm;

      // Ensure only layer 0 is audible; everything else stays muted
      const engine = engineRef.current;
      if (engine) {
        engine.players.forEach((player, i) => {
          if (!player) return;
          const vol = i === 0 ? MUSIC_CONFIG.layers[0].volume : -Infinity;
          player.volume.rampTo(vol, 0.3);
        });
      }

      transport.position = 0;
      transport.start();

    } else {
      // ── Turning OFF ────────────────────────────────────────────────────────
      const engine = engineRef.current;
      if (engine) {
        // Fade everything out, then stop the transport after the fade completes
        engine.players.forEach(p => p?.volume.rampTo(-Infinity, 0.4));
        fadeOutTimerRef.current = setTimeout(() => {
          Tone.getTransport().stop();
          Tone.getTransport().position = 0;
          fadeOutTimerRef.current = null;
        }, 500);
      }

      // reset UI state immediately so the footer button updates right away
      layerCountRef.current = 0;
      missStreakRef.current  = 0;
      hitStreakRef.current   = 0;
      setLayerCount(0);
      setHitFlash(false);     if (hitFlashTimerRef.current)  { clearTimeout(hitFlashTimerRef.current);  hitFlashTimerRef.current  = null; }
      setMissFlash(false);    if (missFlashTimerRef.current) { clearTimeout(missFlashTimerRef.current); missFlashTimerRef.current = null; }
      setBarFlash(false);     if (barFlashTimerRef.current)  { clearTimeout(barFlashTimerRef.current);  barFlashTimerRef.current  = null; }
      setLayerDownFlash(false); if (layerDownTimerRef.current) { clearTimeout(layerDownTimerRef.current); layerDownTimerRef.current = null; }
    }
  }, [musicEnabled, bootEngine]);

  // ── Public action hook ────────────────────────────────────────────────────

  /**
   * Called by useTriageActions after every valid tab action (keep, close,
   * bookmark, group, undo).
   *
   * Only registers a HIT if the action lands within the beat window
   * (HIT_WINDOW_AFTER_MS after a beat, or HIT_WINDOW_BEFORE_MS before the next).
   * Off-beat actions are silently ignored for progression purposes.
   *
   * On a valid on-beat hit, triggers a visual green success flash on the beat dot.
   */
  const onTabAction = useCallback(() => {
    if (!musicEnabledRef.current) return;

    // ── Always fire actionFlash on every action (drives bunny jump in game) ──
    // This fires regardless of beat timing — it's a raw action pulse.
    if (actionFlashTimerRef.current) clearTimeout(actionFlashTimerRef.current);
    setActionFlash(true);
    actionFlashTimerRef.current = setTimeout(() => {
      setActionFlash(false);
      actionFlashTimerRef.current = null;
    }, 100);

    const lastBeat = lastBeatWallTimeRef.current;

    // If no beat has fired yet (engine just started), be lenient and count it
    if (lastBeat === null) {
      hitThisBarRef.current = true;
      return;
    }

    const now          = performance.now();
    const sinceBeat    = now - lastBeat;
    const toNextBeat   = BEAT_INTERVAL_MS - sinceBeat;
    const isOnBeat     = sinceBeat < HIT_WINDOW_AFTER_MS || toNextBeat < HIT_WINDOW_BEFORE_MS;

    if (isOnBeat) {
      hitThisBarRef.current = true;

      // Visual success flash — overrides the beat dot color for ~350ms
      if (hitFlashTimerRef.current) clearTimeout(hitFlashTimerRef.current);
      setHitFlash(true);
      hitFlashTimerRef.current = setTimeout(() => {
        setHitFlash(false);
        hitFlashTimerRef.current = null;
      }, 350);
    }
    // Off-beat: no progression, no visual reward (the beat dot alone cues timing)
  }, []); // stable — everything accessed via refs/constants

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (fadeOutTimerRef.current)        clearTimeout(fadeOutTimerRef.current);
      if (beatFlashTimerRef.current)      clearTimeout(beatFlashTimerRef.current);
      if (hitFlashTimerRef.current)       clearTimeout(hitFlashTimerRef.current);
      if (missFlashTimerRef.current)      clearTimeout(missFlashTimerRef.current);
      if (barFlashTimerRef.current)       clearTimeout(barFlashTimerRef.current);
      if (layerDownTimerRef.current)      clearTimeout(layerDownTimerRef.current);
      if (actionFlashTimerRef.current)    clearTimeout(actionFlashTimerRef.current);
      const engine = engineRef.current;
      if (engine) {
        engine.barLoop?.dispose();
        engine.beatLoop?.dispose();
        engine.players.forEach(p => p?.dispose());
        Tone.getTransport().stop();
      }
    };
  }, []);

  return (
    <MusicContext.Provider value={{
      musicEnabled, toggleMusic, layerCount, onTabAction,
      beatFlash, beatNumber, barFlash,
      hitFlash, missFlash, layerDownFlash,
      actionFlash,
      beatIntervalMs: BEAT_INTERVAL_MS,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used within <MusicProvider>');
  return ctx;
}
