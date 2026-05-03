import React from 'react';
import styles from './Card.module.css';
import { Clock, HourglassHighIcon, Browsers, ArrowLeft, DotsThree, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { formatTime } from '../../utils/formatters';
import { useMusic } from '../../store/MusicProvider';

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
          <button
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
          </button>
        </div>
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
          <button
            className={`${styles.settingsButton} ${menuRect ? styles.settingsButtonActive : ''}`}
            onClick={handleMenuClick}
            aria-label="Menu"
          >
            <DotsThree size={16} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}
