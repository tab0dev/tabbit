import React from 'react';
import { createPortal } from 'react-dom';
import { Check, X, NetworkSlash } from '@phosphor-icons/react';
import styles from './SmushConfirmModal.module.css';
import Favicon from '../Shared/Favicon';

/**
 * Confirmation modal shown after "Save & Apply" when duplicates are already
 * open and the smusher was just enabled. Asks the user if they want to close
 * the duplicate copies right now (keeping the first/oldest tab of each group).
 *
 * Props:
 *   duplicateGroups — array of [normUrl, tabs[]] pairs (from live preview)
 *   onConfirm       — called when user clicks "Close Duplicates Now"
 *   onSkip          — called when user clicks "Skip"
 */
export default function SmushConfirmModal({ duplicateGroups, onConfirm, onSkip }) {
  // Total tabs that would be closed = every tab in each group except the first
  const totalToClose = duplicateGroups.reduce((sum, [, tabs]) => sum + tabs.length - 1, 0);

  return createPortal(
    <div className={styles.overlay} onClick={onSkip}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <NetworkSlash size={28} weight="duotone" color="white" />
            <h2>Close Existing Duplicates?</h2>
          </div>
        </div>

        <div className={styles.content}>
          <p>
            <strong>{totalToClose} duplicate tab{totalToClose !== 1 ? 's' : ''}</strong> are
            currently open. Close them now?
          </p>

          <div className={styles.groupList}>
            {duplicateGroups.map(([normUrl, tabs]) => (
              <div key={normUrl} className={styles.groupRow}>
                <Favicon
                  src={tabs[0]?.favIconUrl}
                  size={12}
                  className={styles.groupFavicon}
                  fallbackClass={styles.groupFaviconFallback}
                />
                <span className={styles.groupUrl} title={normUrl}>{normUrl}</span>
                <span className={styles.groupCount}>
                  {tabs.length - 1} extra{tabs.length - 1 !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.cancelButton} onClick={onSkip}>
            <X size={16} weight="bold" />
            Skip
          </button>
          <button className={styles.confirmButton} onClick={onConfirm}>
            <Check size={16} weight="bold" />
            Close Duplicates Now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
