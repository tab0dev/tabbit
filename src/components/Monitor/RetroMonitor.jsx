import React, { useMemo, useState, useEffect } from 'react';
import styles from './Monitor.module.css';
import { useMonitor } from '../../hooks/useMonitor';
import BunnySprite from './BunnySprite';
import useBunny from '../../hooks/useBunny';
import { useBeat } from '../../hooks/useBeat';

/**
 * RetroMonitor
 *
 * A Gameboy-style status monitor with a chibi bunny mascot on the left.
 * The newest log message always occupies both visible rows as a 2-line block.
 * Older entries are accessible via ▲/▼ scroll buttons (one entry at a time).
 *
 * Props:
 *   theme            — 'gameboy' | 'calc' | 'darkula'
 *   embedded         — strips panel padding/border for inline use
 *   showBunny        — whether to show the bunny mascot panel (default true)
 *   bunnyVariant     — pre-rendered color skin for the mascot (default 'default')
 *   bunnyAccessories — cosmetic accessories to layer on the mascot e.g. ['bow','carrot']
 */
export default function RetroMonitor({
  theme = 'gameboy',
  embedded = false,
  showBunny = true,
  bunnyVariant = 'default',
  bunnyAccessories = [],
  hasUndo = false,
}) {
  const { messages } = useMonitor();
  const [scrollOffset, setScrollOffset] = useState(0);

  // quarter-note flash from the music engine
  const { beatFlash, beatNumber, barFlash, hitFlash, missFlash, layerDownFlash, musicEnabled: musicIsOn } = useBeat();

  // Mascot state — driven by the active triage action
  const bunny = useBunny({ initialVariant: bunnyVariant });

  const themeClass =
    theme === 'calc'    ? styles.themeCalc :
    theme === 'darkula' ? styles.themeDarkula :
    styles.themeGameboy;

  // The visible entry index counted from the end: 0 = newest, 1 = second-newest, etc.
  const totalEntries = messages.length;
  const maxOffset    = Math.max(0, totalEntries - 1);
  const effectiveOffset = Math.min(scrollOffset, maxOffset);

  // Which message to display (null when no messages yet)
  const activeEntry = useMemo(() => {
    if (totalEntries === 0) return null;
    const idx = totalEntries - 1 - effectiveOffset;
    return messages[idx] ?? null;
  }, [messages, totalEntries, effectiveOffset]);

  // Split message text into up to 2 display lines
  const [line1, line2] = useMemo(() => {
    if (!activeEntry) return ['READY...', ''];
    const parts = activeEntry.text.split(/\r?\n/);
    return [
      (parts[0] || '').trim(),
      (parts[1] || '').trim(),
    ];
  }, [activeEntry]);

  const isScrollable = maxOffset > 0;

  // Colored action indicator: green for positive actions, red for close
  const ACTION_COLORS = {
    keep:     'green',
    bookmark: 'green',
    group:    'green',
    close:    'red',
  };
  const actionColor = activeEntry?.icon ? (ACTION_COLORS[activeEntry.icon] || null) : null;

  // Drive mascot mood + animation from the active action
  // (fires whenever the displayed entry changes, e.g. on new message or scroll)
  useEffect(() => {
    if (!activeEntry?.icon) {
      bunny.resetToIdle();
    } else {
      bunny.reactToAction(activeEntry.icon);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry]);

  // Sync variant prop if caller changes it at runtime
  useEffect(() => {
    bunny.setVariant(bunnyVariant);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bunnyVariant]);

  // Reset scroll to newest when a new message arrives
  const prevLengthRef = React.useRef(totalEntries);
  if (totalEntries !== prevLengthRef.current) {
    prevLengthRef.current = totalEntries;
    if (scrollOffset !== 0) setScrollOffset(0);
  }

  return (
    <div className={`${styles.monitorPanel} ${themeClass} ${embedded ? styles.embedded : ''} ${hasUndo ? styles.adjacentUndo : ''}`}>
      <div
        className={styles.monitorScreen}
        tabIndex={isScrollable ? 0 : -1}
        onKeyDown={(e) => {
          if (!isScrollable) return;
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setScrollOffset((prev) => Math.min(maxOffset, prev + 1));
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setScrollOffset((prev) => Math.max(0, prev - 1));
          }
        }}
      >
        {/* ── Bunny mascot panel ─────────────────────────────────────── */}
        {showBunny && (
          <div className={styles.bunnyPanel}>
            <BunnySprite
              size={32}
              mood={bunny.mood}
              animation={bunny.animation}
              variant={bunny.variant}
              accessories={bunnyAccessories}
            />
            {/* Beat pulse dot — only shown while music is playing */}
            {musicIsOn && (
              <span
                className={styles.beatDot}
                data-beat={beatFlash ? 'true' : 'false'}
                data-beat-number={String(beatNumber)}
                data-bar={barFlash ? 'true' : 'false'}
                data-hit={hitFlash ? 'true' : 'false'}
                data-miss={missFlash ? 'true' : 'false'}
                data-layer-down={layerDownFlash ? 'true' : 'false'}
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* ── Text panel ─────────────────────────────────────────────── */}
        <div className={styles.textPanel}>
          {/* Line 1 — action label (colored dot + primary text) */}
          <div className={`${styles.lineRow} ${styles.lineRowPrimary}`}>
            {actionColor && (
              <span
                className={styles.actionDot}
                aria-hidden="true"
                data-color={actionColor}
              />
            )}
            <span className={styles.lineText} title={line1}>
              {line1 || '\u00A0'}
            </span>
            {/* blinking cursor lives on line 1 if there's no line 2 */}
            {!line2 && <span className={styles.lineCursor} aria-hidden="true" />}
          </div>

          {/* Line 2 — bunny quip, displayed in accent color */}
          <div className={`${styles.lineRow} ${styles.lineRowSecondary}`}>
            <span className={`${styles.lineText} ${styles.lineTextQuip}`} title={line2}>
              {line2 || '\u00A0'}
            </span>
            {line2 && <span className={styles.lineCursor} aria-hidden="true" />}
          </div>
        </div>

        {/* ── Scroll controls ────────────────────────────────────────── */}
        {isScrollable && (
          <div className={styles.scrollControls}>
            <button
              type="button"
              className={styles.scrollButton}
              onClick={() => setScrollOffset((prev) => Math.min(maxOffset, prev + 1))}
              disabled={scrollOffset >= maxOffset}
              aria-label="Scroll monitor log up"
            >▲</button>
            <button
              type="button"
              className={styles.scrollButton}
              onClick={() => setScrollOffset((prev) => Math.max(0, prev - 1))}
              disabled={scrollOffset <= 0}
              aria-label="Scroll monitor log down"
            >▼</button>
          </div>
        )}
      </div>
    </div>
  );
}
