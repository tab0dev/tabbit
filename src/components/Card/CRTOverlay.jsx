import React from 'react';
import styles from './Card.module.css';

/**
 * CRTOverlay — purely decorative, pointer-events: none overlays that sit
 * on top of the card content and produce:
 *   1. Scanlines  (via CSS ::before on .card)
 *   2. Flicker    (opacity animation — very subtle, max 8% darkness)
 *   3. Sweep      (the "lion running through it" — a bright band sliding top→bottom)
 *
 * All three are rendered above content via z-index but never intercept events.
 */
export default function CRTOverlay() {
  return (
    <>
      {/* Phosphor RGB mask — R/G/B subpixel columns with mix-blend-mode: screen */}
      <div className={styles.crtPhosphor} aria-hidden="true" />

      {/* Sweep — luminous horizontal band that glides top→bottom every 8s */}
      <div className={styles.crtSweep} aria-hidden="true" />
    </>
  );
}
