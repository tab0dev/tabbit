import { useState, useCallback, useRef } from 'react';

/**
 * useBunny
 *
 * Central state hook for the BunnySprite mascot. Controls:
 *   - mood       : which emotional sprite to display
 *   - animation  : which CSS keyframe animation is active
 *   - variant    : the color/skin of the bunny (selects a pre-rendered SVG set)
 *   - accessories: cosmetic add-ons layered over the sprite
 *
 * Moods:       'idle' | 'happy' | 'sad' | 'sleeping' | 'excited'
 * Animations:  'none' | 'float' | 'jump' | 'shake' | 'pulse'
 * Variants:    'default' | 'pink' | 'grey' | ... (keyed to sprite file directories)
 * Accessories: ('bow' | 'carrot')[]
 *
 * Usage:
 *   const bunny = useBunny();
 *   bunny.setMood('happy');
 *   bunny.triggerAnimation('jump', 600);   // auto-resets after 600 ms
 *   bunny.setVariant('pink');
 *   bunny.setAccessories(['bow']);
 *
 * You can also call the convenience helper `bunny.reactToAction(actionType)`
 * which maps action strings (keep/bookmark/group/close) to the right mood +
 * animation in one call.
 */

export const MOODS = /** @type {const} */ (['idle', 'happy', 'sad', 'sleeping', 'excited']);
export const ANIMATIONS = /** @type {const} */ (['none', 'float', 'jump', 'shake', 'pulse']);
export const ACCESSORIES = /** @type {const} */ (['bow', 'carrot']);

/** Maps triage action names → { mood, animation, durationMs } */
const ACTION_REACTIONS = {
  keep:     { mood: 'happy',   animation: 'jump',  durationMs: 650 },
  bookmark: { mood: 'excited', animation: 'jump',  durationMs: 650 },
  group:    { mood: 'excited', animation: 'pulse', durationMs: 700 },
  close:    { mood: 'sad',     animation: 'shake', durationMs: 500 },
};

/** Default idle animation while the bunny is just sitting there */
const IDLE_ANIMATION = 'none';

export default function useBunny({
  initialMood      = 'idle',
  initialAnimation = IDLE_ANIMATION,
  initialVariant   = 'default',
  initialAccessories = [],
} = {}) {
  const [mood, setMood]           = useState(initialMood);
  const [animation, setAnimation] = useState(initialAnimation);
  const [variant, setVariant]     = useState(initialVariant);
  const [accessories, setAccessories] = useState(initialAccessories);

  /** Ref to clear any pending animation reset timer */
  const resetTimerRef = useRef(null);

  /**
   * triggerAnimation(anim, durationMs?)
   * Plays `anim` then reverts to the idle float animation after `durationMs`.
   * Passing durationMs = 0 or undefined plays the animation indefinitely.
   */
  const triggerAnimation = useCallback((anim, durationMs = 0) => {
    // Cancel any in-flight reset
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    setAnimation(anim);

    if (durationMs > 0) {
      resetTimerRef.current = setTimeout(() => {
        setAnimation(IDLE_ANIMATION);
      }, durationMs);
    }
  }, []);

  /**
   * reactToAction(actionType)
   * One-shot helper: maps a triage action string to the correct mood + animation.
   * Unknown actions are silently ignored (bunny stays idle).
   */
  const reactToAction = useCallback((actionType) => {
    const reaction = ACTION_REACTIONS[actionType];
    if (!reaction) return;
    setMood(reaction.mood);
    triggerAnimation(reaction.animation, reaction.durationMs);
  }, [triggerAnimation]);

  /**
   * resetToIdle()
   * Returns the bunny to its neutral idle state.
   */
  const resetToIdle = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setMood('idle');
    setAnimation(IDLE_ANIMATION);
  }, []);

  return {
    // State
    mood,
    animation,
    variant,
    accessories,
    // Setters
    setMood,
    setAnimation,
    setVariant,
    setAccessories,
    // Helpers
    triggerAnimation,
    reactToAction,
    resetToIdle,
  };
}
