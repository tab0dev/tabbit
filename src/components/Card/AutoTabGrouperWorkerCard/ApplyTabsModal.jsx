import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Magnet, Check, X } from '@phosphor-icons/react';
import { GROUP_COLORS } from '../../Overlay/TabGroupPickerPanel';
import styles from './ApplyTabsModal.module.css';

/**
 * Confirmation modal shown after "Save & Apply" when open tabs match the saved rules.
 * Asks the user if they want to move those matched tabs into their groups right now.
 *
 * Props:
 *   previewTabs  — array of tab objects, each with a `matchedRule` property
 *   onConfirm    — called when user clicks "Move Tabs Now"
 *   onSkip       — called when user clicks "Skip"
 */
export default function ApplyTabsModal({ previewTabs, onConfirm, onSkip }) {
  // Build per-rule summary for display
  const groupSummary = useMemo(() => {
    const byRule = new Map();
    for (const tab of previewTabs) {
      const rule = tab.matchedRule;
      if (!byRule.has(rule.id)) {
        byRule.set(rule.id, { rule, count: 0 });
      }
      byRule.get(rule.id).count++;
    }
    return Array.from(byRule.values());
  }, [previewTabs]);

  return createPortal(
    <div className={styles.overlay} onClick={onSkip}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Magnet size={28} weight="duotone" color="white" />
            <h2>Apply Rules & Move Open Tabs?</h2>
          </div>
        </div>

        <div className={styles.content}>
          <p>
            <strong>{previewTabs.length} tab{previewTabs.length !== 1 ? 's' : ''}</strong> currently
            open match your rules and can be moved into their groups right now.
          </p>

          <div className={styles.groupList}>
            {groupSummary.map(({ rule, count }) => {
              const color = GROUP_COLORS[rule.groupColor] ?? GROUP_COLORS.grey;
              return (
                <div key={rule.id} className={styles.groupRow}>
                  <span className={styles.groupDot} style={{ background: color }} />
                  <span className={styles.groupName}>{rule.groupName}</span>
                  <span className={styles.groupCount}>{count} tab{count !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.cancelButton} onClick={onSkip}>
            <X size={16} weight="bold" />
            Skip
          </button>
          <button className={styles.confirmButton} onClick={onConfirm}>
            <Check size={16} weight="bold" />
            Move Tabs Now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
