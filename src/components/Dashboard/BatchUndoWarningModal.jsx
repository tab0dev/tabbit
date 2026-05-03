import React from 'react';
import { Warning, Check, X } from '@phosphor-icons/react';
import styles from './BatchUndoWarningModal.module.css';

export default function BatchUndoWarningModal({ tabCount, onConfirm, onDismiss }) {
  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Warning size={28} weight="fill" color="white" />
            <h2>Re-open {tabCount ? `${tabCount} tabs` : 'multiple tabs'}? For sure?</h2>
          </div>
        </div>

        <div className={styles.content}>
          <p>
            You are about to undo a bulk operation. This will restore {tabCount ? <strong>{tabCount} tabs</strong> : 'multiple tabs'} at once which may or may not be hard on your machine. <strong>Are you sure you want to proceed?</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className={styles.dismissButton} onClick={onDismiss} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button className={styles.dismissButton} onClick={onConfirm}>
            <Check size={16} weight="bold" />
            Restore Tabs
          </button>
        </div>
      </div>
    </div>
  );
}
