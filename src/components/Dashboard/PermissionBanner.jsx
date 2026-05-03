import React from 'react';
import styles from './PermissionBanner.module.css';
import { useTriage } from '../../store/TriageProvider';
import { loadTriageData } from '../../services/triageLoader';

export default function PermissionBanner() {
  const { dispatch } = useTriage();

  const handleGrant = async () => {
    try {
      // Must be called in response to user gesture
      const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
      if (granted) {
        await loadTriageData(dispatch);
      }
    } catch (err) {
      console.error('[Tabbit] Permission request error:', err);
    }
  };

  const handleSkip = async () => {
    await loadTriageData(dispatch);
  };

  return (
    <div className="view">
      <div className={styles.permissionCard}>
        <h2>Enable Tab Previews</h2>
        <p>Tabbit needs permission to capture screenshots of your open tabs. This is a one-time grant.</p>
        <button className={styles.btnPrimary} onClick={handleGrant}>Grant Permission</button>
        <button className={styles.btnSecondary} onClick={handleSkip}>Skip — use without previews</button>
      </div>
    </div>
  );
}
