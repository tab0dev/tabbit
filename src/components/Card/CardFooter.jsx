import React, { useState } from 'react';
import styles from './Card.module.css';
import { Clock, HourglassHighIcon, Browsers, ArrowLeft, DotsNine, SpeakerHigh, SpeakerSlash, ListBullets } from '@phosphor-icons/react';
import { formatTime } from '../../utils/formatters';
import { useMusic } from '../../store/music/MusicProvider';
import { useTabProcessing } from '../../store/TabProcessingProvider';
import { useTriage } from '../../store/TriageProvider';

function InlineSortPicker({ mode, setMode, sortOptions, dispatch }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentLabel = sortOptions.find(o => o.value === mode)?.label || 'Auto';

  if (!isExpanded) {
    return (
      <button 
        className={styles.inlineSortTrigger}
        onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
      >
        {currentLabel}
      </button>
    );
  }

  return (
    <div className={styles.inlineSortExpanded}>
      {sortOptions.map((opt, index) => (
        <React.Fragment key={opt.value}>
          <button
            className={`${styles.inlineSortOption} ${mode === opt.value ? styles.inlineSortActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setMode(opt.value);
              dispatch({ type: 'START_REORDER' });
              dispatch({ type: 'REORDER_TABS', payload: opt.value });
              setIsExpanded(false);
            }}
          >
            {opt.label}
          </button>
          {index < sortOptions.length - 1 && <span className={styles.inlineSortDivider}>·</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function CardFooter({
  progressPercent,
  elapsed,
  totalTabs,
  processedTabs,
  activeView,
  handleNavigate,
  handleMenuClick,
  menuRect
}) {
  const { musicEnabled, toggleMusic } = useMusic();
  const { mode, setMode } = useTabProcessing();
  const { dispatch } = useTriage();

  const sortOptions = [
    { value: 'auto', label: 'auto' },
    { value: 'oldest_first', label: 'oldest' },
    { value: 'newest_first', label: 'newest' },
    { value: 'group_by_site', label: 'site' },
    { value: 'alphabetical', label: 'a-z' },
    { value: 'random', label: 'random' },
  ];

  // Both labels are always rendered in a grid overlap so the button width
  // never changes — eliminating the hover-flicker loop entirely.
  const defaultLabel = musicEnabled ? 'playing' : 'music';
  const hoverLabel = musicEnabled ? 'mute' : 'turn on';

  return (
    <div className={styles.timerBarContainer}>
      <div
        className={styles.timerBarFill}
        style={{ width: `${progressPercent}%` }}
      />
      <div className={styles.timerContent}>
        <div className={styles.timerLeft}>
          <div className={styles.timerGroup}>
            <Clock size={14} weight="duotone" />
            <span className={styles.timerText}>{formatTime(elapsed)}</span>
          </div>
          <div className={styles.timerGroup}>
            <HourglassHighIcon size={14} weight="duotone" />
            <span className={styles.progressText}>{Math.round(progressPercent)}%</span>
          </div>
          <div className={styles.timerGroup}>
            <Browsers size={14} weight="duotone" />
            <span className={styles.progressText}>{totalTabs - processedTabs} tabs left</span>
          </div>
          <div className={styles.footerDivider} />
          {activeView === 'default' && (
            <button
              className={styles.musicToggleBtn}
              onClick={(e) => { e.stopPropagation(); handleNavigate('listview'); }}
              aria-label="Open list view"
            >
              <ListBullets size={14} weight="duotone" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500 }}>list</span>
            </button>
          )}
          {/* <button
            className={styles.musicToggleBtn}
            onClick={(e) => { e.stopPropagation(); toggleMusic(); }}
            aria-label={musicEnabled ? 'Mute music' : 'Enable music'}
          >
            {musicEnabled
              ? <SpeakerHigh size={14} weight="duotone" />
              : <SpeakerSlash size={14} weight="duotone" />}
            <span className={styles.musicLabelSlot}>
              <span className={styles.musicLabelDefault}>{defaultLabel}</span>
              <span className={styles.musicLabelHover}>{hoverLabel}</span>
            </span>
          </button> */}

        </div>
        <div className={styles.timerRight}>
          {activeView !== 'default' ? (
            <button
              className={styles.backButton}
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate('default');
              }}
            >
              <ArrowLeft size={16} weight="duotone" />
              <span className={styles.settingsText}>back</span>
            </button>
          ) : (
            <>
              <InlineSortPicker mode={mode} setMode={setMode} sortOptions={sortOptions} dispatch={dispatch} />
              <button
                className={`${styles.settingsButton} ${menuRect ? styles.settingsButtonActive : ''}`}
                onClick={handleMenuClick}
                aria-label="Menu"
              >
                <DotsNine size={16} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
