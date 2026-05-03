/**
 * musicConfig.js — The single editable source of truth for the music engine.
 *
 * HOW TO EDIT:
 *  - Change the fixed BPM      → edit `bpm` (then re-run: pnpm run gen-audio)
 *  - Change difficulty          → edit `missesToLoseLayer` or `hitsToAddLayer`
 *  - Swap audio files           → edit `file` paths in `layers[]`
 *  - Add a new layer            → push a new object into `layers[]` and add its
 *                                 generator to gen-audio.cjs, then re-run gen-audio
 *  - Fix a track being too loud → edit its `volume` (in dB, 0 = unity, -∞ = silent)
 */

export const MUSIC_CONFIG = {
  // ─── Timing ──────────────────────────────────────────────────────────────

  /** Time signature numerator (4 = 4/4 time) */
  beatsPerBar: 4,

  /**
   * Fixed playback BPM. All WAV loops are generated at this tempo.
   * ⚠️  If you change this, you MUST re-run `pnpm run gen-audio` to regenerate
   *     the audio files — otherwise the rhythmic events inside the loops will
   *     shift to wrong beat positions and the tracks will sound out of sync.
   */
  bpm: 72,

  // ─── Progression ─────────────────────────────────────────────────────────

  /**
   * How many consecutive bars with NO tab action before losing one layer.
   * e.g. 3 = you have 3 full bars of silence before you drop a layer.
   */
  missesToLoseLayer: 3,

  /**
   * How many hit-bars are needed to earn the NEXT layer.
   * 1 = every bar you act in adds a layer immediately.
   * Increase to require more sustained activity per level.
   */
  hitsToAddLayer: 1,

  // ─── Layers ──────────────────────────────────────────────────────────────

  /**
   * Audio layers in order of unlock.
   *
   * layers[0] → starts playing immediately when the toggle turns ON (always-on base)
   * layers[1] → earned after the 1st hit bar
   * layers[2] → earned after the 2nd hit bar
   * ...and so on up to layers[6] (full song, all 7 layers active).
   *
   * Fields:
   *   id      – unique string key (used for debugging)
   *   label   – human-readable name
   *   file    – path relative to /public (e.g. '/audio/kick_loop.wav')
   *   volume  – initial gain in dB (0 = unity, -6 = half power, -Infinity = mute)
   *
   * File requirements:
   *   All loops MUST be the same bar-length and generated at the same BPM as `bpm`
   *   above. Re-run `pnpm run gen-audio` after adding or changing any files here.
   */
  // ─── Game ──────────────────────────────────────────────────────────────────

  /**
   * Config block consumed by RetroMonitorMusicGame / useMusicGame.
   * All values are optional — useMusicGame falls back to built-in defaults
   * if this key is absent, so you can safely omit it.
   *
   * Physics are normalised to 60 fps internally; actual frame-rate does not
   * affect gameplay (dt-scaled integration).
   */
  game: {
    /** Upward velocity in px/frame (60 fps reference) at jump onset. */
    jumpVelocity: 7,
    /** Downward acceleration in px/frame² (60 fps reference). */
    gravity: 0.45,
    /**
     * V2: Obstacle spawns on barFlash (beat 1 of bar N) and travels 3 beats,
     * arriving at BUNNY_LEFT on beat 4 of the same bar — exactly on the snare.
     * The music itself becomes the jump cue.
     */
    beatsToArrive: 3,
    /** Obstacle width (px) — wider for better readability at small screen sizes. */
    obstacleWidth: 5,
    /** Obstacle height range (px) — taller for better readability. */
    obstacleHeightMin: 8,
    obstacleHeightMax: 14,
    /** Pixels from the bottom of the game track to the ground line. */
    groundHeight: 4,
    /**
     * Collision-box leniency (px per side).
     * Increase for a more forgiving hit window.
     */
    collisionSlop: 3,
  },

  // ─── Layers ──────────────────────────────────────────────────────────────

  layers: [
    {
      id: 'kick',
      label: 'Kick / Percussion',
      file: '/audio/kick_loop.wav',
      volume: -6,
    },
    {
      id: 'hihat',
      label: 'Hi-Hat',
      file: '/audio/hihat_loop.wav',
      volume: -10,
    },
    {
      id: 'snare',
      label: 'Snare',
      file: '/audio/snare_loop.wav',
      volume: -8,
    },
    {
      id: 'bass',
      label: 'Bass Line',
      file: '/audio/bass_loop.wav',
      volume: -9,
    },
    {
      id: 'melody',
      label: 'Pad Melody',
      file: '/audio/melody_loop.wav',
      volume: -11,
    },
    {
      id: 'lead',
      label: 'Lead Melody',
      file: '/audio/lead_loop.wav',
      volume: -10,
    },
    {
      id: 'vocal',
      label: 'Vocal Hum',
      file: '/audio/vocal_loop.wav',
      volume: -9,
    },
  ],
};
