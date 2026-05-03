import React, { useRef } from 'react';
import styles from './Monitor.module.css';
import gameStyles from './MusicGame.module.css';
import BunnySprite from './BunnySprite';
import { useBeat } from '../../hooks/useBeat';
import { useMusicGame } from '../../hooks/useMusicGame';
import { MUSIC_CONFIG } from '../../data/musicConfig';

const GROUND_H = MUSIC_CONFIG.game?.groundHeight ?? 4;
const MAX_LAYERS = MUSIC_CONFIG.layers.length; // 7

/**
 * RetroMonitorMusicGame — V2
 *
 * ─── WHAT CHANGED FROM V1 ──────────────────────────────────────────────────────
 *   • One obstacle per BAR (not per beat). barFlash spawns it; it arrives on
 *     beat 4 so the snare is the natural jump cue.
 *   • Bar group clouds removed — no longer needed with single-obstacle-per-bar.
 *   • Layer stage indicator replaces score counter. Shows a geometric shape in
 *     the top-right corner that evolves as more music layers unlock (line →
 *     triangle → square → pentagon → hexagon → star → crown).
 *   • beatNumber passed to beatRing so beat 4 gets extra glow (jump cue).
 *
 * ─── VISUAL STRUCTURE ──────────────────────────────────────────────────────────
 *   Left edge  : beat ring glow + bunny runner (physics translateY)
 *   Ground     : 1px line
 *   Obstacles  : one cactus-shaped div per bar, scrolling right → left
 *   Top-right  : layer stage indicator (geometric SVG shape, 7 stages)
 *   Overlays   : collide flash, idle overlay, jump prompt
 */
export default function RetroMonitorMusicGame({
  theme            = 'gameboy',
  embedded         = false,
  bunnyVariant     = 'default',
  bunnyAccessories = [],
  hasUndo          = false,
}) {
  const beatData = useBeat();
  const { musicEnabled, beatFlash, beatNumber, layerCount } = beatData;

  const trackRef = useRef(null);
  const game     = useMusicGame({ ...beatData, trackRef });

  // Prompt disappears after the first on-beat action (streak > 0)
  const hasActed = game.streak > 0;

  function handleJump() { game.jump(); }

  // ─── Theme ──────────────────────────────────────────────────────────────────
  const themeClass =
    theme === 'calc'    ? styles.themeCalc :
    theme === 'darkula' ? styles.themeDarkula :
    styles.themeGameboy;

  return (
    <div
      className={[
        styles.monitorPanel,
        themeClass,
        embedded ? styles.embedded    : '',
        hasUndo  ? styles.adjacentUndo : '',
      ].filter(Boolean).join(' ')}
    >
      <div
        ref={trackRef}
        className={`${styles.monitorScreen} ${gameStyles.gameScreen}`}
        style={{ '--game-ground-h': `${GROUND_H}px` }}
        onClick={handleJump}
        tabIndex={0}
        role="application"
        aria-label="Rhythm game — triage to jump"
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); handleJump(); }
        }}
      >
        {/* ── Beat run-lane glow — extra-bright on beat 4 (jump cue) ──────── */}
        <div
          className={gameStyles.beatRing}
          data-active={beatFlash && musicEnabled ? 'true' : 'false'}
          data-beat={beatNumber}
          aria-hidden="true"
        />

        {/* ── Ground line ───────────────────────────────────────────────── */}
        <div className={gameStyles.ground} aria-hidden="true" />

        {/* ── Bunny runner ──────────────────────────────────────────────── */}
        <div
          className={gameStyles.bunnyRunner}
          style={{ transform: `translateY(${-game.bunnyY}px)` }}
          aria-hidden="true"
        >
          <BunnySprite
            size={22}
            mood={game.bunnyMood}
            animation={game.bunnyAnimation}
            variant={bunnyVariant}
            accessories={bunnyAccessories}
          />
        </div>

        {/* ── Obstacles (one cactus per bar) ────────────────────────────── */}
        {game.obstacles.map((obs) => (
          <div
            key={obs.id}
            className={gameStyles.obstacle}
            data-passed={obs.passed ? 'true' : 'false'}
            data-cleared={obs.cleared && !obs.passed ? 'true' : 'false'}
            style={{
              transform: `translateX(${obs.x}px)`,
              height:    `${obs.height}px`,
              width:     `${obs.width}px`,
              '--obs-h': `${obs.height}px`,
            }}
            aria-hidden="true"
          />
        ))}

        {/* ── Layer stage indicator ─────────────────────────────────────── */}
        {/*
         * Shows a small geometric shape in the top-right corner indicating
         * which music layer the user has unlocked. Each stage adds complexity
         * to the shape — a gentle reminder of musical progress without score pressure.
         *
         * Stage 0 = just kick playing (single line / dash)
         * Stage 1 = triangle   (hi-hat earned)
         * Stage 2 = square     (snare earned)
         * Stage 3 = pentagon   (bass earned)
         * Stage 4 = hexagon    (pad melody earned)
         * Stage 5 = heptagon   (lead earned)
         * Stage 6 = star/ring  (vocal earned — full band)
         */}
        {musicEnabled && (
          <LayerStageIcon
            stage={layerCount}
            maxStages={MAX_LAYERS - 1}
            className={gameStyles.stageIcon}
          />
        )}

        {/* ── Collision flash overlay ────────────────────────────────────── */}
        <div
          className={gameStyles.collideFlash}
          data-active={game.colliding ? 'true' : 'false'}
          aria-hidden="true"
        />

        {/* ── Jump prompt (until first on-beat action) ───────────────────── */}
        {musicEnabled && !hasActed && (
          <div className={gameStyles.jumpPrompt} aria-hidden="true">
            triage to jump
          </div>
        )}

        {/* ── Idle overlay ───────────────────────────────────────────────── */}
        {!musicEnabled && (
          <div className={gameStyles.idleOverlay} aria-label="Music is off">
            ♪ turn on music
          </div>
        )}

      </div>
    </div>
  );
}

// ─── LayerStageIcon ───────────────────────────────────────────────────────────

/**
 * Renders a tiny inline SVG polygon that grows in complexity with the stage.
 *
 * stage 0 → horizontal line (dash) — minimal, just kick
 * stage 1 → triangle
 * stage 2 → square
 * stage 3 → pentagon
 * stage 4 → hexagon
 * stage 5 → heptagon
 * stage 6 → circle with inner ring (full band / "star" feel)
 */
function LayerStageIcon({ stage, className }) {
  const SIZE = 10; // SVG viewBox size
  const CX   = 5;
  const CY   = 5;
  const R    = 4;

  let shape;
  if (stage === 0) {
    // Single horizontal dash — "just started"
    shape = <line x1="1" y1="5" x2="9" y2="5" strokeWidth="1.5" strokeLinecap="round" />;
  } else if (stage >= 6) {
    // Full circle with inner dot — full band unlocked
    shape = (
      <>
        <circle cx={CX} cy={CY} r={R} fill="none" strokeWidth="1.2" />
        <circle cx={CX} cy={CY} r="1.5" />
      </>
    );
  } else {
    // polygon: sides = stage + 2  (stage 1→tri, 2→square, 3→pent, 4→hex, 5→hept)
    const sides = stage + 2;
    const pts   = Array.from({ length: sides }, (_, i) => {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
      return `${(CX + R * Math.cos(angle)).toFixed(2)},${(CY + R * Math.sin(angle)).toFixed(2)}`;
    }).join(' ');
    shape = <polygon points={pts} fill="none" strokeWidth="1.2" />;
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {shape}
    </svg>
  );
}
