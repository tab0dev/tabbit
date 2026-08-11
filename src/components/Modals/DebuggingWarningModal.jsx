import React from 'react';
import { Warning, Check } from '@phosphor-icons/react';
import styles from './DebuggingWarningModal.module.css';

export default function DebuggingWarningModal({ onDismiss }) {
  return (
    <div className={styles.overlay} onClick={onDismiss}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Warning size={28} weight="fill" color="white" />
            <h2>Why the Warning Banner?</h2>
          </div>
        </div>
        
        <div className={styles.content}>
          <p>
            You might notice a native Chrome banner at the top of your window saying <strong>"Tabbit started debugging this browser"</strong>.
          </p>
          <p>
            Tabbit uses Chrome's built-in debugger API locally to generate the preview that you see. <strong>We never monitor your traffic, collect browsing history, or share your data. Nothing is ever transmitted over the internet. Everything happens locally on your device.</strong>
          </p>
          <p>
            This is a standard Chrome security feature that we cannot hide. You can safely ignore the banner or close it while using Tabbit!
          </p>
        </div>

        <button className={styles.dismissButton} onClick={onDismiss}>
          <Check size={16} weight="bold" />
          Got it
        </button>
      </div>
    </div>
  );
}
