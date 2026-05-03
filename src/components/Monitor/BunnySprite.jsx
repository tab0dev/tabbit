import React from 'react';
import styles from './BunnySprite.module.css';

// ─── Sprite registry ────────────────────────────────────────────────────────
//
// Structure: SPRITE_REGISTRY[variant][mood] → imported SVG URL
//
// Each "variant" is a pre-rendered colour / skin of the bunny.
// Each "mood" is a different emotional expression for that variant.
//
// When a combination doesn't exist yet (file not drawn), the component falls
// back automatically:
//   registry[variant][mood]
//     → registry.default[mood]
//       → registry.default.idle
//
// To add a new variant or mood: import the SVG here and slot it in.
// Zero changes needed anywhere else in the codebase.
//
// ─── Only `default / idle` is real today; everything else is undefined (→ fallback) ──

import spriteDefaultIdle from '../../assets/rabbit/sprite-v1.svg';
import spriteWhiteIdle from '../../assets/rabbit/sprite-v1-white.svg';

// Future imports — uncomment + add the files to src/assets/rabbit/ when ready:
// import spriteDefaultHappy    from '../../assets/rabbit/default/sprite-happy.svg';
// import spriteDefaultSad      from '../../assets/rabbit/default/sprite-sad.svg';
// import spriteDefaultSleeping from '../../assets/rabbit/default/sprite-sleeping.svg';
// import spriteDefaultExcited  from '../../assets/rabbit/default/sprite-excited.svg';
// import spritePinkIdle        from '../../assets/rabbit/pink/sprite-idle.svg';
// import spritePinkHappy       from '../../assets/rabbit/pink/sprite-happy.svg';
// import spriteGreyIdle        from '../../assets/rabbit/grey/sprite-idle.svg';

/**
 * SPRITE_REGISTRY
 *
 * 2-D map: { [variant]: { [mood]: svgUrl } }
 *
 * Any undefined slot is filled in at lookup time via the fallback chain.
 *
 * @type {Record<string, Partial<Record<string, string>>>}
 */
const SPRITE_REGISTRY = {
  default: {
    idle:     spriteDefaultIdle,
    // happy:    spriteDefaultHappy,
    // sad:      spriteDefaultSad,
    // sleeping: spriteDefaultSleeping,
    // excited:  spriteDefaultExcited,
  },
  white: {
    idle:     spriteWhiteIdle,
  },
  // pink: {
  //   idle:  spritePinkIdle,
  //   happy: spritePinkHappy,
  // },
  // grey: {
  //   idle: spriteGreyIdle,
  // },
};

/**
 * Resolves the correct sprite URL with graceful fallback.
 * @param {string} variant
 * @param {string} mood
 * @returns {string}
 */
function resolveSprite(variant, mood) {
  return (
    SPRITE_REGISTRY[variant]?.[mood]        // exact match
    ?? SPRITE_REGISTRY[variant]?.idle       // unknown mood for this variant → this variant's idle
    ?? SPRITE_REGISTRY.default?.[mood]      // unknown variant → default skin with requested mood
    ?? SPRITE_REGISTRY.default?.idle        // unknown mood for default skin → default skin idle
    ?? spriteDefaultIdle                    // absolute last resort
  );
}

// ─── Animation class map ────────────────────────────────────────────────────

const ANIMATION_CLASSES = {
  none:  styles.animNone,
  float: styles.animFloat,
  jump:  styles.animJump,
  shake: styles.animShake,
  pulse: styles.animPulse,
};

// ─── Accessory overlays ─────────────────────────────────────────────────────
//
// Each accessory is an absolutely-positioned SVG drawn inline.
// Adding a new accessory: add an entry here and import its SVG (or draw inline).
//
// Inline SVGs are used so they scale perfectly with the sprite at any `size`.

const BOW_SVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    className={styles.accessory}
    aria-hidden="true"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Pixel-art bow — sits between the ears, top-center of the sprite */}
    {/* Left loop */}
    <rect x="26" y="5" width="2" height="2" fill="#e0449a" />
    <rect x="24" y="6" width="4" height="2" fill="#e0449a" />
    <rect x="26" y="8" width="2" height="1" fill="#c0307a" />
    {/* Knot */}
    <rect x="29" y="6" width="2" height="3" fill="#c0307a" />
    {/* Right loop */}
    <rect x="32" y="5" width="2" height="2" fill="#e0449a" />
    <rect x="32" y="6" width="4" height="2" fill="#e0449a" />
    <rect x="32" y="8" width="2" height="1" fill="#c0307a" />
  </svg>
);

const CARROT_SVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    className={styles.accessory}
    aria-hidden="true"
    style={{ imageRendering: 'pixelated' }}
  >
    {/* Pixel-art carrot — held in front of the bunny (lower-right area) */}
    {/* Leaves */}
    <rect x="40" y="38" width="2" height="3" fill="#3aa830" />
    <rect x="42" y="37" width="2" height="2" fill="#3aa830" />
    <rect x="44" y="38" width="2" height="2" fill="#2d8a24" />
    {/* Body */}
    <rect x="40" y="41" width="3" height="2" fill="#f47820" />
    <rect x="41" y="43" width="2" height="2" fill="#f47820" />
    <rect x="42" y="45" width="1" height="2" fill="#d45c10" />
  </svg>
);

const ACCESSORY_MAP = {
  bow:    BOW_SVG,
  carrot: CARROT_SVG,
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * BunnySprite
 *
 * Renders the mascot rabbit with the given emotional state, animation, and
 * optional cosmetic customizations.
 *
 * Props
 * ─────
 * @param {'idle'|'happy'|'sad'|'sleeping'|'excited'}     mood        Which expression to show (default 'idle')
 * @param {'none'|'float'|'jump'|'shake'|'pulse'}         animation   CSS keyframe animation to apply (default 'float')
 * @param {string}                                        variant     Pre-rendered color skin key (default 'default')
 * @param {Array<'bow'|'carrot'>}                         accessories Cosmetic overlays rendered on top of the sprite
 * @param {number}                                        size        Square size in px (default 32)
 * @param {string}                                        className   Extra class name forwarded to the wrapper
 * @param {object}                                        style       Extra inline styles forwarded to the wrapper
 *
 * Extending the system
 * ─────────────────────
 * • New mood    → add SVG to src/assets/rabbit/<variant>/, import above, add to SPRITE_REGISTRY
 * • New variant → create src/assets/rabbit/<name>/ folder, add SVGs, import + add to SPRITE_REGISTRY
 * • New accessory → draw inline SVG in ACCESSORY_MAP above
 */
export default function BunnySprite({
  mood        = 'idle',
  animation   = 'none',
  variant     = 'default',
  colour      = 'default',
  accessories = [],
  size        = 32,
  className   = '',
  style       = {},
}) {
  const activeVariant = colour !== 'default' ? colour : variant;
  const spriteSrc    = resolveSprite(activeVariant, mood);
  const animClass    = ANIMATION_CLASSES[animation] ?? styles.animNone;

  return (
    <div
      className={`${styles.wrapper} ${animClass} ${className}`.trim()}
      style={{ '--bunny-size': `${size}px`, ...style }}
      role="img"
      aria-label={`Bunny mascot — ${mood}`}
    >
      <img
        src={spriteSrc}
        alt=""
        className={styles.sprite}
        draggable={false}
      />
      {accessories.map((acc) =>
        ACCESSORY_MAP[acc]
          ? React.cloneElement(ACCESSORY_MAP[acc], { key: acc })
          : null
      )}
    </div>
  );
}
