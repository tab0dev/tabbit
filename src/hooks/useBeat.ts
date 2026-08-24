import { useMusic } from '../store/music/MusicProvider';

/**
 * useBeat
 *
 * Thin consumer hook so components don't import directly from MusicProvider.
 *
 * Returns:
 *   beatFlash      — boolean, true ~100ms every quarter-note
 *   beatNumber     — 1–4, which beat within the bar (1 = downbeat)
 *   barFlash       — boolean, true ~200ms on beat 1 (new bar boundary)
 *   hitFlash       — boolean, true ~350ms after an on-beat tab action (green)
 *   missFlash      — boolean, true ~400ms when a bar ends with no on-beat action (yellow)
 *   layerDownFlash — boolean, true ~500ms when a layer is dropped (red)
 *   musicEnabled   — boolean, whether the music engine is running
 */
export interface BeatStats {
  beatFlash: boolean;
  beatNumber: number;
  barFlash: boolean;
  hitFlash: boolean;
  missFlash: boolean;
  layerDownFlash: boolean;
  musicEnabled: boolean;
  beatIntervalMs: number;
  actionFlash: boolean;
  layerCount: number;
}

export function useBeat(): BeatStats {
  const {
    beatFlash,
    beatNumber,
    barFlash,
    hitFlash,
    missFlash,
    layerDownFlash,
    musicEnabled,
    beatIntervalMs,
    actionFlash,
    layerCount,
  } = useMusic();
  return {
    beatFlash,
    beatNumber,
    barFlash,
    hitFlash,
    missFlash,
    layerDownFlash,
    musicEnabled,
    beatIntervalMs,
    actionFlash,
    layerCount,
  };
}
