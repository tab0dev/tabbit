import React from 'react';
import { createPortal } from 'react-dom';
import { DownloadSimple, Check, X } from '@phosphor-icons/react';
import styles from './AiOptInModal.module.css';

export default function AiOptInModal({ onConfirm, onCancel, isAlreadyDownloaded }) {
  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <DownloadSimple size={28} weight="fill" color="white" />
            <h2>Enable AI Grouping</h2>
          </div>
        </div>
        
        <div className={styles.content}>
          {isAlreadyDownloaded ? (
            <>
              <p>
                You clicked the AI switch! Your device already has the <strong>Gemini Nano</strong> model downloaded via Chrome, but Tabbit needs your permission to use it.
              </p>
              <p>
                By opting in, <strong>we will use this local AI model to parse your tab names</strong> and intelligently group them by their intent and topic, rather than just the domain name.
              </p>
              <p>
                Because it uses Chrome's local AI, your browsing data is never sent to the cloud. You can revoke this permission at any time in Settings.
              </p>
            </>
          ) : (
            <>
              <p>
                You clicked the AI switch! To power this feature locally, Tabbit needs to download Chrome's built-in <strong>Gemini Nano</strong> model.
              </p>
              <p>
                The model is approximately <strong>1.5 GB</strong> in size and will be downloaded directly by your browser. <strong>We use it to intelligently group your tabs by their intent and topic</strong>, rather than just the domain name.
              </p>
              <p>
                Because it uses Chrome's local AI, your browsing data is never sent to the cloud. You do not need to download this model if you prefer standard domain-based grouping!
              </p>
            </>
          )}
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.cancelButton} onClick={onCancel}>
            <X size={16} weight="bold" />
            Cancel
          </button>
          <button className={styles.confirmButton} onClick={onConfirm}>
            <Check size={16} weight="bold" />
            {isAlreadyDownloaded ? 'Enable AI' : 'Download (1.5 GB)'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
