import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowCounterClockwise, KeyReturn, Terminal } from '@phosphor-icons/react';
import ActionHints from '../Hotkeys/ActionHints';
import Tooltip from '../Shared/Tooltip';
import RetroMonitor from '../Monitor/RetroMonitor';
import RetroMonitorMusicGame from '../Monitor/RetroMonitorMusicGame';
import { useMonitor } from '../../hooks/useMonitor';
import { useTriage } from '../../store/TriageProvider';
import { useMusic } from '../../store/MusicProvider';
import styles from './BottomStatusBar.module.css';
import BatchUndoWarningModal from './BatchUndoWarningModal';

export default function BottomStatusBar({ actions }) {
  const { mode, setMode } = useMonitor();
  const { state } = useTriage();
  const { musicEnabled } = useMusic();
  const hasUndo = state.undoStack.length > 0;
  const isMonitor = mode === 'monitor';
  const [undoHovered, setUndoHovered] = useState(false);
  const undoRef = useRef(null);
  const [showBatchUndoWarning, setShowBatchUndoWarning] = useState(false);

  const nextUndoItem = hasUndo ? state.undoStack[state.undoStack.length - 1] : null;
  const nextUndoIsBatch = nextUndoItem?.batch;
  const batchTabCount = useMemo(() => {
    if (!nextUndoIsBatch || !nextUndoItem.previousStates) return 0;
    return nextUndoItem.previousStates.reduce((acc, entry) => {
      const dups = entry.state.duplicates?.length || 0;
      return acc + 1 + dups;
    }, 0);
  }, [nextUndoIsBatch, nextUndoItem]);

  const handleToggleMode = () => {
    const nextMode = isMonitor ? 'hotkeys' : 'monitor';
    setMode(nextMode);
  };

  const handleUndoClick = () => {
    if (nextUndoIsBatch) {
      setShowBatchUndoWarning(true);
    } else {
      actions.undo();
    }
  };

  const handleConfirmBatchUndo = () => {
    setShowBatchUndoWarning(false);
    actions.undo();
  };

  return (
    <div className={styles.wrapper}>
      {hasUndo && (
        <Tooltip visible={undoHovered} anchorRef={undoRef}>
          Undo last action & retry
        </Tooltip>
      )}
      <div className={`${styles.cardGrid} ${hasUndo ? styles.hasUndo : ''}`}>
        {hasUndo && (
          <div
            className={styles.undoWrap}
            onMouseEnter={() => setUndoHovered(true)}
            onMouseLeave={() => setUndoHovered(false)}
          >
            <button
              ref={undoRef}
              type="button"
              className={styles.undoButton}
              onClick={handleUndoClick}
            >
              <ArrowCounterClockwise size={16} weight="regular" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className={styles.flipScene}>
          <motion.div
            className={styles.flipCard}
            animate={{ rotateX: isMonitor ? 180 : 0 }}
            transition={{ duration: 0.72, ease: [0.2, 0.65, 0.22, 1] }}
          >
            <div className={`${styles.face} ${styles.frontFace}`}>
              <ActionHints actions={actions} embedded />
            </div>
            <div className={`${styles.face} ${styles.backFace}`}>
              {/*
               * When music is ON  → show the rhythm game (RetroMonitorMusicGame)
               * When music is OFF → show the status monitor (RetroMonitor)
               * The mode toggle (hotkeys ↔ monitor) is unchanged;
               * only the monitor's content switches on musicEnabled.
               */}
              {musicEnabled
                ? <RetroMonitorMusicGame theme="darkula" embedded hasUndo={hasUndo} />
                : <RetroMonitor theme="darkula" embedded hasUndo={hasUndo} />
              }
            </div>
          </motion.div>
        </div>
        <div className={styles.toggleWrap}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleToggleMode}
            aria-label={isMonitor ? 'Switch to hotkeys bar' : 'Switch to monitor bar'}
            title={isMonitor ? 'Show Hotkeys' : 'Show Monitor'}
          >
            {isMonitor ? (
              <KeyReturn size={16} weight="regular" aria-hidden="true" />
            ) : (
              <Terminal size={16} weight="regular" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {showBatchUndoWarning && createPortal(
        <BatchUndoWarningModal
          tabCount={batchTabCount}
          onConfirm={handleConfirmBatchUndo}
          onDismiss={() => setShowBatchUndoWarning(false)}
        />,
        document.body
      )}
    </div>
  );
}
