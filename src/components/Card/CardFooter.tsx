import React, { useState } from 'react';
import styles from './Card.module.css';
import {
  Clock,
  HourglassHighIcon,
  Browsers,
  ArrowLeft,
  DotsNine,
  ListBullets,
  Tabs,
} from '@phosphor-icons/react';
import { formatTime } from '../../utils/formatters';
import { useTabProcessing } from '../../store/TabProcessingProvider';
import { useTriage } from '../../store/TriageProvider';
import { TabProcessingMode, TriageReducerAction } from '../../types';

export interface SortOption {
  value: string;
  label: string;
}

export interface InlineSortPickerProps {
  mode: TabProcessingMode;
  setMode: (mode: TabProcessingMode) => void;
  sortOptions: SortOption[];
  dispatch: React.Dispatch<TriageReducerAction>;
}

function InlineSortPicker({ mode, setMode, sortOptions, dispatch }: InlineSortPickerProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const currentLabel = sortOptions.find((o) => o.value === mode)?.label || 'Auto';

  if (!isExpanded) {
    return (
      <button
        className={styles.inlineSortTrigger}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
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
              setMode(opt.value as TabProcessingMode);
              dispatch({ type: 'START_REORDER' });
              dispatch({ type: 'REORDER_TABS', payload: opt.value as TabProcessingMode });
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

export interface CardFooterProps {
  progressPercent: number;
  elapsed: number;
  totalTabs: number;
  processedTabs: number;
  activeView: string;
  handleNavigate: (view: string) => void;
  handleMenuClick: (e: React.MouseEvent) => void;
  menuRect: DOMRect | null;
}

export default function CardFooter({
  progressPercent,
  elapsed,
  totalTabs,
  processedTabs,
  activeView,
  handleNavigate,
  handleMenuClick,
  menuRect,
}: CardFooterProps) {
  const { mode, setMode, excludeGroupedTabs, setExcludeGroupedTabs } = useTabProcessing();
  const { dispatch } = useTriage();
  // const { musicEnabled, toggleMusic } = useMusic();
  // Both labels are always rendered in a grid overlap so the button width
  // never changes — eliminating the hover-flicker loop entirely.
  // const defaultLabel = musicEnabled ? 'playing' : 'music';
  // const hoverLabel = musicEnabled ? 'mute' : 'turn on';

  const sortOptions = [
    { value: 'auto', label: 'auto' },
    { value: 'oldest_first', label: 'oldest' },
    { value: 'newest_first', label: 'newest' },
    { value: 'group_by_site', label: 'site' },
    { value: 'alphabetical', label: 'a-z' },
    { value: 'random', label: 'random' },
  ];

  return (
    <div className={styles.timerBarContainer}>
      <div className={styles.timerBarFill} style={{ width: `${progressPercent}%` }} />
      <div className={styles.timerContent}>
        <div className={styles.timerLeft}>
          <div className={`${styles.timerGroup} ${styles.hideOnSuperMobile}`}>
            <Clock size={14} weight="duotone" />
            <span className={`${styles.timerText} ${styles.hideOnMobile}`}>
              {formatTime(elapsed)}
            </span>
            <span className={`${styles.timerText} ${styles.showOnMobile}`}>
              {elapsed >= 60 ? `${Math.floor(elapsed / 60)}m` : '<1m'}
            </span>
          </div>
          <div className={`${styles.timerGroup} ${styles.hideOnMobile}`}>
            <HourglassHighIcon size={14} weight="duotone" />
            <span className={styles.progressText}>{Math.round(progressPercent)}%</span>
          </div>
          <div className={`${styles.timerGroup} ${styles.hideOnSuperMobile}`}>
            <Browsers size={14} weight="duotone" />
            <span className={`${styles.progressText} ${styles.hideOnMobile}`}>
              {totalTabs - processedTabs} tabs left
            </span>
            <span className={`${styles.progressText} ${styles.showOnMobile}`}>
              {totalTabs - processedTabs} tabs
            </span>
          </div>
          <div className={`${styles.footerDivider} ${styles.hideOnSuperMobile}`} />
          {activeView === 'default' && (
            <button
              className={styles.musicToggleBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate('listview');
              }}
              aria-label="Open list view"
            >
              <ListBullets size={14} weight="duotone" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500 }}>
                list
              </span>
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
              <button
                className={styles.musicToggleBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setExcludeGroupedTabs(!excludeGroupedTabs);
                }}
                title={excludeGroupedTabs ? 'Include grouped tabs' : 'Exclude grouped tabs'}
              >
                <Tabs size={14} weight="duotone" />
                <span
                  className={styles.hideOnMobile}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500 }}
                >
                  {excludeGroupedTabs ? 'include grouped' : 'exclude grouped'}
                </span>
                <span
                  className={styles.showOnMobile}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500 }}
                >
                  {excludeGroupedTabs ? 'include' : 'exclude'}
                </span>
              </button>
              <span className={styles.footerDivider} />
              <InlineSortPicker
                mode={mode}
                setMode={setMode}
                sortOptions={sortOptions}
                dispatch={dispatch}
              />
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
